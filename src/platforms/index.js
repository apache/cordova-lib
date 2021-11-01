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
const fs = require('fs-extra');
const util = require('../cordova/util');
const platforms = require('./platformsConfig.json');
const events = require('cordova-common').events;

// Avoid loading the same platform projects more than once (identified by path)
const cachedApis = {};

// getPlatformApi() should be the only method of instantiating the
// PlatformProject classes for now.
function getPlatformApi (platform, platformRootDir) {
    // if platformRootDir is not specified, try to detect it first
    if (!platformRootDir) {
        const projectRootDir = util.isCordova();
        platformRootDir = projectRootDir && path.join(projectRootDir, 'platforms', platform);
    }
    if (!platformRootDir) {
        // If platformRootDir is still undefined, then we're probably is not inside of cordova project
        throw new Error('Current location is not a Cordova project');
    }
    // CB-11174 Resolve symlinks first before working with root directory
    platformRootDir = util.convertToRealPathSafe(platformRootDir);

    // Make sure the platforms/platform folder exists
    if (!fs.existsSync(platformRootDir)) {
        throw new Error('The platform "' + platform + '" does not appear to have been added to this project.');
    }

    let platformApi;
    const cached = cachedApis[platformRootDir];
    const libDir = path.join(platformRootDir, 'cordova', 'Api.js');
    if (cached && cached.platform === platform) {
        platformApi = cached;
    } else {
        const PlatformApi = util.getPlatformApiFunction(libDir, platform);
        platformApi = new PlatformApi(platform, platformRootDir, events);
        cachedApis[platformRootDir] = platformApi;
    }
    return platformApi;
}

// Used to prevent attempts of installing platforms that are not supported on
// the host OS. E.g. ios on linux.
function hostSupports (platform) {
    const { hostos } = platforms[platform] || {};
    return !hostos || hostos.includes(process.platform);
}

module.exports = {
    getPlatformApi,
    hostSupports,
    info: platforms,
    list: Object.keys(platforms)
};
