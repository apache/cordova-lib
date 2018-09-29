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

var cordova_util = require('../util');
var CordovaError = require('cordova-common').CordovaError;
var HooksRunner = require('../../hooks/HooksRunner');

module.exports = plugin;
module.exports.add = require('./add');
module.exports.remove = require('./remove');
module.exports.list = require('./list');
module.exports.save = require('./save');

function plugin (command, targets, opts) {
    // CB-10519 wrap function code into promise so throwing error
    // would result in promise rejection instead of uncaught exception
    return Promise.resolve().then(function () {
        var projectRoot = cordova_util.cdProjectRoot();

        // Dance with all the possible call signatures we've come up over the time. They can be:
        // 1. plugin() -> list the plugins
        // 2. plugin(command, Array of targets, maybe opts object)
        // 3. plugin(command, target1, target2, target3 ... )
        // The targets are not really targets, they can be a mixture of plugins and options to be passed to plugman.

        command = command || 'ls';
        targets = targets || [];
        opts = opts || {};
        if (opts.length) {
            // This is the case with multiple targets as separate arguments and opts is not opts but another target.
            targets = Array.prototype.slice.call(arguments, 1);
            opts = {};
        }
        if (!Array.isArray(targets)) {
            // This means we had a single target given as string.
            targets = [targets];
        }
        opts.options = opts.options || [];
        opts.plugins = [];

        var hooksRunner = new HooksRunner(projectRoot);

        // Massage plugin name(s) / path(s)
        if (!targets || !targets.length) {
            // TODO: what if command provided is 'remove' ? shouldnt search need a target too?
            if (command === 'add' || command === 'rm') {
                return Promise.reject(new CordovaError('You need to qualify `' + cordova_util.binname + ' plugin add` or `' + cordova_util.binname + ' plugin remove` with one or more plugins!'));
            } else {
                targets = [];
            }
        }

        // Split targets between plugins and options
        // Assume everything after a token with a '-' is an option
        for (var i = 0; i < targets.length; i++) {
            if (targets[i].match(/^-/)) {
                opts.options = targets.slice(i);
                break;
            } else {
                opts.plugins.push(targets[i]);
            }
        }

        switch (command) {
        case 'add':
            return module.exports.add(projectRoot, hooksRunner, opts);
        case 'rm':
        case 'remove':
            return module.exports.remove(projectRoot, targets, hooksRunner, opts);
        case 'save':
            // save the versions/folders/git-urls of currently installed plugins into config.xml
            return module.exports.save(projectRoot, opts);
        default:
            return module.exports.list(projectRoot, hooksRunner);
        }
    });
}
