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

const path = require('path');
const { CordovaError } = require('cordova-common');

/**
 * Creates hook script context
 * @constructor
 * @param {String} hook The hook type
 * @param {Object} opts Hook options
 * @returns {Object} */
function Context (hook, opts) {
    this.hook = hook;

    // create new object, to avoid affecting input opts in other places
    // For example context.opts.plugin = Object is done, then it affects by reference
    this.opts = Object.assign({}, opts);
    this.cmdLine = process.argv.join(' ');

    // Lazy-load cordova to avoid cyclical dependency
    Object.defineProperty(this, 'cordova', {
        get () { return this.requireCordovaModule('cordova-lib').cordova; }
    });
}

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
    const [pkg, ...pkgPath] = modulePath.split('/');

    if (!pkg.match(/^cordova-[^/]+/)) {
        throw new CordovaError(
            `Using "requireCordovaModule" to load non-cordova module ` +
            `"${modulePath}" is not supported. Instead, add this module to ` +
            `your dependencies and use regular "require" to load it.`
        );
    }

    // We can only resolve `cordova-lib` by name if this module is installed as
    // a dependency of the current main module (e.g. when running `cordova`).
    // To handle `cordova-lib` paths correctly in all other cases too, we
    // require them using relative paths.
    return pkg === 'cordova-lib'
        ? require(path.posix.join('../..', ...pkgPath))
        : require(modulePath);
};

module.exports = Context;
