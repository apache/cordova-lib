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

var cordova_util      = require('./util'),
    ConfigParser      = require('../configparser/ConfigParser'),
    path              = require('path'),
    platforms         = require('../platforms/platforms'),
    fs                = require('fs'),
    shell             = require('shelljs'),
    et                = require('elementtree'),
    HooksRunner       = require('../hooks/HooksRunner'),
    events            = require('../events'),
    Q                 = require('q'),
    plugman           = require('../plugman/plugman'),
    PlatformMunger    = require('../plugman/util/config-changes').PlatformMunger,
    PlatformJson      = require('../plugman/util/PlatformJson'),
    restore           = require('./restore-util');


var PluginInfoProvider = require('../PluginInfoProvider');

// Returns a promise.
exports = module.exports = prepare;
function prepare(options) {
    var projectRoot = cordova_util.cdProjectRoot();
    var xml = cordova_util.projectConfig(projectRoot);

    if (!options) {
        options = {
            verbose: false,
            platforms: [],
            options: []
        };
    }

    var hooksRunner = new HooksRunner(projectRoot);
    return hooksRunner.fire('before_prepare', options)
    .then(function(){
        return restore.installPlatformsFromConfigXML(options.platforms);
    })
    .then(function(){
        options = cordova_util.preProcessOptions(options);
        var paths = options.platforms.map(function(p) {
            var platform_path = path.join(projectRoot, 'platforms', p);
            var parser = platforms.getPlatformProject(p, platform_path);
            return parser.www_dir();
        });
        options.paths = paths;
    })
    .then(function() {
        var pluginInfoProvider = new PluginInfoProvider();

        // Iterate over each added platform
        return Q.all(options.platforms.map(function(platform) {
            var platformPath = path.join(projectRoot, 'platforms', platform);

            var parser = platforms.getPlatformProject(platform, platformPath);
            var defaults_xml_path = path.join(platformPath, 'cordova', 'defaults.xml');
            // If defaults.xml is present, overwrite platform config.xml with
            // it Otherwise save whatever is there as defaults so it can be
            // restored or copy project config into platform if none exists.
            if (fs.existsSync(defaults_xml_path)) {
                shell.cp('-f', defaults_xml_path, parser.config_xml());
                events.emit('verbose', 'Generating config.xml from defaults for platform "' + platform + '"');
            } else {
                if(fs.existsSync(parser.config_xml())){
                    shell.cp('-f', parser.config_xml(), defaults_xml_path);
                }else{
                    shell.cp('-f', xml, parser.config_xml());
                }
            }

            var stagingPath = path.join(platformPath, '.staging');
            if (fs.existsSync(stagingPath)) {
                events.emit('log', 'Deleting now-obsolete intermediate directory: ' + stagingPath);
                shell.rm('-rf', stagingPath);
            }

            // Replace the existing web assets with the app master versions
            parser.update_www();

            // Call plugman --prepare for this platform. sets up js-modules appropriately.
            var plugins_dir = path.join(projectRoot, 'plugins');
            events.emit('verbose', 'Calling plugman.prepare for platform "' + platform + '"');

            if (options.browserify) {
                plugman.prepare = require('../plugman/prepare-browserify');
            }
            plugman.prepare(platformPath, platform, plugins_dir, null, true, pluginInfoProvider);

            // Make sure that config changes for each existing plugin is in place
            var platformJson = PlatformJson.load(plugins_dir, platform);
            var munger = new PlatformMunger(platform, platformPath, plugins_dir, platformJson, pluginInfoProvider);
            munger.reapply_global_munge();
            munger.save_all();

            // Update platform config.xml based on top level config.xml
            var cfg = new ConfigParser(xml);
            var platform_cfg = new ConfigParser(parser.config_xml());
            exports._mergeXml(cfg.doc.getroot(), platform_cfg.doc.getroot(), platform, true);

            // CB-6976 Windows Universal Apps. For smooth transition and to prevent mass api failures
            // we allow using windows8 tag for new windows platform
            if (platform == 'windows') {
                exports._mergeXml(cfg.doc.getroot(), platform_cfg.doc.getroot(), 'windows8', true);
            }

            platform_cfg.write();

            return parser.update_project(cfg);
        })).then(function() {
            return hooksRunner.fire('after_prepare', options);
        });
    }).then(function () {
        return restore.installPluginsFromConfigXML(options);
    });
}
