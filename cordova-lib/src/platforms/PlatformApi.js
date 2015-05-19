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

var fs = require('fs'),
    path = require('path'),
    util = require('../cordova/util'),
    superspawn = require('../cordova/superspawn'),
    platforms = require('./platformsConfig.json');

// Avoid loading the same platform projects more than once (identified by path)
var cachedProjects = {};

// A single class that exposes functionality from platform specific files from
// both places cordova/metadata and plugman/platforms. Hopefully, to be soon
// replaced by real unified platform specific classes.
function BasePlatformApi(platform, platformRootDir) {
    this.root = platformRootDir;
    this.platform = platform;
}

// Expose all public methods from the parser and handler, properly bound.
// TODO: This is left as-is for backward compatibility and probably should be removed.
// TODO: Rename these methods in PlatformHandler class to have more js-style naming. Proposed names inline
// To ensure that code is backaward compatible we'll need to have mappings from old names to new
var PARSER_PUBLIC_METHODS = [
    'config_xml',           // Proposed: getConfigXml()
    'cordovajs_path',       // Proposed: getCordovaJs()
    'cordovajs_src_path',   // Proposed: getCordovaJsSrc()
    'update_from_config',   // Proposed: remove this method in favor of updateProject as more semantic-correct
    'update_project',       // Proposed: updateProject()
    'update_www',           // Proposed: updateWww()
    'www_dir',              // Proposed: getWwwDir()
];

var HANDLER_PUBLIC_METHODS = [
    'package_name',
    'parseProjectFile',
    'purgeProjectFileCache',
];

PARSER_PUBLIC_METHODS.forEach(function(method) {
    BasePlatformApi.prototype[method] = function () {
        if (this.parser[method]) {
            return this.parser[method].apply(this.parser, arguments);
        }
    };
});

HANDLER_PUBLIC_METHODS.forEach(function(method) {
    BasePlatformApi.prototype[method] = function () {
        if (this.handler[method]) {
            return this.handler[method].apply(this.handler, arguments);
        }
    };
});

BasePlatformApi.prototype.getPlatformHandler = function() {
    if (!this._platformHandler) {
        // Default PlatformHandler
        var PlatformHandler = require(platforms[this.platform].parser_file);
        // Try find whether platform exposes its' API via js module
        var platformApiModule = path.join(this.root, 'cordova', 'Api.js');
        if (fs.existsSync(platformApiModule)) {
            var PlatformHandlerImpl = require(platformApiModule).PlatformHandler;
            // Another check to ensure that platform exposes PlatformHandler implementation
            if (PlatformHandlerImpl) {
                PlatformHandler = inherit(PlatformHandlerImpl, PlatformHandler);
            }
        }

        this._platformHandler = new PlatformHandler(this.root);
    }

    return this._platformHandler;
};

BasePlatformApi.prototype.getPluginHandler = function() {
    if (!this._pluginHandler) {
        this._pluginHandler = require(platforms[this.platform].handler_file);
    }
    return this._pluginHandler;
};

// TODO: These props are left for backward compatibility
// The proper way to get platform/plugin handlers - use getPlatformHandler/getPluginHandler methods
Object.defineProperty(BasePlatformApi.prototype, 'parser', {
    get: function () { return this.getPlatformHandler(); }
});

Object.defineProperty(BasePlatformApi.prototype, 'handler', {
    get: function () { return this.getPluginHandler(); }
});

BasePlatformApi.prototype.getInstaller = function(type) {
    var self = this;
    function installWrapper(item, plugin_dir, plugin_id, options, project) {
        self.getPluginHandler()[type].install(item, plugin_dir, self.root, plugin_id, options, project);
    }
    return installWrapper;
};

BasePlatformApi.prototype.getUninstaller = function(type) {
    var self = this;
    function uninstallWrapper(item, plugin_id, options, project) {
        self.getPluginHandler()[type].uninstall(item, self.root, plugin_id, options, project);
    }
    return uninstallWrapper;
};

/**
 * Default implementation for platform build. Uses executable script shipped with platform to build project.
 * Could be overridden using PlatformApi implementation if it is provided by platform.
 * @param  {Object}  options Complex object that provides cordova API to method
 * @return {Promise}         Promise, either resolve or rejected with error code.
 */
BasePlatformApi.prototype.build = function(options) {
    var cmd = path.join(this.root, 'cordova', 'build');
    return superspawn.spawn(cmd, options.options, { printCommand: true, stdio: 'inherit' });
};

/**
 * Default implementation for platform requirements. Uses module shipped with platform.
 * Could be overridden using PlatformApi implementation if it is provided by platform.
 * @return {Promise}         Promise, either resolved with array of requirements
 *                                    or rejected with error.
 */
BasePlatformApi.prototype.requirements = function(options) {
    var modulePath = path.join(this.root, 'cordova', 'lib', 'check_reqs');
    return require(modulePath).check_all();
};

// getPlatformApi() should be the only method of instantiating the
// PlatformProject classes for now.
function getPlatformApi(platform, platformRootDir) {
    // if platformRootDir is not specified, try to detect it first
    var projectRootDir = util.isCordova();
    if (!platformRootDir && projectRootDir) {
        platformRootDir = path.join(projectRootDir, 'platforms', platform);
    } else {
        throw new Error('Current location is not a Cordova project');
    }

    var cached = cachedProjects[platformRootDir];
    if (cached && cached.platform == platform) return cached;

    if (!platforms[platform]) throw new Error('Unknown platform ' + platform);

    var PlatformApi = BasePlatformApi;
    // First we need to find whether platform exposes its' API via js module
    var platformApiModule = path.join(platformRootDir, 'cordova', 'Api.js');
    if (fs.existsSync(platformApiModule)) {
        // If it has, then we have to require it and extend BasePlatformApi
        // with platform's API.
        var PlatformApiImpl = require(platformApiModule);
        PlatformApi = inherit(PlatformApiImpl, BasePlatformApi);
    }

    var platformApi = new PlatformApi(platform, platformRootDir);
    cachedProjects[platformRootDir] = platformApi;
    return platformApi;
}

module.exports.getPlatformApi = getPlatformApi;
module.exports.BasePlatformApi = BasePlatformApi;

/**
 * Helper function that extends inherited class with base class prototype's methods.
 * If method exists in poth base and inherited prototypes, then inherited one's will be used.
 * Base prototype's method in this case will be accessible via 'this.constructor.super_.methodName'.
 *
 * @param  {Function} ctor      The constructor of class to be inherited from Base class.
 * @param  {Function} superCtor Base constructor.
 * @return {Function}           The constructor of inherited class.
 */
function inherit(ctor, superCtor) {
    ctor.super_ = superCtor;

    // Back up prototype methods, otherwise they'll be ovewritten
    var ctorProtoMethods = {};
    for (var methodName in ctor.prototype) {
        ctorProtoMethods[methodName] = ctor.prototype[methodName];
    }

    // Extend inherited class by borrowing base prototype methods
    ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
            value: ctor,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });

    // Restore inherited prototype members
    for (methodName in ctorProtoMethods) {
        ctor.prototype[methodName] = ctorProtoMethods[methodName];
    }

    return ctor;
}
