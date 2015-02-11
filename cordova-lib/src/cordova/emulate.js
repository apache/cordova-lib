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

var cordova_util      = require('./util'),
    path              = require('path'),
    HooksRunner            = require('../hooks/HooksRunner'),
    superspawn        = require('./superspawn'),
    Q                 = require('q');

// Returns a promise.
module.exports = function emulate(options) {
    var projectRoot = cordova_util.cdProjectRoot();
    options = cordova_util.preProcessOptions(options);

    var hooksRunner = new HooksRunner(projectRoot);
    return hooksRunner.fire('before_emulate', options)
    .then(function() {
        // Run a prepare first!
        return require('./cordova').raw.prepare(options.platforms);
    }).then(function() {
        // Deploy in parallel (output gets intermixed though...)
        return Q.all(options.platforms.map(function(platform) {
            var cmd = path.join(projectRoot, 'platforms', platform, 'cordova', 'run');
            var args = ['--emulator'].concat(options.options);

            return superspawn.spawn(cmd, args, {stdio: 'inherit', printCommand: true});
        }));
    }).then(function() {
        return hooksRunner.fire('after_emulate', options);
    });
};
