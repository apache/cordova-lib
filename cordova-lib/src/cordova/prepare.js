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
    ConfigParser      = require('../configparser/ConfigParser'),
    platforms         = require('../platforms/platforms'),
    HooksRunner       = require('../hooks/HooksRunner'),
    Q                 = require('q'),
    restore           = require('./restore-util'),
    path              = require('path'),
    browserify = require('../plugman/browserify'),
    config            = require('./config');

// Returns a promise.
exports = module.exports = prepare;
function prepare(options) {
    var projectRoot = cordova_util.cdProjectRoot();
    var config_json = config.read(projectRoot);
    options = options || { verbose: false, platforms: [], options: [] };

    var hooksRunner = new HooksRunner(projectRoot);
    return hooksRunner.fire('before_prepare', options)
    .then(function(){
        return restore.installPlatformsFromConfigXML(options.platforms, { searchpath : options.searchpath });
    })
    .then(function(){
        options = cordova_util.preProcessOptions(options);
        var paths = options.platforms.map(function(p) {
            var platform_path = path.join(projectRoot, 'platforms', p);
            return platforms.getPlatformApi(p, platform_path).getPlatformInfo().locations.www;
        });
        options.paths = paths;
    })
    .then(function() {
        options = cordova_util.preProcessOptions(options);
        options.searchpath = options.searchpath || config_json.plugin_search_path;
        // Iterate over each added platform
        return preparePlatforms(options.platforms, projectRoot, options);
    }).then(function() {
        options.paths = options.platforms.map(function(platform) {
            return platforms.getPlatformApi(platform).getPlatformInfo().locations.www;
        });
        return hooksRunner.fire('after_prepare', options);
    }).then(function () {
        return restore.installPluginsFromConfigXML(options);
    });
}

/**
 * Calls `platformApi.prepare` for each platform in project
 *
 * @param   {string[]}  platformList  List of platforms, added to current project
 * @param   {string}    projectRoot   Project root directory
 *
 * @return  {Promise}
 */
function preparePlatforms (platformList, projectRoot, options) {
    return Q.all(platformList.map(function(platform) {
        // TODO: this need to be replaced by real projectInfo
        // instance for current project.
        var project = {
            root: projectRoot,
            projectConfig: new ConfigParser(cordova_util.projectConfig(projectRoot)),
            locations: {
                plugins: path.join(projectRoot, 'plugins'),
                www: cordova_util.projectWww(projectRoot)
            }
        };

        // platformApi prepare takes care of all functionality
        // which previously had been executed by cordova.prepare:
        //   - reset config.xml and then merge changes from project's one,
        //   - update www directory from project's one and merge assets from platform_www,
        //   - reapply config changes, made by plugins,
        //   - update platform's project
        // Please note that plugins' changes, such as installes js files, assets and
        // config changes is not being reinstalled on each prepare.
        var platformApi = platforms.getPlatformApi(platform);
        return platformApi.prepare(project)
        .then(function () {
            if (options.browserify)
                return browserify(project, platformApi);
        });
    }));
}

module.exports.preparePlatforms = preparePlatforms;
