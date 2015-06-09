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

var path              = require('path'),
    cordova_util      = require('./util'),
    HooksRunner       = require('../hooks/HooksRunner'),
    events            = require('../events'),
    chain             = require('../util/promise-util').Q_chainmap,
    superspawn        = require('./superspawn');

// Returns a promise.
module.exports = function clean(options) {
    var projectRoot = cordova_util.cdProjectRoot();
    options = cordova_util.preProcessOptions(options);

    var hooksRunner = new HooksRunner(projectRoot);
    return hooksRunner.fire('before_clean', options)
    .then(function () {
        return chain(options.platforms, function (platform) {
            events.emit('verbose', 'Running cleanup for ' + platform + ' platform.');
            var cmd = path.join(projectRoot, 'platforms', platform, 'cordova', 'clean');
            return superspawn.spawn(cmd, options.options, {
                stdio: options.silent ? 'ignore' : 'inherit', // hide script output in silent mode
                printCommand: !!options.verbose,              // print command only if --verbose specified
                chmod: true
            });
        });
    })
    .then(function() {
        return hooksRunner.fire('after_clean', options);
    });
};
