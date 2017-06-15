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

var semver = require('semver');
var cordova_util = require('../util');
var ConfigParser = require('cordova-common').ConfigParser;
var platformMetadata = require('../platform_metadata');

module.exports = save;
module.exports.getSpecString = getSpecString;

function save (hooksRunner, projectRoot, opts) {
    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);

    // First, remove all platforms that are already in config.xml
    cfg.getEngines().forEach(function (engine) {
        cfg.removeEngine(engine.name);
    });

    // Save installed platforms into config.xml
    return platformMetadata.getPlatformVersions(projectRoot).then(function (platformVersions) {
        platformVersions.forEach(function (platVer) {
            cfg.addEngine(platVer.platform, module.exports.getSpecString(platVer.version));
        });
        cfg.write();
    });
}

function getSpecString (spec) {
    var validVersion = semver.valid(spec, true);
    return validVersion ? '~' + validVersion : spec;
}
