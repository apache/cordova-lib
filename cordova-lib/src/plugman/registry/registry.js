/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/

/* jshint laxcomma:true */

var semver = require('semver'),
    npm = require('npm'),
    path = require('path'),
    url = require('url'),
    fs = require('fs'),
    rc = require('rc'),
    Q = require('q'),
    request = require('request'),
    pluginMapper = require('cordova-registry-mapper').oldToNew,
    npmhelper = require('../../util/npm-helper'),
    home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
    events = require('../../events'),
    unpack = require('../../util/unpack'),
    // if PLUGMAN_HOME env var is specified use it as config directory (see CB-8190)
    plugmanConfigDir = process.env.PLUGMAN_HOME || path.resolve(home, '.plugman'),
    plugmanCacheDir = path.resolve(plugmanConfigDir, 'cache'),
    oneDay = 3600*24;

module.exports = {
    settings: null,
    /**
     * @method config
     * @param {Array} args Command argument
     * @return {Promise.<Object>} Promised configuration object.
     */
    config: function (args) {
        return initThenLoadSettingsWithRestore(function () {
            return Q.ninvoke(npm.commands, 'config', args);
        });
    },

    /**
     * @method owner
     * @param {Array} args Command argument
     * @return {Promise.<void>} Promise for completion.
     */
    owner: function(args) {
        var command = args && args[0];
        if (command && (command === 'add' || command === 'rm'))
            return Q.reject('Support for \'owner add/rm\' commands has been removed ' +
                'due to transition of Cordova plugins registry to read-only state');

        return initThenLoadSettingsWithRestore(function () {
            return Q.ninvoke(npm.commands, 'owner', args);
        });
    },

    /**
     * @method search
     * @param {Array} args Array of keywords
     * @return {Promise.<Object>} Promised search results.
     */
    search: function(args) {
        return initThenLoadSettingsWithRestore(function () {
            return Q.ninvoke(npm.commands, 'search', args, true);
        });
    },

    /**
     * @method fetch
     * @param {Array} with one element - the plugin id or "id@version"
     * @return {Promise.<string>} Promised path to fetched package.
     */
    fetch: function(plugin, client) {
        plugin = plugin.shift();
        return Q.fcall(function() {
            //fetch from npm
            return fetchPlugin(plugin, client, true);
        })
        .fail(function(error) {
            //check to see if pluginID is reverse domain name style
            if(isValidCprName(plugin)) {
                //fetch from CPR
                return fetchPlugin(plugin, client, false);
            } else {
                return Q.reject(error);
            }
        });
    },

    /**
     * @method info
     * @param {String} name Plugin name
     * @return {Promise.<Object>} Promised package info.
     */
    info: function(plugin) {
        plugin = plugin.shift();
        return initSettings()
        .then(Q.nbind(npm.load, npm))
        .then(function() {
            // Set cache timout limits to 0 to force npm to call the registry
            // even when it has a recent .cache.json file.
            npm.config.set('cache-min', 0);
            npm.config.set('cache-max', 0);
            return Q.ninvoke(npm.commands, 'view', [plugin], /* silent = */ true );
        })
        .then(function(info) {
            // Plugin info should be accessed as info[version]. If a version
            // specifier like >=x.y.z was used when calling npm view, info
            // can contain several versions, but we take the first one here.
            var version = Object.keys(info)[0];
            return info[version];
        });
    }
};

/**
 * @param {Boolean} determines if we are using the npm registry
 * @return {Promise.<Object>} Promised settings.
 */
function initSettings(returnEmptySettings) {
    var settings = module.exports.settings;

    // check if settings already set
    if(settings !== null) {
        return Q(returnEmptySettings ? {} : settings);
    }

    // setting up settings
    // obviously if settings dir does not exist settings is going to be empty
    if(!fs.existsSync(plugmanConfigDir)) {
        fs.mkdirSync(plugmanConfigDir);
        fs.mkdirSync(plugmanCacheDir);
    }

    settings =
    module.exports.settings =
    rc('plugman', {
        cache: plugmanCacheDir,
        registry: 'http://registry.cordova.io',
        logstream: fs.createWriteStream(path.resolve(plugmanConfigDir, 'plugman.log')),
        userconfig: path.resolve(plugmanConfigDir, 'config'),
        'cache-min': oneDay
    });

    return Q(returnEmptySettings ? {} : settings);
}

/**
 * @description Calls initSettings(), then npmhelper.loadWithSettingsThenRestore, which initializes npm.config with
 * settings, executes the promises, then restores npm.config. Use this rather than passing settings to npm.load, since
 * that only works the first time you try to load npm.
 */
function initThenLoadSettingsWithRestore(useEmptySettings, promises) {
    if (typeof useEmptySettings === 'function') {
        promises = useEmptySettings;
        useEmptySettings = false;
    }

    return initSettings(useEmptySettings).then(function (settings) {
        return npmhelper.loadWithSettingsThenRestore(settings, promises);
    });
}

