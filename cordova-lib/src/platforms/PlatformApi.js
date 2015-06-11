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

var Q = require('q'),
    fs = require('fs'),
    path = require('path'),
    shell = require('shelljs'),
    events = require('../events'),
    util = require('../cordova/util'),
    superspawn = require('../cordova/superspawn'),
    platforms = require('./platformsConfig.json'),
    ConfigParser = require('../configparser/ConfigParser');

var BasePluginHandler = require('../plugman/platforms/PluginHandler');
var ParserHelper = require('../cordova/metadata/parserhelper/ParserHelper');

// Avoid loading the same platform projects more than once (identified by path)
var cachedProjects = {};

/**
 * A single class that exposes platform-dependent functionality for cordova and
 * plugman. This class works as a base, and provides some default implementation
 * for that functionality. It should not be instantiated directly, only through
 * 'getPlatformApi' module method.
 * @param  {String} platform        Name of platform. Should be one of names, declared
 *                                  in platformsConfig.json
 * @param  {String} platformRootDir Optional. Path to platform directory. If not provided
 *                                  default value is set to<cordova_project>/platforms/<platform>
 */
function BasePlatformApi(platform, platformRootDir) {
    this.root = platformRootDir;
    this.platform = platform;

    // Parser property of Platform API left for backward compatibility
    // and smooth transition to ne API. It also does the job of requiring
    // and constructing legacy Parser instance, which required for platforms
    // that still stores their code in cordova-lib.
    var parser;
    Object.defineProperty(this, 'parser', {
        get: function () {
            if (parser)return parser;

            var ParserConstructor;
            try {
                ParserConstructor = require(platforms[this.platform].parser_file);
            } catch (e) { }

            // parser === null is the special case which means that we've tried
            // to get embedded platform parser and failed. In this case instead of
            // parser's methods will be called PlatformApi default implementations.
            parser = ParserConstructor ? new ParserConstructor(this.root) : null;
            return parser;
        },
        configurable: true
    });

    // Extend with a ParserHelper instance
    Object.defineProperty(this, 'helper', {
        value: new ParserHelper(this.platform),
        enumerable: true,
        configurable: false,
        writable: false
    });
}

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
        PluginHandler = inherit(PluginHandlerImpl, BasePluginHandler);
        this._pluginHandler = new PluginHandler();
    }

    return this._pluginHandler;
};

/**
 * Gets an installer function, that handles installation for specific type of plugin's files
 * (such as <src-file>, <lib-file>, etc.). Used in plugman only.
 * @param  {String} type Plugin file type (<src-file>, <lib-file>, etc.)
 * @return {Function}    Handler function for file, that accepts the following set of arguments:
 *                               item: corresponding item from plugin.xml file.
 *                                   Could be get by PluginInfo.get* methods.
 *                               plugin_dir: source directory for plugin
 *                               plugin_id: plugin id, such as 'org.apache.cordova.camera'
 *                               options: complex object, passed by plugman.
 *                                   See plugman/install module for reference.
 *                               project: object that represents underlying IDE project for plaform.
 *                                   For Android it's an instance of plugman/util/android-project,
 *                                   for Windows - util/windows/jsprojmanager, etc.
 */
BasePlatformApi.prototype.getInstaller = function(type) {
    var self = this;
    function installWrapper(item, plugin_dir, plugin_id, options, project) {
        self.getPluginHandler()[type].install(item, plugin_dir, self.root, plugin_id, options, project);
    }
    return installWrapper;
};

/**
 * Gets an uninstaller function, that handles uninstallation for specific type of plugin's files
 * (such as <src-file>, <lib-file>, etc.). Used in plugman only.
 * @param  {String} type Plugin file type (<src-file>, <lib-file>, etc.)
 * @return {Function}    Handler function for file, that accepts the following set of arguments:
 *                               item: corresponding item from plugin.xml file.
 *                                   Could be get by PluginInfo.get* methods.
 *                               plugin_id: plugin id, such as 'org.apache.cordova.camera'
 *                               options: complex object, passed by plugman.
 *                                   See plugman/install module for reference.
 *                               project: object that represents underlying IDE project for plaform.
 *                                   For Android it's an instance of plugman/util/android-project,
 *                                   for Windows - util/windows/jsprojmanager, etc.
 */
BasePlatformApi.prototype.getUninstaller = function(type) {
    var self = this;
    function uninstallWrapper(item, plugin_id, options, project) {
        self.getPluginHandler()[type].uninstall(item, self.root, plugin_id, options, project);
    }
    return uninstallWrapper;
};

/**
 * Base implementation for getConfigXml. Assumes that config.xml
 * is placed at the root of project.
 * @return {String} Path to platform's config.xml file
 */
BasePlatformApi.prototype.getConfigXml = function() {
    if (this.parser && this.parser.config_xml) {
        return this.parser.config_xml();
    }

    return  path.join(this.root, 'config.xml');
};

/**
 * Base implementation for updateConfig. Reset platform's config to default.
 * @return {String} Path to platform's config.xml file
 */
