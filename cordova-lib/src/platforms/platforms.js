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

var platforms = require('./platformsConfig.json');

// Remove this block soon. The parser property is no longer used in
// cordova-lib but some downstream tools still use it.
var addModuleProperty = require('../cordova/util').addModuleProperty;
Object.keys(platforms).forEach(function(key) {
    var obj = platforms[key];
    if (obj.parser_file) {
        addModuleProperty(module, 'parser', obj.parser_file, false, obj);
    }
});


// Avoid loading the same platform projects more than once (identified by path)
var cachedProjects = {};

var PARSER_PUBLIC_METHODS = [
    'config_xml',
    'cordovajs_path',
    'cordovajs_src_path',
    'update_from_config',
    'update_project',
    'update_www',
    'www_dir',
];

var HANDLER_PUBLIC_METHODS = [
    'package_name',
    'parseProjectFile',
    'purgeProjectFileCache',
];


// A single class that exposes functionality from platform specific files from
// both places cordova/metadata and plugman/platforms. Hopefully, to be soon
// replaced by real unified platform specific classes.
function PlatformProjectAdapter(platform, platformRootDir) {
    var self = this;
    self.root = platformRootDir;
    self.platform = platform;
    var ParserConstructor = require(platforms[platform].parser_file);
    self.parser = new ParserConstructor(platformRootDir);
    self.handler = require(platforms[platform].handler_file);

    // Expose all public methods from the parser and handler, properly bound.
    PARSER_PUBLIC_METHODS.forEach(function(method) {
        self[method] = self.parser[method].bind(self.parser);
    });

    HANDLER_PUBLIC_METHODS.forEach(function(method) {
        if (self.handler[method]) {
            self[method] = self.handler[method].bind(self.handler);
        }
    });

    self.getInstaller = function(type) {
        function installWrapper(item, plugin_dir, plugin_id, options, project) {
            self.handler[type].install(item, plugin_dir, self.root, plugin_id, options, project);
        }
        return installWrapper;
    };

    self.getUninstaller = function(type) {
        function uninstallWrapper(item, plugin_id, options, project) {
            self.handler[type].uninstall(item, self.root, plugin_id, options, project);
        }
        return uninstallWrapper;
    };
}

// getPlatformProject() should be the only method of instantiating the
// PlatformProject classes for now.
function getPlatformProject(platform, platformRootDir) {
    var cached = cachedProjects[platformRootDir];
    if (cached && cached.platform == platform) {
        return cachedProjects[platformRootDir];
    } else if (platforms[platform]) {
        var adapter = new PlatformProjectAdapter(platform, platformRootDir);
        cachedProjects[platformRootDir] = adapter;
        return adapter;
    } else {
        throw new Error('Unknown platform ' + platform);
    }
}

module.exports = platforms;

// We don't want these methods to be enumerable on the platforms object, because we expect enumerable properties of the
// platforms object to be platforms.
Object.defineProperties(module.exports, {
    'getPlatformProject': {value: getPlatformProject, configurable: true, writable: true},
    'PlatformProjectAdapter': {value: PlatformProjectAdapter, configurable: true, writable: true}
});
