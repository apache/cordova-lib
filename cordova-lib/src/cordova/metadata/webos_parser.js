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
          indent:4, unused:vars, latedef:nofunc,
          sub:true
*/

var fs = require('fs'),
    path = require('path'),
    shell = require('shelljs'),
    events = require('../../events'),
    util = require('../util'),
    Q = require('q'),
    ConfigParser = require('../../configparser/ConfigParser');

module.exports = function webos_parser(project) {
    this.path = project;
};


module.exports.prototype = {
    // Returns a promise.
    update_from_config: function() {
        var config = new ConfigParser(this.config_xml());
        var manifestPath = path.join(this.www_dir(), 'appinfo.json');
        var manifest = {type: "web", uiRevision:2};

        // Load existing manifest
        if (fs.existsSync(manifestPath)) {
            manifest = JSON.parse(fs.readFileSync(manifestPath));
        }

        // overwrite properties existing in config.xml
        manifest.id = config.packageName() || 'com.yourdomain.app';
        var contentNode = config.doc.find('content');
        var contentSrc = contentNode && contentNode.attrib['src'] || 'index.html';
        manifest.main = contentSrc;
        manifest.version = config.version() || '0.0.1';
        manifest.title = config.name() || "Hello World";
        manifest.appDescription = config.description() || "";
        manifest.vendor = config.author() || "My Company";

        var authorNode = config.doc.find('author');
        var authorUrl = authorNode && authorNode.attrib['href'];
        if (authorUrl) {
            manifest.developer.vendorurl = authorUrl;
        }

        var icons = config.getIcons('webos');
        // if there are icon elements in config.xml
        if (icons) {
            var setIcon = function(type, size) {
                var item = icons.getBySize(size, size);
                if(item && item.src) {
                    manifest[type] = item.src;
                } else {
                    item = icons.getDefault();
                    if(item && item.src) {
                        manifest[type] = item.src;
                    }
                }
            };
            setIcon(icons, 'icon', 80, 80);
            setIcon(icons, 'largeIcon', 130, 130);
        }

        var splash = config.getSplashScreens('webos');
        // if there are icon elements in config.xml
        if (splash) {
            var splashImg = splash.getBySize(1920, 1080);
            if(splashImg && splashImg.src) {
                manifest.splashBackground = splashImg.src;
            }
        }

        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t"));

        return Q();
    },

    www_dir: function() {
        return path.join(this.path, 'www');
    },

    // Used for creating platform_www in projects created by older versions.
    cordovajs_path:function(libDir) {
        var jsPath = path.join(libDir, 'cordova-lib', 'cordova.js');
        return path.resolve(jsPath);
    },

    // Replace the www dir with contents of platform_www and app www.
    update_www:function() {
        var projectRoot = util.isCordova(this.path);
        var app_www = util.projectWww(projectRoot);
        var platform_www = path.join(this.path, 'platform_www');

        // Clear the www dir
        shell.rm('-rf', this.www_dir());
        shell.mkdir(this.www_dir());
        // Copy over all app www assets
        if(fs.lstatSync(app_www).isSymbolicLink()) {
            var real_www = fs.realpathSync(app_www);
            if(fs.existsSync(path.join(real_www, 'build/enyo.js'))) {
                // symlinked Enyo bootplate; resolve to bootplate root for
                // ares-webos-sdk to handle the minification
                if(fs.existsSync(path.join(real_www, '../enyo')) {
                    app_www = path.join(real_www, '..');
                } else if (fs.existsSync(path.join(real_www, '../..'))) {
                    app_www = path.join(real_www, '../..');
                }
            }
        }
        shell.cp('-rf', path.join(app_www, '*'), this.www_dir());
        // Copy over stock platform www assets (cordova.js)
        shell.cp('-rf', path.join(platform_www, '*'), this.www_dir());
    },

    update_overrides: function() {
        var projectRoot = util.isCordova(this.path);
        var mergesPath = path.join(util.appDir(projectRoot), 'merges', 'webosos');
        if(fs.existsSync(mergesPath)) {
            var overrides = path.join(mergesPath, '*');
            shell.cp('-rf', overrides, this.www_dir());
        }
    },

    config_xml:function(){
        return path.join(this.path, 'config.xml');
    },

    // Returns a promise.
    update_project: function(cfg) {
        return this.update_from_config()
            .then(function(){
                this.update_overrides();
                util.deleteSvnFolders(this.www_dir());
            }.bind(this));
    }
};