// Send a message to the registry to update download counts.
function bumpCounter(info, client) {
    // Update the download count for this plugin.
    // Fingers crossed that the timestamps are unique, and that no plugin is downloaded
    // twice in a single millisecond.
    //
    // This is acceptable, because the failure mode is Couch gracefully rejecting the second one
    // (for lacking a _rev), and dropped a download count is not important.
    var settings = module.exports.settings;
    var now = new Date();
    var message = {
        day: now.getUTCFullYear() + '-' + (now.getUTCMonth()+1) + '-' + now.getUTCDate(),
        pkg: info.name,
        client: client,
        version: info.version
    };
    var remote = settings.registry + '/downloads';

    makeRequest('POST', remote, message, function (err, res, body) {
        // ignore errors
    });
}


function makeRequest (method, where, what, cb_) {
    var settings = module.exports.settings;
    var remote = url.parse(where);
    if (typeof cb_ !== 'function') {
        cb_ = what;
        what = null;
    }
    var cbCalled = false;
    function cb () {
        if (cbCalled) return;
        cbCalled = true;
        cb_.apply(null, arguments);
    }

    var strict = settings['strict-ssl'];
    if (strict === undefined) strict = true;
    var opts = { url: remote
               , method: method
               , ca: settings.ca
               , strictSSL: strict
               };

    var headers = opts.headers = {};

    headers.accept = 'application/json';

    headers['user-agent'] = settings['user-agent'] ||
                            'node/' + process.version;

    var p = settings.proxy;
    var sp = settings['https-proxy'] || p;
    opts.proxy = remote.protocol === 'https:' ? sp : p;

    // figure out wth 'what' is
    if (what) {
        if (Buffer.isBuffer(what) || typeof what === 'string') {
            opts.body = what;
            headers['content-type'] = 'application/json';
            headers['content-length'] = Buffer.byteLength(what);
        } else {
            opts.json = what;
        }
    }

    var req = request(opts, cb);

    req.on('error', cb);
    req.on('socket', function (s) {
        s.on('error', cb);
    });

    return req;
}

/**
* @param {Array} with one element - the plugin id or "id@version"
* @param useNpmRegistry: {Boolean} - to use the npm registry
* @return {Promise.<string>} Promised path to fetched package.
*/
function fetchPlugin(plugin, client, useNpmRegistry) {
    //set registry variable to use in log messages below
    var registryName;
    if(useNpmRegistry){
        registryName = 'npm';
    } else {
        registryName = 'cordova plugins registry';
    }

    return initThenLoadSettingsWithRestore(useNpmRegistry, function () {
        events.emit('log', 'Fetching plugin "' + plugin + '" via ' + registryName);
        return Q.ninvoke(npm.commands, 'cache', ['add', processPluginVersion(plugin)])
        .then(function (info) {
            var cl = (client === 'plugman' ? 'plugman' : 'cordova-cli');
            bumpCounter(info, cl);
            var pluginDir = path.resolve(npm.cache, info.name, info.version, 'package');
            // Unpack the plugin that was added to the cache (CB-8154)
            var package_tgz = path.resolve(npm.cache, info.name, info.version, 'package.tgz');
            return unpack.unpackTgz(package_tgz, pluginDir);
        });
    });
}

function processPluginVersion(plugin) {
    // If plugin includes a version that is a caret range, the ancient version of npm we're using won't know how to
    // handle it. So we'll use our current version of semver to turn it into a usable range.

    var parts = plugin.split('@');
    var version = parts[1];

    if (!version || version.charAt(0) !== '^') {
        return plugin;
    }

    var validRange = semver.validRange(version, /* loose */ true);
    if (!validRange) {
        return plugin;
    }

    // Because validRange may include spaces, we need to wrap it in quotes.
    return parts[0] + '@"' + validRange + '"';
}

/**
 * @param {Array} with one element - the plugin id or "id@version"
 * @return {Boolean} if plugin id is reverse domain name style.
 */
function isValidCprName(plugin) {
    // Split @Version from the plugin id if it exists.
    var splitVersion = plugin.split('@');

    //Create regex that checks for at least two dots with any characters except @ to determine if it is reverse domain name style.
    var matches = /([^@]*\.[^@]*\.[^@]*)/.exec(splitVersion[0]);

    //If matches equals null, plugin is not reverse domain name style
    if(matches === null) {
        return false;
    } else {
        warnIfIdInMapper(splitVersion[0]);
    }
    return true;
}

/**
 * @param plugin:{Array} - the plugin id or "id@version"
 * @param matches:{Array} - the array containing the RDN style plugin id without @version
 */
function warnIfIdInMapper(plugin) {
    //Reverse domain name style plugin ID
    //Check if a mapping exists for the plugin id
    //if it does, warn the users to use package-name
    var packageName = pluginMapper[plugin];
    if(packageName) {
        events.emit('log', 'WARNING: ' + plugin + ' has been renamed to ' + packageName + '. You may not be getting the latest version! We suggest you `cordova plugin rm ' + plugin + '` and `cordova plugin add ' + packageName + '`.');
    }
}
