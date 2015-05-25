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

/* jshint sub:true */

'use strict';

var path = require('path');
var shell = require('shelljs');
var util = require('../util');
var ParserHelper = require('./parserhelper/ParserHelper');

/**
 * Base module for platform parsers
 *
 * @param {String} [platform]    Platform name (e.g. android)
 * @param {String} [projectPath] path/to/platform/project
 */
function PlatformHandler (platform, projectPath) {

    this.platform = platform || '';
    this.root = this.path = projectPath || '';

    // Extend with a ParserHelper instance
    Object.defineProperty(this, 'helper', {
        value: new ParserHelper(this.platform),
        enumerable: true,
        configurable: false,
        writable: false
    });
}

/**
 * Base implementation for getConfigXml. Assumes that config.xml
 * is being placed at the root of project.
 * @return {String} Path to platform's config.xml file
 */
PlatformHandler.prototype.getConfigXml = function() {
    return  path.join(this.root, 'config.xml');
};

/**
 * Base implementation for getWwwDir. Assumes that
 * www directory is being placed at the root of project.
 * @return {String} Path to platform's www directory.
 */
PlatformHandler.prototype.getWwwDir = function() {
    return  path.join(this.root, 'www');
};

/**
 * Base implementation for getCordovaJsSrc. Assumes that cordova.js
 * source is being placed at the root of platform's source dir.
 * @return {String} Path to platform's 'cordova-js-src' folder.
 */
PlatformHandler.prototype.getCordovaJsSrc = function(platformSource) {
    return path.resolve(platformSource, 'cordova-js-src');
};

/**
 * Base implementation for updateWww.
 */
PlatformHandler.prototype.updateWww = function() {
    var projectRoot = util.isCordova(this.root);
    var appWww = util.projectWww(projectRoot);
    var platformWww = path.join(this.root, 'platform_www');

    // Clear the www dir
    shell.rm('-rf', this.getWwwDir());
    shell.mkdir(this.getWwwDir());
    // Copy over all app www assets
    shell.cp('-rf', path.join(appWww, '*'), this.getWwwDir());
    // Copy over stock platform www assets (cordova.js)
    shell.cp('-rf', path.join(platformWww, '*'), this.getWwwDir());
};

/**
 * Base implementation for updateProject. Does nothing
 * since implementation is heavily depends on platform specifics.
 * Always should be overridden by platform.
 */
PlatformHandler.prototype.updateProject = function() { };


// Renaming these methods to have more js-style naming.
// To make transition from old names to new ones we're creating a mappings old->new
// TODO: This could be removed once all old methods' usages will be replaced
var COMPAT_MAP = {
    // old name            new name
    'config_xml'        : 'getConfigXml',
    'www_dir'           : 'getWwwDir',
    'cordovajs_src_path': 'getCordovaJsSrc',
    'update_www'        : 'updateWww',
    'update_project'    : 'updateProject'
};

for (var oldName in COMPAT_MAP) {
    var newName = COMPAT_MAP[oldName];
    // Bind old-style handler methods to new ones to maintain compatibility
    PlatformHandler.prototype[oldName] = PlatformHandler.prototype[newName].bind(PlatformHandler.prototype);
}

module.exports = PlatformHandler;
