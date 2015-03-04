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

var cordova_util = require('./util'),
    ConfigParser = require('../configparser/ConfigParser'),
    Q            = require('q');

// Returns all the platforms that are currently saved into config.xml
// Return type is a promise that is fulfilled with a list of objects with name and version properties. e.g: [{name: 'android', version: '3.5.0'}, {name: 'wp8', version: 'C:/path/to/platform'}, {name: 'ios', version: 'git://...'}]
// ToDo: Once we move to npm, this function should be updated to rely on npm instead
function getPlatforms(projectRoot){
    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);
    return Q(cfg.getEngines());
}

// Returns all the plugins that are currently saved into config.xml
// Return type is a promise that is fulfilled with a list of objects with name and version properties. e.g: [ {id: 'org.apache.cordova.device', name: 'Device', APP_ID: 'my-app-id', APP_NAME: 'my-app-name'} ]
// ToDO: Once we move to npm, this function should be updated to rely on npm instead
function getPlugins(projectRoot){
    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);
    var plugins = cfg.getFeatureIdList().map(function(id){
        return cfg.getFeature(id);
    });
    return Q.all(plugins);
}

// Returns a promise
// Returns the specified metadata details
function getProjectMetadata(metadata_type, projectRoot){
    switch(metadata_type){
        case 'platforms':
           return getPlatforms(projectRoot);
        case 'plugins':
           return getPlugins(projectRoot);
        default:
           return Q.reject('Unknown metadata type directive');
    }
}

module.exports = getProjectMetadata;
module.exports.getPlatforms = getPlatforms;
module.exports.getPlugins = getPlugins;
