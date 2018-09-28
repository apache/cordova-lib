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

'use strict';

var path = require('path');
var events = require('cordova-common').events;

/**
 * Creates hook script context
 * @constructor
 * @param {String} hook The hook type
 * @param {Object} opts Hook options
 * @returns {Object} */
function Context (hook, opts) {
    var prop;
    this.hook = hook;

    // create new object, to avoid affecting input opts in other places
    // For example context.opts.plugin = Object is done, then it affects by reference
    this.opts = {};
    for (prop in opts) {
        if (opts.hasOwnProperty(prop)) {
            this.opts[prop] = opts[prop];
        }
    }
    this.cmdLine = process.argv.join(' ');
    this.cordova = require('../cordova/cordova');
}

// As per CB-9834 we need to maintain backward compatibility and provide a compat layer
// for plugins that still require modules, factored to cordova-common.
var compatMap = {
    '../configparser/ConfigParser': function () {
        return require('cordova-common').ConfigParser;
    },
    '../util/xml-helpers': function () {
        return require('cordova-common').xmlHelpers;
    }
};

/**
 * Requires the specified Cordova module.
 *
 * This method should only be used to require packages named `cordova-*`.
 * Public modules of such a Cordova module can be required by giving their
 * full package path: `cordova-foo/bar` for example.
 *
 * @param {String} modulePath   Module path as specified above
 * @returns {*}                 The required Cordova module
 */
Context.prototype.requireCordovaModule = function (modulePath) {
    const pkg = modulePath.split('/')[0];

    if (pkg !== 'cordova-lib') return require(modulePath);

    // We can only resolve `cordova-lib` by name if this module is installed as
    // a dependency of the current main module (e.g. when running `cordova`).
    // To handle `cordova-lib` paths correctly in all other cases too, we
    // resolve them to real paths before requiring them.
    var resolvedPath = path.resolve(__dirname, modulePath.replace(/^cordova-lib/, '../../../cordova-lib'));
    var relativePath = path.relative(__dirname, resolvedPath).replace(/\\/g, '/');
    events.emit('verbose', 'Resolving module name for ' + modulePath + ' => ' + relativePath);

    var compatRequire = compatMap[relativePath];
    if (compatRequire) {
        events.emit('warn', 'The module "' + path.basename(relativePath) + '" has been factored ' +
            'into "cordova-common". Consider update your plugin hooks.');
        return compatRequire();
    }

    return require(relativePath);
};

module.exports = Context;
