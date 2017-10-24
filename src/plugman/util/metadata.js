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

var fs = require('fs-extra');
var path = require('path');

var cachedJson = null;

function getJson (pluginsDir) {
    if (!cachedJson) {
        var fetchJsonPath = path.join(pluginsDir, 'fetch.json');
        if (fs.existsSync(fetchJsonPath)) {
            cachedJson = JSON.parse(fs.readFileSync(fetchJsonPath, 'utf-8'));
        } else {
            cachedJson = {};
        }
    }
    return cachedJson;
}

exports.get_fetch_metadata = function (pluginsDir, pluginId) {
    var metadataJson = getJson(pluginsDir);
    return metadataJson[pluginId] || {};
};

exports.save_fetch_metadata = function (pluginsDir, pluginId, data) {
    var metadataJson = getJson(pluginsDir);
    metadataJson[pluginId] = data;
    var fetchJsonPath = path.join(pluginsDir, 'fetch.json');
    fs.writeFileSync(fetchJsonPath, JSON.stringify(metadataJson, null, 2), 'utf-8');
};

exports.remove_fetch_metadata = function (pluginsDir, pluginId) {
    var metadataJson = getJson(pluginsDir);
    delete metadataJson[pluginId];
    var fetchJsonPath = path.join(pluginsDir, 'fetch.json');
    fs.writeFileSync(fetchJsonPath, JSON.stringify(metadataJson, null, 2), 'utf-8');
};
