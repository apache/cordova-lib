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

var cordova_util = require('./util');
var platforms = require('../platforms/platforms');
var HooksRunner = require('../hooks/HooksRunner');
var restore = require('./restore-util');
var path = require('path');

exports = module.exports = prepare;
module.exports.preparePlatforms = require('./prepare/platforms');

function prepare (options) {
    return Promise.resolve().then(function () {
        var projectRoot = cordova_util.cdProjectRoot();
        options = options || { verbose: false, platforms: [], options: {} };
        options.save = options.save || false;
        var hooksRunner = new HooksRunner(projectRoot);
        return hooksRunner.fire('before_prepare', options)
            .then(function () {
                return restore.installPlatformsFromConfigXML(options.platforms, { searchpath: options.searchpath, restoring: true });
            })
            .then(function () {
                options = cordova_util.preProcessOptions(options);
                var paths = options.platforms.map(function (p) {
                    var platform_path = path.join(projectRoot, 'platforms', p);
                    return platforms.getPlatformApi(p, platform_path).getPlatformInfo().locations.www;
                });
                options.paths = paths;
            }).then(function () {
                options = cordova_util.preProcessOptions(options);
                return restore.installPluginsFromConfigXML(options);
            }).then(function () {
                options = cordova_util.preProcessOptions(options);
                // Iterate over each added platform
                return module.exports.preparePlatforms(options.platforms, projectRoot, options);
            }).then(function () {
                options.paths = options.platforms.map(function (platform) {
                    return platforms.getPlatformApi(platform).getPlatformInfo().locations.www;
                });
                return hooksRunner.fire('after_prepare', options);
            });
    });
}
