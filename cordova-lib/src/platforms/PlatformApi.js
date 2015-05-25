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

var BasePlatformHandler = require('../cordova/metadata/PlatformHandler');
var BasePluginHandler = require('../plugman/platforms/PluginHandler');

// Avoid loading the same platform projects more than once (identified by path)
var cachedProjects = {};

// The objects below defines PlatformHandler and PluginHandler methods, which we need
// to expose at the PlatformApi level. These objects also defines a mappings from old
// methods names to new ones (more JS-styled).
// TODO: This could be removed once all old methods' usages will be replaced
var PARSER_PUBLIC_METHODS = {
    'config_xml': 'getConfigXml',
    'cordovajs_path': '',
    'cordovajs_src_path': 'getCordovaJsSrc',
    'update_from_config': '',
    'update_project': 'updateProject',
    'update_www': 'updateWww',
    'www_dir': 'getWwwDir'
};

var HANDLER_PUBLIC_METHODS = {
    'package_name': 'getPackageName',
    'parseProjectFile': '',
    'purgeProjectFileCache': ''
};

// A single class that exposes functionality from platform specific files from
// both places cordova/metadata and plugman/platforms. Hopefully, to be soon
// replaced by real unified platform specific classes.
function BasePlatformApi(platform, platformRootDir) {
    this.root = platformRootDir;
    this.platform = platform;
}

/**
 * Gets a platform handler (former 'parser') for this project's platform.
 * Platform can provide it's own implementation for PlatformHandler by
 * exposing PlatformApi.PlatformHandler constructor. If platform doesn't
 * provides its own implementation, then embedded PlatformHandler will be used.
 * (Taken from platformConfig.json/<platform>/parser_file field)
 *
 * @return {PlatformHandler} Instance of PlatformHandler class that exposes
 *                                    platform-related functionality for cordova.
 */
BasePlatformApi.prototype.getPlatformHandler = function() {
    if (!this._platformHandler) {
        // Default PlatformHandler
        var PlatformHandler = BasePlatformHandler;
        var PlatformHandlerImpl;

        // Try find whether platform exposes its' API via js module
        var platformApiModule = path.join(this.root, 'cordova', 'Api.js');
        if (fs.existsSync(platformApiModule)) {
            PlatformHandlerImpl = require(platformApiModule).PlatformHandler;
        }

        if (!PlatformHandlerImpl) {
            // If platform doesn't provide Platformhandler, use embedded one for current platform
            PlatformHandlerImpl = require(platforms[this.platform].parser_file);
        }

        // Extend BasePlatformApi with platform implementation.
        // We need to provide PARSER_PUBLIC_METHODS as mapping object to maintain backward compat
        // between legacy parsers' methods and methods, exposed by PlatformHandler class.
        // TODO: Remove PARSER_PUBLIC_METHODS parameter after transition to PlatformHandler usage.
        PlatformHandler = inherit(PlatformHandlerImpl, BasePlatformHandler, PARSER_PUBLIC_METHODS);
        this._platformHandler = new PlatformHandler(this.root);
    }

    return this._platformHandler;
};

/**
 * Gets a plugin handler (former 'handler') for this project's platform.
 * Platform can provide it's own implementation for PluginHandler by
 * exposing PlatformApi.PluginHandler constructor. If platform doesn't
 * provides its own implementation, then embedded PluginHandler will be used.
 * (Taken from platformConfig.json/<platform>/handler_file field)
 *
 * @return {PluginHandler} Instance of PluginHandler class that exposes
 *                                  platform-related functionality for cordova.
 */
