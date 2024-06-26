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
const cordova_util = require('../util');
const ConfigParser = require('cordova-common').ConfigParser;
const PlatformJson = require('cordova-common').PlatformJson;
const PlatformMunger = require('cordova-common').ConfigChanges.PlatformMunger;
const platforms = require('../../platforms/platforms');

module.exports = preparePlatforms;

/**
 * Calls `platformApi.prepare` for each platform in project
 *
 * @param   {string[]}  platformList  List of platforms, added to current project
 * @param   {string}    projectRoot   Project root directory
 *
 * @return  {Promise}
 */
function preparePlatforms (platformList, projectRoot, options) {
    return Promise.all(platformList.map(function (platform) {
        // TODO: this need to be replaced by real projectInfo
        // instance for current project.
        const project = {
            root: projectRoot,
            projectConfig: new ConfigParser(cordova_util.projectConfig(projectRoot)),
            locations: {
                plugins: path.join(projectRoot, 'plugins'),
                www: cordova_util.projectWww(projectRoot),
                rootConfigXml: cordova_util.projectConfig(projectRoot)
            }
        };
        // platformApi prepare takes care of all functionality
        // which previously had been executed by cordova.prepare:
        //   - reset config.xml and then merge changes from project's one,
        //   - update www directory from project's one and merge assets from platform_www,
        //   - reapply config changes, made by plugins,
        //   - update platform's project
        // Please note that plugins' changes, such as installed js files, assets and
        // config changes is not being reinstalled on each prepare.
        const platformApi = platforms.getPlatformApi(platform);
        return platformApi.prepare(project, Object.assign({}, options))
            .then(function () {
                // Handle edit-config in config.xml
                const platformRoot = path.join(projectRoot, 'platforms', platform);
                const platformJson = PlatformJson.load(platformRoot, platform);
                const munger = new PlatformMunger(platform, platformRoot, platformJson);
                // the boolean argument below is "should_increment"
                munger.add_config_changes(project.projectConfig, true).save_all();
            });
    }));
}
