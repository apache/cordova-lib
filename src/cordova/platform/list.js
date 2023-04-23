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

const events = require('cordova-common').events;
const cordova_util = require('../util');
const platforms = require('../../platforms');

module.exports = list;
module.exports.addDeprecatedInformationToPlatforms = addDeprecatedInformationToPlatforms;

function list (hooksRunner, projectRoot, opts) {
    return hooksRunner.fire('before_platform_ls', opts)
        .then(function () {
            return cordova_util.getInstalledPlatformsWithVersions(projectRoot);
        }).then(function (platformMap) {
            // Exrtacted the installed platforms
            const installed = Object.keys(platformMap)
                .map(p => platformMap[p] ? p + ' ' + platformMap[p] : p)
                .sort();
            const installedResult = addDeprecatedInformationToPlatforms(installed).join('\n  ');
            events.emit('results', `Installed platforms:\n  ${installedResult}`);

            // Get the avaliable platforms excluding the installed ones
            const available = platforms.list
                .filter(platforms.hostSupports)
                .filter(p => !platformMap[p])
                .sort();
            const availableResult = addDeprecatedInformationToPlatforms(available).join('\n  ');
            events.emit('results', `Available platforms:\n  ${availableResult}`);
        }).then(function () {
            return hooksRunner.fire('after_platform_ls', opts);
        });
}

function addDeprecatedInformationToPlatforms (platformsList) {
    platformsList = platformsList.map(function (p) {
        const platformKey = p.split(' ')[0]; // Remove Version Information
        // allow for 'unknown' platforms, which will not exist in platforms
        if ((platforms.info[platformKey] || {}).deprecated) {
            p = p.concat(' ', '(deprecated)');
        }
        return p;
    });
    return platformsList;
}