BasePlatformApi.prototype.getPluginHandler = function() {
    if (!this._pluginHandler) {
        var PluginHandler = BasePluginHandler;
        var PluginHandlerImpl;

        // Try find whether platform exposes its' API via js module
        var platformApiModule = path.join(this.root, 'cordova', 'Api.js');
        if (fs.existsSync(platformApiModule)) {
            PluginHandlerImpl = require(platformApiModule).PluginHandler;
        }

        if (!PluginHandlerImpl) {
            // If platform doesn't provide PluginHandler, use embedded one for current platform
            // The platform implementation, shipped with cordova-lib, isn't constructable so
            // we need to create a dummy class and copy implementation to its prototype.
            var LegacyPluginHandler = function LegacyPluginHandler () {};
            LegacyPluginHandler.prototype = require(platforms[this.platform].handler_file);
            PluginHandlerImpl = LegacyPluginHandler;
        }

        // Extend BasePlatformApi with platform implementation.
        // We need to provide HANDLER_PUBLIC_METHODS as mapping object to maintain backward compat
        // between legacy handlers' methods and methods, exposed by PluginHandler class.
        // TODO: Remove HANDLER_PUBLIC_METHODS parameter after transition to PluginHandler usage.
        PluginHandler = inherit(PluginHandlerImpl, BasePluginHandler, HANDLER_PUBLIC_METHODS);
        this._pluginHandler = new PluginHandler();
    }

    return this._pluginHandler;
};

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
    if (!platformRootDir) {
        var projectRootDir = util.isCordova();
        platformRootDir = projectRootDir && path.join(projectRootDir, 'platforms', platform);
    }

    if (!platformRootDir) {
        // If platformRootDir is still undefined, then we're probably is not inside of cordova project
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
 * @param  {Object}   compatMap The object that configures mapping of inherited class methods
 *                              from old names to new ones.
 * @return {Function}           The constructor of inherited class.
 */
function inherit(ctor, superCtor, compatMap) {
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
        // If there is compatibility map provided, remap methods of
        // prototype according to that map, so the ctor.<new_name> will point to ctor.<old_name>
        if (compatMap && compatMap[methodName]) {
            var newName = compatMap[methodName];
            ctor.prototype[newName] = ctor.prototype[methodName] = ctorProtoMethods[methodName];
        } else {
            ctor.prototype[methodName] = ctorProtoMethods[methodName];
        }
    }

    return ctor;
}

// BACKWARD COMPATIBILITY SECTION

// Expose all public methods from the parser and handler, properly bound
// and map old-style names to new ones. This is required only for backward
// compatibility and probably should be removed after transition to new
// PlatformApi will be completed.
// TODO: This could be removed once all old methods' usages will be replaced

// Need to iterate through PARSER_PUBLIC_METHODS this way to avoid common closure problems.
Object.keys(PARSER_PUBLIC_METHODS).forEach(function (methodName) {
    var newName = PARSER_PUBLIC_METHODS[methodName];
    BasePlatformApi.prototype[methodName] = function () {
        var platformHandler = this.getPlatformHandler();
        var handlerMethod = platformHandler[newName] || platformHandler[methodName];
        if (handlerMethod) {
            return handlerMethod.apply(platformHandler, arguments);
        }
    };
});

Object.keys(HANDLER_PUBLIC_METHODS).forEach(function (methodName) {
    var newName = HANDLER_PUBLIC_METHODS[methodName];
    BasePlatformApi.prototype[methodName] = function () {
        var pluginHandler = this.getPluginHandler();
        var handlerMethod = pluginHandler[newName] || pluginHandler[methodName];
        if (handlerMethod) {
            return handlerMethod.apply(pluginHandler, arguments);
        }
    };
});

// These props are left for backward compatibility. The proper way to
// get platform/plugin handlers - use getPlatformHandler/getPluginHandler methods
// TODO: Remove this after migrating to PlatformHandler/PluginHandler usage.
Object.defineProperty(BasePlatformApi.prototype, 'parser', {
    get: function () { return this.getPlatformHandler(); }
});

Object.defineProperty(BasePlatformApi.prototype, 'handler', {
    get: function () { return this.getPluginHandler(); }
});
