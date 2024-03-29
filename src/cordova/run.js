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
const { events } = require('cordova-common');
const HooksRunner = require('../hooks/HooksRunner');
const platform_lib = require('../platforms/platforms');
const cordovaPrepare = require('./prepare');

// Support for listing targets.
const targets = require('./targets');

// Returns a promise.
module.exports = function run (options = {}) {
    const { options: cliArgs } = options;

    if (cliArgs?.list) {
        const { platforms } = options;

        if (platforms.length <= 0) {
            events.emit('warn', 'A platform must be provided when using the "--list" flag.');
            return false;
        }

        return Promise.resolve(platforms.map(function (platform) {
            const platformApi = platform_lib.getPlatformApi(platform);

            if (platformApi?.listTargets) {
                // Use Platform's API to fetch target list when available
                return platformApi.listTargets(options);
            } else {
                events.emit('warn', 'Please update to the latest platform release to ensure uninterrupted fetching of target lists.');
                // fallback to original method.
                return targets(options);
            }
        }));
    }

    return Promise.resolve().then(function () {
        const projectRoot = cordova_util.cdProjectRoot();
        options = cordova_util.preProcessOptions(options);

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
