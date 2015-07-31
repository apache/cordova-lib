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

/* jshint unused:false, expr:true */

var platform_modules   = require('../platforms/platforms'),
    path               = require('path'),
    aliasify           = require('aliasify'),
    config_changes     = require('./util/config-changes'),
    common             = require('./platforms/common'),
    fs                 = require('fs'),
    childProcess       = require('child_process'),
    shell              = require('shelljs'),
    util               = require('util'),
    events             = require('../events'),
    plugman            = require('./plugman'),
    bundle             = require('cordova-js/tasks/lib/bundle-browserify'),
    writeLicenseHeader = require('cordova-js/tasks/lib/write-license-header'),
    Q                  = require('q'),
    computeCommitId    = require('cordova-js/tasks/lib/compute-commit-id');

var PlatformJson = require('./util/PlatformJson');
var PluginInfoProvider = require('../PluginInfoProvider');

function uninstallQueuedPlugins(platformJson, wwwDir) {
    // Check if there are any plugins queued for uninstallation, and if so, remove any of their plugin web assets loaded in
    // via <js-module> elements
    var plugins_to_uninstall = platformJson.root.prepare_queue.uninstalled;
    if (plugins_to_uninstall && plugins_to_uninstall.length) {
        var plugins_www = path.join(wwwDir, 'plugins');
        if (fs.existsSync(plugins_www)) {
            plugins_to_uninstall.forEach(function(plug) {
                var id = plug.id;
                var plugin_modules = path.join(plugins_www, id);
                if (fs.existsSync(plugin_modules)) {
                    events.emit('verbose', 'Removing plugins directory from www "'+plugin_modules+'"');
                    shell.rm('-rf', plugin_modules);
                }
            });
        }
    }
}

function generateFinalBundle(platform, libraryRelease, outReleaseFile, commitId, platformVersion) {
    var deferred = Q.defer();
    var outReleaseFileStream = fs.createWriteStream(outReleaseFile);
    var time = new Date().valueOf();
    var symbolList = null;

    writeLicenseHeader(outReleaseFileStream, platform, commitId, platformVersion);

    var releaseBundle = libraryRelease.bundle();

    releaseBundle.pipe(outReleaseFileStream);

    outReleaseFileStream.on('finish', function() {
        var newtime = new Date().valueOf() - time;
        plugman.emit('verbose', 'generated cordova.' + platform + '.js @ ' + commitId + ' in ' + newtime + 'ms');
        deferred.resolve();
        // TODO clean up all the *.browserify files
    });

    outReleaseFileStream.on('error', function(err) {
        var newtime = new Date().valueOf() - time;
        events.emit('log', 'error while generating cordova.js');
        deferred.reject();
    });
    return deferred.promise;
}

function computeCommitIdSync() {
    var deferred = Q.defer();
    computeCommitId(function(cId){
        deferred.resolve(cId);
    });
    return deferred.promise;
}

function getPlatformVersion(cId, project_dir) {
    var deferred = Q.defer();
    //run version script for each platform to get platformVersion
    var versionPath = path.join(project_dir, '/cordova/version');
    childProcess.exec('"' + versionPath + '"', function(err, stdout, stderr) {
        if (err) {
            events.emit('log', 'Error running platform version script');
            events.emit('log', err);
            deferred.resolve('N/A');
        } else {
            deferred.resolve(stdout.trim());
        }
    });
    return deferred.promise;
}

