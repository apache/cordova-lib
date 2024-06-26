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

const path = require('node:path');
const execa = require('execa');
const cordova_util = require('./util');
const events = require('cordova-common').events;

function handleError (error) {
    if (error.code === 'ENOENT') {
        events.emit('warn', 'Platform does not support ' + this.script);
    } else {
        events.emit('warn', 'An unexpected error has occured while running ' + this.script +
            ':\n' + error.message);
    }
}

function displayDevices (projectRoot, platform, options) {
    const caller = { script: 'list-devices' };
    events.emit('log', 'Available ' + platform + ' devices:');
    const cmd = path.join(projectRoot, 'platforms', platform, 'cordova', 'lib', 'list-devices');
    return execa(cmd, options.argv, { stdio: 'inherit' }).then(data => data.stdout, handleError.bind(caller));
}

function displayVirtualDevices (projectRoot, platform, options) {
    const caller = { script: 'list-emulator-images' };
    events.emit('log', 'Available ' + platform + ' virtual devices:');
    const cmd = path.join(projectRoot, 'platforms', platform, 'cordova', 'lib', 'list-emulator-images');
    return execa(cmd, options.argv, { stdio: 'inherit' }).then(data => data.stdout, handleError.bind(caller));
}

module.exports = function targets (options) {
    const projectRoot = cordova_util.cdProjectRoot();
    options = cordova_util.preProcessOptions(options);

    let result = Promise.resolve();
    options.platforms.forEach(function (platform) {
        if (options.options.device) {
            result = result.then(displayDevices.bind(null, projectRoot, platform, options.options));
        } else if (options.options.emulator) {
            result = result.then(displayVirtualDevices.bind(null, projectRoot, platform, options.options));
        } else {
            result = result.then(displayDevices.bind(null, projectRoot, platform, options.options))
                .then(displayVirtualDevices.bind(null, projectRoot, platform, options.options));
        }
    });

    return result;
};
