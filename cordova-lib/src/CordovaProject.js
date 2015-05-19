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

var fs           = require('fs');
var path         = require('path');
var cordova_util = require('./cordova/util');
var PlatformApi  = require('./platforms/PlatformApi');
var knownPlatforms = require('./platforms/platforms');

var CordovaError  = require('./CordovaError');

function CordovaProject (projectRoot) {
    this.root = path.resolve(cordova_util.isCordova(projectRoot));
}

CordovaProject.prototype.getPlatformApi = function(platform) {
    if (this.platforms.indexOf(platform) < 0) {
        throw new CordovaError('Current project doesn\'t contain platform ' + platform);
    }

    return PlatformApi.getPlatformApi(platform);
};

Object.defineProperty(CordovaProject.prototype, 'platforms', {
    get: function () {
        var platforms_dir = path.join(this.root, 'platforms');
        if ( !fs.existsSync(platforms_dir)) {
            return [];
        }
        var subdirs = fs.readdirSync(platforms_dir);
        return subdirs.filter(function(p) {
            return Object.keys(knownPlatforms).indexOf(p) > -1;
        });
    }
});

module.exports = CordovaProject;
