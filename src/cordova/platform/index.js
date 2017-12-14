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

var Q = require('q');
var cordova_util = require('../util');
var HooksRunner = require('../../hooks/HooksRunner');
var CordovaError = require('cordova-common').CordovaError;
var platforms = require('../../platforms/platforms');
var addHelper = require('./addHelper');

module.exports = platform;

module.exports.add = function add (hooksRunner, projectRoot, targets, opts) {
    return addHelper('add', hooksRunner, projectRoot, targets, opts);
};
module.exports.update = function update (hooksRunner, projectRoot, targets, opts) {
    return addHelper('update', hooksRunner, projectRoot, targets, opts);
};
module.exports.remove = require('./remove');
module.exports.check = require('./check');
module.exports.list = require('./list');
module.exports.getPlatformDetailsFromDir = require('./getPlatformDetailsFromDir');

// Expose the platform parsers on top of this command
for (var p in platforms) {
    module.exports[p] = platforms[p];
}

/**
 * Handles all cordova platform commands.
 * @param {string} command - Command to execute (add, rm, ls, update, save)
 * @param {Object[]} targets - Array containing platforms to execute commands on
 * @param {Object} opts
 * @returns {Promise}
 */
function platform (command, targets, opts) {
    // CB-10519 wrap function code into promise so throwing error
    // would result in promise rejection instead of uncaught exception
    return Q().then(function () {
        var msg;
        var projectRoot = cordova_util.cdProjectRoot();
        var hooksRunner = new HooksRunner(projectRoot);

        if (arguments.length === 0) command = 'ls';

        if (targets && !(targets instanceof Array)) targets = [targets];

        // TODO: wouldn't update need a platform, too? what about save?
        if ((command === 'add' || command === 'rm' || command === 'remove') && (!targets || (targets instanceof Array && targets.length === 0))) {
            msg = 'You need to qualify `' + command + '` with one or more platforms!';
            return Q.reject(new CordovaError(msg));
        }

        opts = opts || {};
        opts.platforms = targets;
        switch (command) {
        case 'add':
            return module.exports.add(hooksRunner, projectRoot, targets, opts);
        case 'rm':
        case 'remove':
            return module.exports.remove(hooksRunner, projectRoot, targets, opts);
        case 'update':
        case 'up':
            return module.exports.update(hooksRunner, projectRoot, targets, opts);
        case 'check':
            return module.exports.check(hooksRunner, projectRoot);
        default:
            return module.exports.list(hooksRunner, projectRoot, opts);
        }
    });
}
