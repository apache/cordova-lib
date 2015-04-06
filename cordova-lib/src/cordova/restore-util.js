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
    path         = require('path'),
    Q            = require('q'),
    fs           = require('fs'),
    plugin       = require('./plugin'),
    events       = require('../events'),
    cordova      = require('./cordova'),
    semver       = require('semver');

exports.installPluginsFromConfigXML = installPluginsFromConfigXML;
exports.installPlatformsFromConfigXML = installPlatformsFromConfigXML;


function installPlatformsFromConfigXML(platforms) {
    var projectHome = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectHome);
    var cfg = new ConfigParser(configPath);

    var engines = cfg.getEngines(projectHome);
    var installAllPlatforms = !platforms || platforms.length === 0;

    var targets = engines.map(function (engine) {
        var platformPath = path.join(projectHome, 'platforms', engine.name);
        var platformAlreadyAdded = fs.existsSync(platformPath);

        //if no platforms are specified we add all.
        if ((installAllPlatforms || platforms.indexOf(engine.name) > -1 ) && !platformAlreadyAdded) {
            var t = engine.name;
            if (engine.spec) {
                t += '@' + engine.spec;
            }
            return t;
        }
    });

    if (!targets || !targets.length) {
        return Q.all('No platforms are listed in config.xml to restore');
    }
    // Run platform add for all the platforms seperately
    // so that failure on one does not affect the other.
    var promises = targets.map(function (target) {
        if (target) {
            events.emit('log', 'Restoring platform ' + target + ' referenced on config.xml');
            return cordova.raw.platform('add', target);
        }
        return Q();
    });
    return Q.allSettled(promises).then(
        function (results) {
            for (var i = 0; i < results.length; i++) {
                //log the rejections otherwise they are lost
                if (results[i].state === 'rejected') {
                    events.emit('log', results[i].reason.message);
                }
            }
        });
}

//returns a Promise
function installPluginsFromConfigXML(args) {
    //Install plugins that are listed on config.xml
    var projectRoot = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(configPath);
    var plugins_dir = path.join(projectRoot, 'plugins');

    // Get all configured plugins
    var plugins = cfg.getPluginIdList();
    if (0 === plugins.length) {
        return Q.all('No config.xml plugins to install');
    }

    var promises = plugins.map(function(featureId){
        var pluginPath =  path.join(plugins_dir, featureId);
        if (fs.existsSync(pluginPath)) {
            // Plugin already exists
            return Q();
        }
        events.emit('log', 'Discovered plugin "' + featureId + '" in config.xml. Installing to the project');
        var pluginEntry = cfg.getPlugin(featureId);

        // Install from given URL if defined or using a plugin id. If spec isn't a valid version or version range,
        // assume it is the location to install from.
        var pluginSpec = pluginEntry.spec;
        var installFrom = semver.validRange(pluginSpec, true) ? pluginEntry.name + '@' + pluginSpec : pluginSpec;

        // Add feature preferences as CLI variables if have any
        var options = {cli_variables: pluginEntry.variables,
            searchpath: args.searchpath };
            return plugin('add', installFrom, options);
    });
    return Q.allSettled(promises);
}