BasePlatformApi.prototype.updateConfig = function(optSource) {
    var defaultConfig = path.join(this.root, 'cordova', 'defaults.xml');
    var ownConfig = this.getConfigXml();
    // If defaults.xml is present, overwrite platform config.xml with it
    if (fs.existsSync(defaultConfig)) {
        shell.cp('-f', defaultConfig, ownConfig);
        events.emit('verbose', 'Generating config.xml from defaults for platform "' + this.platform + '"');
    } else {
        shell.cp('-f', ownConfig, defaultConfig);
    }

    // Update platform config.xml based on top level config.xml
    var baseConfig = optSource || util.projectConfig(util.isCordova(this.root));

    var baseCfg = new ConfigParser(baseConfig);
    var ownCfg = new ConfigParser(ownConfig);
    util.mergeXml(baseCfg.doc.getroot(), ownCfg.doc.getroot(), this.platform, true);

    // CB-6976 Windows Universal Apps. For smooth transition and to prevent mass api failures
    // we allow using windows8 tag for new windows platform
    // TODO: this section should be moved to windows platform's implementation of PlatformApi
    if (this.platform == 'windows') {
        util.mergeXml(baseCfg.doc.getroot(), ownCfg.doc.getroot(), 'windows8', true);
    }

    return Q.when(ownCfg.write());
};

/**
 * Base implementation for getWwwDir. Assumes that
 * www directory is placed at the root of project.
 * @return {String} Path to platform's www directory.
 */
BasePlatformApi.prototype.getWwwDir = function() {
    if (this.parser && this.parser.www_dir) {
        return this.parser.www_dir();
    }

    return  path.join(this.root, 'www');
};

/**
 * Base implementation for getCordovaJsSrc. Assumes that cordova.js
 * source is placed at the root of platform's source dir.
 * @return {String} Path to platform's 'cordova-js-src' folder.
 */
BasePlatformApi.prototype.getCordovaJsSrc = function(platformSource) {
    if (this.parser && this.parser.cordovajs_src_path) {
        return this.parser.cordovajs_src_path(platformSource);
    }

    return path.resolve(platformSource, 'cordova-js-src');
};

/**
 * Base implementation for updateWww.
 * @param {string} [wwwSource] Source dir for www files. If not provided, method
 *                             will try to find www directory from cordova project
 */
BasePlatformApi.prototype.updateWww = function(wwwSource) {
    if (this.parser && this.parser.update_www) {
        return Q.when(this.parser.update_www());
    }

    if (!wwwSource) {
        var projectRoot = util.isCordova(this.root);
        wwwSource = util.projectWww(projectRoot);
    }
    var platformWww = path.join(this.root, 'platform_www');

    // Clear the www dir
    shell.rm('-rf', this.getWwwDir());
    shell.mkdir(this.getWwwDir());
    // Copy over all app www assets
    shell.cp('-rf', path.join(wwwSource, '*'), this.getWwwDir());
    // Copy over stock platform www assets (cordova.js)
    runShellSilent(function () {
        shell.cp('-rf', path.join(platformWww, '*'), this.getWwwDir());
    }.bind(this));

    return Q();
};

/**
 * Base implementation for updateProject. Does nothing
 * since implementation is heavily depends on platform specifics.
 * Always should be overridden by platform.
 */
BasePlatformApi.prototype.updateProject = function(configSource) {
    if (this.parser && this.parser.update_project) {
        var configParser = new ConfigParser(configSource || this.getConfigXml());
        return Q.when(this.parser.update_project(configParser));
    }
    return Q();
};

// PLATFORM ACTIONS

/**
 * Default implementation for platform build. Uses executable script shipped with platform to build project.
 * Could be overridden using PlatformApi implementation if it is provided by platform.
 * @param  {Object}  options Complex object that provides cordova API to method
 * @return {Promise}         Promise, either resolve or rejected with error code.
 */
BasePlatformApi.prototype.build = function(options) {
    var cmd = path.join(this.root, 'cordova', 'build');
    return superspawn.spawn(cmd, options.options, { printCommand: options.verbose, stdio: 'inherit', chmod: true });
};

/**
 * Default implementation for platform run. Uses executable script shipped with platform
 * to deploy and run project. Could be overridden using PlatformApi implementation if it
 * is provided by platform.
 * @param  {Object}  options Complex object that provides cordova API to method
 * @return {Promise}         Promise, either resolved or rejected with error code.
 */
BasePlatformApi.prototype.run = function(options) {
    var cmd = path.join(this.root, 'cordova', 'run');
    return superspawn.spawn(cmd, options.options, { printCommand: options.verbose, stdio: 'inherit', chmod: true });
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

/**
 * Method that works like a getter for PlatformApi instance for particular
 * platforms. Creates a new PlatfromApi instance for platform specified or
 * returns cached one. It also handles platform-provided PlatformApi overrides
 * by adding them into newly instantiated class.
 * This method should be the only method of instantiating the PlatformApi class.
 * @param  {String} platform        Name of platform. Should be one of names, declared
 *                                  in platformsConfig.json
 * @param  {String} platformRootDir Optional. Path to platform directory. If not provided
 *                                  default value is set to<cordova_project>/platforms/<platform>
 * @return {PlatformApi}            PlatformApi instance for specified platform.
 */
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

function runShellSilent(callback) {
    var silentstate = shell.config.silent;
    shell.config.silent = true;
    try {
        callback();
    } finally {
        shell.config.silent = silentstate;
    }
}
