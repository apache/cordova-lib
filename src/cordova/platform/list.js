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

var events = require('cordova-common').events;
var cordova_util = require('../util');
var platforms = require('../../platforms/platforms');

module.exports = list;
module.exports.addDeprecatedInformationToPlatforms = addDeprecatedInformationToPlatforms;

function list (hooksRunner, projectRoot, opts) {
    return hooksRunner.fire('before_platform_ls', opts)
        .then(function () {
            return cordova_util.getInstalledPlatformsWithVersions(projectRoot);
        }).then(function (platformMap) {
            var platformsText = [];
            for (var plat in platformMap) {
                platformsText.push(platformMap[plat] ? plat + ' ' + platformMap[plat] : plat);
            }

            platformsText = addDeprecatedInformationToPlatforms(platformsText);
            var results = 'Installed platforms:\n  ' + platformsText.sort().join('\n  ') + '\n';
            var available = Object.keys(platforms).filter(cordova_util.hostSupports);

            available = available.filter(function (p) {
                return !platformMap[p]; // Only those not already installed.
            });

            available = available.map(function (p) {
                return p.concat(' ', platforms[p].version);
            });

            available = addDeprecatedInformationToPlatforms(available);
            results += 'Available platforms: \n  ' + available.sort().join('\n  ');

            events.emit('results', results);
        }).then(function () {
            return hooksRunner.fire('after_platform_ls', opts);
        });
}

function addDeprecatedInformationToPlatforms (platformsList) {
    platformsList = platformsList.map(function (p) {
        var platformKey = p.split(' ')[0]; // Remove Version Information
        // allow for 'unknown' platforms, which will not exist in platforms
        if (platforms[platformKey] && platforms[platformKey].deprecated) {
            p = p.concat(' ', '(deprecated)');
        }
        return p;
    });
    return platformsList;
}
