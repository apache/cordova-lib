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

var path = require('path');
var fs = require('fs');
var util = require('../cordova/util');
var platforms = require('./platformsConfig.json');
var events = require('cordova-common').events;

// Avoid loading the same platform projects more than once (identified by path)
var cachedApis = {};

// getPlatformApi() should be the only method of instantiating the
// PlatformProject classes for now.
function getPlatformApi (platform, platformRootDir) {
    // if platformRootDir is not specified, try to detect it first
    if (!platformRootDir) {
        var projectRootDir = util.isCordova();
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

    var platformApi;
    var cached = cachedApis[platformRootDir];
    var libDir = path.join(platformRootDir, 'cordova', 'Api.js');
    if (cached && cached.platform === platform) {
        platformApi = cached;
    } else {
        var pApi = util.getPlatformApiFunction(libDir, platform);
        platformApi = new pApi(platform, platformRootDir, events); // eslint-disable-line new-cap
        cachedApis[platformRootDir] = platformApi;
    }
    return platformApi;
}

module.exports = platforms;

// We don't want these methods to be enumerable on the platforms object, because we expect enumerable properties of the
// platforms object to be platforms.
Object.defineProperties(module.exports, {
    'getPlatformApi': {value: getPlatformApi, configurable: true, writable: true}
});