// Called on --prepare.
// Sets up each plugin's Javascript code to be loaded properly.
// Expects a path to the project (platforms/android in CLI, . in plugman-only),
// a path to where the plugins are downloaded, the www dir, and the platform ('android', 'ios', etc.).
module.exports = function handlePrepare(project_dir, platform, plugins_dir, www_dir, is_top_level, pluginInfoProvider) {
    // Process:
    // - Do config munging by calling into config-changes module
    // - List all plugins in plugins_dir
    // - Load and parse their plugin.xml files.
    // - Skip those without support for this platform. (No <platform> tags means JS-only!)
    // - Build a list of all their js-modules, including platform-specific js-modules.
    // - For each js-module (general first, then platform) build up an object storing the path and any clobbers, merges and runs for it.
    // Write this object into www/cordova_plugins.json.
    // This file is not really used. Maybe cordova app harness
    events.emit('verbose', 'Preparing ' + platform + ' browserify project');
    pluginInfoProvider = pluginInfoProvider || new PluginInfoProvider(); // Allow null for backwards-compat.
    var platformJson = PlatformJson.load(plugins_dir, platform);
    var wwwDir = www_dir || platform_modules.getPlatformProject(platform, project_dir).www_dir();

    uninstallQueuedPlugins(platformJson, www_dir);

    events.emit('verbose', 'Processing configuration changes for plugins.');
    config_changes.process(plugins_dir, project_dir, platform, platformJson, pluginInfoProvider);

    if(!is_top_level) {
        return Q();
    }

    var commitId;
    return computeCommitIdSync()
    .then(function(cId){
        commitId = cId;
        return getPlatformVersion(commitId, project_dir);
    }).then(function(platformVersion){
        var libraryRelease = bundle(platform, false, commitId, platformVersion);

        var pluginMetadata = {};
        var modulesMetadata = [];
        var bundleFiles = [];
        var cordova_plugins = '';

        var plugins = Object.keys(platformJson.root.installed_plugins).concat(Object.keys(platformJson.root.dependent_plugins));
        events.emit('verbose', 'Iterating over installed plugins:', plugins);
        plugins && plugins.forEach(function(plugin) {
            var pluginDir = path.join(plugins_dir, plugin);
            var pluginInfo = pluginInfoProvider.get(pluginDir);
            // pluginMetadata is a mapping from plugin IDs to versions.
            pluginMetadata[pluginInfo.id] = pluginInfo.version;

            // Copy www assets described in <asset> tags.
            pluginInfo.getAssets(platform)
            .forEach(function(asset) {
                common.asset.install(asset, pluginDir, wwwDir);
            });

            pluginInfo.getJsModules(platform)
            .forEach(function(jsModule) {
                var moduleName = jsModule.name ? jsModule.name : path.basename(jsModule.src, '.js');
                var moduleId = pluginInfo.id + '.' + moduleName;

                modulesMetadata.push({file: jsModule.src, id: moduleId, name: moduleName});
                libraryRelease.require([{file: path.join(pluginDir, jsModule.src), expose: moduleId}]);

                jsModule.clobbers.forEach(function(child) {
                    if (child.target) cordova_plugins +=
                        'require(\'cordova/modulemapper\').clobbers(\'' +
                        moduleId + '\', \'' + child.target + '\');\n';
                });
                jsModule.merges.forEach(function(child) {
                    if (child.target) cordova_plugins +=
                        'require(\'cordova/modulemapper\').merges(\'' +
                        moduleId + '\', \'' + child.target + '\');\n';
                });
                if (jsModule.runs)
                    cordova_plugins += 'require(\'' + moduleId + '\');\n';
            });
        });

        cordova_plugins += 'module.exports.metadata = \n' +
            JSON.stringify(pluginMetadata, null, 4) + ';\n' +
            'module.exports = \n' +
            JSON.stringify(modulesMetadata, null, 4) + ';\n';

        events.emit('verbose', 'Writing out cordova_plugins.js...');
        fs.writeFileSync(path.join(wwwDir, 'cordova_plugins.js'), cordova_plugins, 'utf8');
        libraryRelease.add(path.join(wwwDir, 'cordova_plugins.js'), {expose: 'cordova/plugin_list'});

        fs.writeFileSync(path.join(wwwDir, 'init.js'), 'require(\'cordova/init\');\n', 'utf8');
        libraryRelease.add(path.resolve(wwwDir, 'init.js'));

        var moduleAliases = modulesMetadata
        .reduce(function (accum, meta) {
            accum['./' + meta.name] = meta.id;
            return accum;
        }, {});
        libraryRelease.transform(aliasify, {aliases: moduleAliases, verbose: true});

        var outReleaseFile = path.join(wwwDir, 'cordova.js');
        return generateFinalBundle(platform, libraryRelease, outReleaseFile, commitId, platformVersion);
    });
};
