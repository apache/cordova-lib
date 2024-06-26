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
const CordovaError = require('cordova-common').CordovaError;
const events = require('cordova-common').events;
const cordova_util = require('../util');
const platforms = require('../../platforms/platforms');

module.exports = getPlatformDetailsFromDir;
module.exports.platformFromName = platformFromName;

// Gets platform details from a directory
function getPlatformDetailsFromDir (dir, platformIfKnown) {
    const libDir = path.resolve(dir);
    let platform;
    let version;

    // console.log("getPlatformDetailsFromDir : ", dir, platformIfKnown, libDir);

    try {
        const pkgPath = path.join(libDir, 'package.json');
        const pkg = cordova_util.requireNoCache(pkgPath);
        platform = module.exports.platformFromName(pkg.name);
        version = pkg.version;
    } catch (e) {
        return Promise.reject(new CordovaError('The provided path does not seem to contain a valid package.json or a valid Cordova platform: ' + libDir));
    }

    // platform does NOT have to exist in 'platforms', but it should have a name, and a version
    if (!version || !platform) {
        return Promise.reject(new CordovaError('The provided path does not seem to contain a ' +
            'Cordova platform: ' + libDir));
    }

    return Promise.resolve({
        libDir,
        platform,
        version
    });
}

/**
 * Removes the cordova- prefix from the platform's name for known platforms.
 * @param {string} name - platform name
 * @returns {string}
 */
function platformFromName (name) {
    let platName = name;
    const platMatch = /^cordova-([a-z0-9-]+)$/.exec(name);
    if (platMatch && (platMatch[1] in platforms)) {
        platName = platMatch[1];
        events.emit('verbose', 'Removing "cordova-" prefix from ' + name);
    }
    return platName;
}
