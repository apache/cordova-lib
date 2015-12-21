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

var npm = require('npm'),
    path = require('path'),
    Q = require('q'),
    npmhelper = require('../../util/npm-helper'),
    events = require('cordova-common').events,
    unpack = require('../../util/unpack');

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
    fetch: function(plugin) {
        plugin = plugin.shift();
        return Q.fcall(function() {
            //fetch from npm
            return fetchPlugin(plugin);
        })
        .fail(function(error) {
            return Q.reject(error);
        });
    },

    /**
     * @method info
     * @param {String} name Plugin name
     * @return {Promise.<Object>} Promised package info.
     */
    info: function(plugin) {
        plugin = plugin.shift();
        return (Q.nbind(npm.load, npm))
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
 * @description Calls npmhelper.loadWithSettingsThenRestore, which initializes npm.config with
 * settings, executes the promises, then restores npm.config. Use this rather than passing settings to npm.load, since
 * that only works the first time you try to load npm.
 */
function initThenLoadSettingsWithRestore(promises) {
    return npmhelper.loadWithSettingsThenRestore({}, promises);
}

/**
* @param {Array} with one element - the plugin id or "id@version"
* @return {Promise.<string>} Promised path to fetched package.
*/
function fetchPlugin(plugin) {
    return initThenLoadSettingsWithRestore(function () {
        events.emit('log', 'Fetching plugin "' + plugin + '" via npm');
        return Q.ninvoke(npm.commands, 'cache', ['add', plugin])
        .then(function (info) {
            var pluginDir = path.resolve(npm.cache, info.name, info.version, 'package');
            // Unpack the plugin that was added to the cache (CB-8154)
            var package_tgz = path.resolve(npm.cache, info.name, info.version, 'package.tgz');
            return unpack.unpackTgz(package_tgz, pluginDir);
        });
    });
}
