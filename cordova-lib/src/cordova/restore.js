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
    var pluginsFromConfig = [];
    var projectRoot = cordova_util.cdProjectRoot();
    var plugins_dir = path.join(projectRoot, 'plugins');

    var features = cfg.doc.findall('feature');
    // Seems that we have no way to pass preferences per plugin at the moment
    // As plugin("add") accepts a single options object
    // If per-plugin preferences are to be done - install plugins
    // one-by one rather than in a batch way
    // Using a single var object for all features may lead to preference conflicts
    var prefVars = {};

    features.forEach(function(feature){
        var params = feature.findall('param');
        var param;
        var pluginId = '';
        var pluginUrl = '';
        var pluginVersion = '';
        var i;
        for (i = 0; i < params.length; i++) {
            param = params[i];
            if (param.attrib.name === 'url') {
                pluginUrl = param.attrib.value;
            }
            if (param.attrib.name === 'id') {
                pluginId = param.attrib.value;
            }
            if (param.attrib.name === 'version') {
                pluginVersion = param.attrib.value;
            }
        }

        // Find plugin preferencies inside features
        var preferencies = feature.findall('preference');
        // See above statement on batch installing
        // var prefVars = {};
        var pref, prefName, prefVal;
        for (i = 0; i < preferencies.length; i++) {
            pref = preferencies[i];
            prefName = pref.attrib.name;
            prefVal = pref.attrib.value;
            // Check format
            if (typeof prefName === 'string' && typeof prefVal === 'string') {
                prefVars[prefName] = prefVal;
            }
        }

        if (pluginId !== '') {
            var pluginPath =  path.join(plugins_dir,pluginId);
            // contents of the plugins folder takes precedence hence
            // we ignore if the correct version is installed or not.
            if (!fs.existsSync(pluginPath)) {
                if ( pluginVersion !== '') {
                    pluginId = pluginId + '@' + pluginVersion;
                }
                events.emit('log', 'Discovered ' + pluginId + ' in config.xml. Installing to the project');
                // If URL parameter passed - take as a point from where to install
                pluginsFromConfig.push(pluginUrl !== '' ? pluginUrl : pluginId);
            }
        }
    });

    // Use cli instead of plugman directly ensuring all the hooks
    // to get fired.
    // Pass preferences as CLI variables. As described above
    // the single list of variables used for the whole plugin group
    if (pluginsFromConfig.length >0) {
        return plugin('add', pluginsFromConfig, {cli_variables:prefVars});
    }
    return Q.all('No config.xml plugins to install');
}
