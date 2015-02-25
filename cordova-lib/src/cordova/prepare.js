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
    platforms         = require('./platforms'),
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
            var parser = (new platforms[p].parser(platform_path));
            return parser.www_dir();
        });
        options.paths = paths;
    })
    .then(function(){
        return restore.installPluginsFromConfigXML(options);
    })
    .then(function() {
        var pluginInfoProvider = new PluginInfoProvider();

        // Iterate over each added platform
        return Q.all(options.platforms.map(function(platform) {
            var platformPath = path.join(projectRoot, 'platforms', platform);

            var parser = new platforms[platform].parser(platformPath),
                defaults_xml_path = path.join(platformPath, 'cordova', 'defaults.xml');
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
    });
}

var BLACKLIST = ['platform', 'feature'];
var SINGLETONS = ['content', 'author'];
function mergeXml(src, dest, platform, clobber) {
    // Do nothing for blacklisted tags.
    if (BLACKLIST.indexOf(src.tag) != -1) return;

    //Handle attributes
    Object.getOwnPropertyNames(src.attrib).forEach(function (attribute) {
        if (clobber || !dest.attrib[attribute]) {
            dest.attrib[attribute] = src.attrib[attribute];
        }
    });
    //Handle text
    if (src.text && (clobber || !dest.text)) {
        dest.text = src.text;
    }
    //Handle platform
    if (platform) {
        src.findall('platform[@name="' + platform + '"]').forEach(function (platformElement) {
            platformElement.getchildren().forEach(mergeChild);
        });
    }

    //Handle children
    src.getchildren().forEach(mergeChild);

    function mergeChild (srcChild) {
        var srcTag = srcChild.tag,
            destChild = new et.Element(srcTag),
            foundChild,
            query = srcTag + '',
            shouldMerge = true;

        if (BLACKLIST.indexOf(srcTag) === -1) {
            if (SINGLETONS.indexOf(srcTag) !== -1) {
                foundChild = dest.find(query);
                if (foundChild) {
                    destChild = foundChild;
                    dest.remove(0, destChild);
                }
            } else {
                //Check for an exact match and if you find one don't add
                Object.getOwnPropertyNames(srcChild.attrib).forEach(function (attribute) {
                    query += '[@' + attribute + '="' + srcChild.attrib[attribute] + '"]';
                });
                foundChild = dest.find(query);
                if (foundChild && textMatch(srcChild, foundChild)) {
                    destChild = foundChild;
                    dest.remove(0, destChild);
                    shouldMerge = false;
                }
            }

            mergeXml(srcChild, destChild, platform, clobber && shouldMerge);
            dest.append(destChild);
        }
    }
}

// Expose for testing.
exports._mergeXml = mergeXml;


function textMatch(elm1, elm2) {
    var text1 = elm1.text ? elm1.text.replace(/\s+/, '') : '',
        text2 = elm2.text ? elm2.text.replace(/\s+/, '') : '';
    return (text1 === '' || text1 === text2);
}
