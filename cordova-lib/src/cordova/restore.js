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

/* jshint node:true, bitwise:true, undef:true, trailing:true, quotmark:true,
          indent:4, unused:vars, latedef:nofunc
*/

var cordova_util    = require('./util'),
    ConfigParser     = require('../configparser/ConfigParser'),
    path             = require('path'),
    Q                = require('q'),
    fs               = require('fs'),
    plugin           = require('./plugin'),
    events           = require('../events'),
    platform         = require('./platform'),
    CordovaError     = require('../CordovaError');

module.exports = restore;
function restore(target){
    var projectHome = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectHome);
    var configXml = new ConfigParser(configPath);
    if( 'plugins' === target ){
        return installPluginsFromConfigXML(configXml);
    }
    if( 'platforms' === target ){
        return installPlatformsFromConfigXML(configXml);
    }
    return Q.reject( new CordovaError('Unknown target only "plugins" and "platforms" are supported'));
}

function installPlatformsFromConfigXML(cfg){
    var projectHome = cordova_util.cdProjectRoot();
    var engines = cfg.getEngines(projectHome);
    var targets = engines.map(function(engine){
            return engine.id;
        });
    if(!targets || !targets.length  ){
        return Q.all('No platforms are listed in config.xml to restore');
    }
    return platform('add', targets);
}

//returns a Promise
function installPluginsFromConfigXML(cfg) {
    //Install plugins that are listed on config.xml
    var projectRoot = cordova_util.cdProjectRoot();
    var plugins_dir = path.join(projectRoot, 'plugins');

    // Get all configured plugins
    var features = cfg.getFeatureIdList();
    if (0 === features.length) {
        return Q.all('No config.xml plugins to install');
    }

    return features.reduce(function(soFar, featureId) {

        var pluginPath =  path.join(plugins_dir, featureId);
        if (fs.existsSync(pluginPath)) {
            // Plugin already exists
            return soFar;
        }

        return soFar.then(function() {
            events.emit('log', 'Discovered ' + featureId + ' in config.xml. Installing to the project');

            var feature = cfg.getFeature(featureId);

            // Install from given URL if defined or using a plugin id
            var installFrom = feature.url;
            if (!installFrom) {
                installFrom = feature.id;
                if (!!feature.version) {
                    installFrom += ('@' + feature.version);
                }
            }

            // Add feature preferences as CLI variables if have any
            var options = 'undefined' !== typeof feature.variables ? {cli_variables: feature.variables} : null;

            return plugin('add', installFrom, options);
        });
    }, Q());
}
