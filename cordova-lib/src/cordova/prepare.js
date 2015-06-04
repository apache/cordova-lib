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
    platforms         = require('../platforms/platforms'),
    HooksRunner       = require('../hooks/HooksRunner'),
    events            = require('../events'),
    Q                 = require('q'),
    plugman           = require('../plugman/plugman'),
    PlatformMunger    = require('../plugman/util/config-changes').PlatformMunger,
    PlatformJson      = require('../plugman/util/PlatformJson'),
    restore           = require('./restore-util');


var PluginInfoProvider = require('../PluginInfoProvider');

// Returns a promise.
exports = module.exports = prepare;
function prepare(options) {
    var projectRoot = cordova_util.cdProjectRoot();
    var projectWww = cordova_util.projectWww(projectRoot);
    var projectConfig = cordova_util.projectConfig(projectRoot);

    if (!options) {
        options = {
            verbose: false,
            platforms: [],
            options: []
        };
    }

    var hooksRunner = new HooksRunner(projectRoot);
    return hooksRunner.fire('before_prepare', options)
    .then(function(){
        return restore.installPlatformsFromConfigXML(options.platforms);
    })
    .then(function(){
        options = cordova_util.preProcessOptions(options);
        options.paths = options.platforms.map(function(p) {
            var platform_path = path.join(projectRoot, 'platforms', p);
            return platforms.getPlatformApi(p, platform_path).getWwwDir();
        });
    })
    .then(function() {
        var pluginInfoProvider = new PluginInfoProvider();
        // Iterate over each added platform
        return Q.all(options.platforms.map(function(platform) {
            var platformPath = path.join(projectRoot, 'platforms', platform);
            var platformApi = platforms.getPlatformApi(platform, platformPath);

            return platformApi.updateWww(projectWww)
            .then(function () {
                return platformApi.updateConfig(projectConfig);
            }).then(function () {
                // Call plugman --prepare for this platform. sets up js-modules appropriately.
                var plugins_dir = path.join(projectRoot, 'plugins');
                var platformPath = path.join(projectRoot, 'platforms', platform);
                events.emit('verbose', 'Calling plugman.prepare for platform "' + platform + '"');

                if (options.browserify) {
                    plugman.prepare = require('../plugman/prepare-browserify');
                }
                plugman.prepare(platformPath, platform, plugins_dir, null, true, pluginInfoProvider);

                // Make sure that config changes for each existing plugin is in place
                var platformJson = PlatformJson.load(plugins_dir, platform);
                var munger = new PlatformMunger(platform, platformPath, plugins_dir, platformJson, pluginInfoProvider);
                munger.reapply_global_munge();
                munger.save_all();
            }).then(function () {
                return platformApi.updateProject(projectConfig);
            });
        }));
    }).then(function() {
        return hooksRunner.fire('after_prepare', options);
    }).then(function () {
        return restore.installPluginsFromConfigXML(options);
    });
}
