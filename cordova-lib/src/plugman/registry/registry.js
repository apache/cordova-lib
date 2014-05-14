var npm = require('npm'),
    path = require('path'),
    http = require('http'),
    url = require('url'),
    fs = require('fs'),
    manifest = require('./manifest'),
    os = require('os'),
    rc = require('rc'),
    Q = require('q'),
    request = require('request'),
    zlib = require('zlib'),
    tar = require('tar'),
    shell = require('shelljs'),
    home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE,
    plugmanConfigDir = path.resolve(home, '.plugman'),
    plugmanCacheDir = path.resolve(plugmanConfigDir, 'cache');


module.exports = {
    settings: null,
    /**
     * @method config
     * @param {Array} args Command argument
     * @return {Promise.<Object>} Promised configuration object.
     */
    config: function(args) {
        return initSettings().then(function(settings) {
            return Q.ninvoke(npm, 'load', settings)
        })
        .then(function() {
            return Q.ninvoke(npm.commands, 'config', args);
        });
    },

    /**
     * @method owner
     * @param {Array} args Command argument
     * @return {Promise.<void>} Promise for completion.
     */
    owner: function(args) {
        return initSettings().then(function(settings) {
            return Q.ninvoke(npm, 'load', settings);
        }).then(function() {
            return Q.ninvoke(npm.commands, 'owner', args);
        });
    },
    /**
     * @method adduser
     * @param {Array} args Command argument
     * @return {Promise.<void>} Promise for completion.
     */
    adduser: function(args) {
        return initSettings().then(function(settings) {
            return Q.ninvoke(npm, 'load', settings)
        })
        .then(function() {
            return Q.ninvoke(npm.commands, 'adduser', args);
        });
    },

    /**
     * @method publish
     * @param {Array} args Command argument
     * @return {Promise.<Object>} Promised published data.
     */
    publish: function(args) {
        return initSettings()
        .then(function(settings) {
            return manifest.generatePackageJsonFromPluginXml(args[0])
            .then(function() {
                return Q.ninvoke(npm, 'load', settings);
            }).then(function() {
                return Q.ninvoke(npm.commands, 'publish', args)
            }).fin(function() {
                fs.unlink(path.resolve(args[0], 'package.json'));
            });
        });
    },

    /**
     * @method search
     * @param {Array} args Array of keywords
     * @return {Promise.<Object>} Promised search results.
     */
    search: function(args) {
        return initSettings()
        .then(function(settings) {
            return Q.ninvoke(npm, 'load', settings);
        }).then(function() {
            return Q.ninvoke(npm.commands, 'search', args, true);
        });
    },

    /**
     * @method unpublish
     * @param {Array} args Command argument
     * @return {Promise.<Object>} Promised results.
     */
    unpublish: function(args) {
        return initSettings()
        .then(function(settings) {
            return Q.ninvoke(npm, 'load', settings);
        }).then(function() {
            return Q.ninvoke(npm.commands, 'unpublish', args);
        }).then(function() {
            return Q.ninvoke(npm.commands, 'cache', ["clean"]);
        });
    },

    /**
     * @method fetch
     * @param {Array} with one element - the plugin id or "id@version"
     * @return {Promise.<string>} Promised path to fetched package.
     */
    fetch: function(plugin, client) {
        plugin = plugin.shift();
        return initSettings()
        .then(Q.nbind(npm.load, npm))
        .then(function() {
            // With no --force, npm won't re-download if appropriate version is already cached.
            npm.config.set('force', false);
            return Q.ninvoke(npm.commands, 'cache', ['add', plugin]);
        })
        .then(function(info) {
            var cl = (client === 'plugman' ? 'plugman' : 'cordova-cli');
            bumpCounter(info, cl);
            var pluginDir = path.resolve(npm.cache, info.name, info.version, 'package');
            return pluginDir;
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
            // --force is not needed
            npm.config.set('force', false);
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
}

/**
 * @method initSettings
 * @return {Promise.<Object>} Promised settings.
 */
function initSettings() {
    var settings = module.exports.settings;
    // check if settings already set
    if(settings != null) return Q(settings);

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
         force: true,
         registry: 'http://registry.cordova.io',
         logstream: fs.createWriteStream(path.resolve(plugmanConfigDir, 'plugman.log')),
         userconfig: path.resolve(plugmanConfigDir, 'config')
    });
    return Q(settings);
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
    var remote = settings.registry + '/downloads'

    makeRequest('POST', remote, message, function (err, res, body) {
        // ignore errors
    });
}


function makeRequest (method, where, what, cb_) {
  var settings = module.exports.settings
  var remote = url.parse(where)
  if (typeof cb_ !== "function") cb_ = what, what = null
  var cbCalled = false
  function cb () {
    if (cbCalled) return
    cbCalled = true
    cb_.apply(null, arguments)
  }

  var strict = settings['strict-ssl']
  if (strict === undefined) strict = true
  var opts = { url: remote
             , method: method
             , ca: settings.ca
             , strictSSL: strict }
    , headers = opts.headers = {}

  headers.accept = "application/json"

  headers["user-agent"] = settings['user-agent'] ||
                          'node/' + process.version

  var p = settings.proxy
  var sp = settings['https-proxy'] || p
  opts.proxy = remote.protocol === "https:" ? sp : p

  // figure out wth 'what' is
  if (what) {
    if (Buffer.isBuffer(what) || typeof what === "string") {
      opts.body = what
      headers["content-type"] = "application/json"
      headers["content-length"] = Buffer.byteLength(what)
    } else {
      opts.json = what
    }
  }

  var req = request(opts, cb)

  req.on("error", cb)
  req.on("socket", function (s) {
    s.on("error", cb)
  })

  return req
}
