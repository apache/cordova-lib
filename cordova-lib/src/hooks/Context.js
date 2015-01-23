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

/**
 * Creates hook script context
 * @constructor
 * @param {String} hook The hook type
 * @param {Object} opts Hook options
 * @returns {Object} */
function Context(hook, opts) {
    var prop;
    this.hook = hook;

    //create new object, to avoid affecting input opts in other places
    //For example context.opts.plugin = Object is done, then it affects by reference
    this.opts = {};
    for (prop in opts) {
    if (opts.hasOwnProperty(prop)) {
        this.opts[prop] = opts[prop];
      }
    }
    this.cmdLine =  process.argv.join(' ');
    this.cordova = require('../cordova/cordova');
}


/**
 * Returns a required module
 * @param {String} path Module path
 * @returns {Object} */
Context.prototype.requireCordovaModule = function (path) {
    return require(path);
};

module.exports = Context;
