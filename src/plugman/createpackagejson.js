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

var PluginInfo = require('cordova-common').PluginInfo;
var events = require('cordova-common').events;
const pify = require('pify');
const initPkgJson = pify(require('init-package-json'));

// returns a promise
function createPackageJson (plugin_path) {
    var pluginInfo = new PluginInfo(plugin_path);

    var defaults = {
        id: pluginInfo.id,
        version: pluginInfo.version,
        description: pluginInfo.description,
        license: pluginInfo.license,
        keywords: pluginInfo.getKeywordsAndPlatforms(),
        repository: pluginInfo.repo,
        engines: pluginInfo.getEngines(),
        platforms: pluginInfo.getPlatformsArray()
    };

    var initFile = require.resolve('./init-defaults');
    return initPkgJson(plugin_path, initFile, defaults)
        .then(_ => {
            events.emit('verbose', 'Package.json successfully created');
        });
}

module.exports = createPackageJson;
