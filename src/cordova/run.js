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

const cordova_util = require('./util');
const HooksRunner = require('../hooks/HooksRunner');
const platform_lib = require('../platforms/platforms');
const cordovaPrepare = require('./prepare');

// Support for listing targets.
const targets = require('./targets');

// Returns a promise.
module.exports = function run (options) {
    options = cordova_util.preProcessOptions(options);

    const { options: cliArgs, platforms } = options;
    const projectRoot = cordova_util.cdProjectRoot();

    if (cliArgs.list) {
        return Promise.resolve(platforms.map(function (platform) {
            const platformApi = platform_lib.getPlatformApi(platform);

            // @todo enable warning once all platforms known to implement platformApi.listTargets
            // if (!platformApi.listTargets) {
            //     events.emit('warn', 'Please upgrade to the latest platfrom release to ensure the emulator list functionality continues to function in the future.');
            // }

            // If the Platform API object contains the `listTarget` method, call it, else fallback to original.
            return platformApi.listTargets
                ? platformApi.listTargets(options)
                : targets(options, true);
        }));
    }

    return Promise.resolve().then(function () {
        // This is needed as .build modifies opts
        const optsClone = Object.assign({}, options.options);
        optsClone.nobuild = true;

        const hooksRunner = new HooksRunner(projectRoot);
        return hooksRunner.fire('before_run', options)
            .then(function () {
                if (!options.options.noprepare) {
                    // Run a prepare first, then shell out to run
                    return cordovaPrepare(options);
                }
            }).then(function () {
                // Deploy in parallel (output gets intermixed though...)
                return Promise.all(options.platforms.map(function (platform) {
                    const buildPromise = options.options.nobuild
                        ? Promise.resolve()
                        : platform_lib.getPlatformApi(platform).build(options.options);

                    return buildPromise
                        .then(function () {
                            return hooksRunner.fire('before_deploy', options);
                        })
                        .then(function () {
                            return platform_lib.getPlatformApi(platform).run(optsClone);
                        });
                }));
            }).then(function () {
                return hooksRunner.fire('after_run', options);
            });
    });
};
