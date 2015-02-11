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

var platform_modules   = require('./platforms'),
    path               = require('path'),
    through            = require('through2'),
    config_changes     = require('./util/config-changes'),
    wp8                = require('./platforms/wp8'),
    windows            = require('./platforms/windows'),
    common             = require('./platforms/common'),
    fs                 = require('fs'),
    childProcess       = require('child_process'),
    shell              = require('shelljs'),
    util               = require('util'),
    events             = require('../events'),
    plugman            = require('./plugman'),
    et                 = require('elementtree'),
    prepareNamespace   = require('./util/prepare-namespace'),
    bundle             = require('cordova-js/tasks/lib/bundle-browserify'),
    requireTr          = require('cordova-js/tasks/lib/require-tr'),
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

    var addSymbolList = through.obj(function(row, enc, next) {
        if(symbolList === null) {
            symbolList = requireTr.getModules();
            this.push(util.format('var symbolList = %s;\n%s\n', JSON.stringify(symbolList), row));
        } else {
            this.push(row);
        }
        next();
    });

    libraryRelease.pipeline.get('wrap').push(addSymbolList);

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
    childProcess.exec(versionPath, function(err, stdout, stderr) {
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
    var wwwDir = www_dir || platform_modules[platform].www_dir(project_dir);
    var scripts = [];

    uninstallQueuedPlugins(platformJson, www_dir);

    events.emit('verbose', 'Processing configuration changes for plugins.');
    config_changes.process(plugins_dir, project_dir, platform, platformJson, pluginInfoProvider);

    if(!is_top_level) {
        return Q();
    }
    requireTr.init(platform);

    var commitId;
    return computeCommitIdSync()
    .then(function(cId){
        commitId = cId;
        return getPlatformVersion(commitId, project_dir);
    }).then(function(platformVersion){
        var libraryRelease = bundle(platform, false, commitId, platformVersion);

        var plugins = Object.keys(platformJson.root.installed_plugins).concat(Object.keys(platformJson.root.dependent_plugins));
        var pluginMetadata = {};
        events.emit('verbose', 'Iterating over installed plugins:', plugins);

        plugins && plugins.forEach(function(plugin) {
            var pluginDir = path.join(plugins_dir, plugin);
            var pluginInfo = pluginInfoProvider.get(pluginDir);
            var plugin_id = pluginInfo.id;
            // pluginMetadata is a mapping from plugin IDs to versions.
            pluginMetadata[plugin_id] = pluginInfo.version;

            // add the plugins dir to the platform's www.
            var platformPluginsDir = path.join(wwwDir, 'plugins');
            // XXX this should not be here if there are no js-module. It leaves an empty plugins/ directory
            shell.mkdir('-p', platformPluginsDir);

            var jsModules = pluginInfo.getJsModules(platform);
            var assets = pluginInfo.getAssets(platform);

            // Copy www assets described in <asset> tags.
            assets.forEach(function(asset) {
                common.asset.install(asset, pluginDir, wwwDir);
            });
            jsModules.forEach(function(module) {
                // Copy the plugin's files into the www directory.
                // NB: We can't always use path.* functions here, because they will use platform slashes.
                // But the path in the plugin.xml and in the cordova_plugins.js should be always forward slashes.
                var pathParts = module.src.split('/');

                var fsDirname = path.join.apply(path, pathParts.slice(0, -1));
                var fsDir = path.join(platformPluginsDir, plugin_id, fsDirname);
                shell.mkdir('-p', fsDir);

                // Read in the file, prepend the cordova.define, and write it back out.
                var moduleName = plugin_id + '.';
                if (module.name) {
                    moduleName += module.name;
                } else {
                    moduleName += path.basename(module.src, '.js');
                }

                var fsPath = path.join.apply(path, pathParts);
                var scriptPath = path.join(pluginDir, fsPath);

                if(requireTr.hasModule(moduleName) === false) {
                    requireTr.addModule({symbol: moduleName, path: scriptPath});
                }

                module.clobbers.forEach(function(child) {
                    fs.appendFileSync(scriptPath,
                        prepareNamespace(child.target, 'c'),
                        'utf-8');
                });
                module.merges.forEach(function(child) {
                    fs.appendFileSync(scriptPath,
                        prepareNamespace(child.target, 'm'),
                        'utf-8');
                });
                scripts.push(scriptPath);
            });
        });

        var cordova_plugins = 'module.exports.metadata = \n';
        cordova_plugins += JSON.stringify(pluginMetadata, null, '     ') + '\n';
        cordova_plugins += 'modules.exports = modules.exports.metadata;';
            
        events.emit('verbose', 'Writing out cordova_plugins.js...');
        fs.writeFileSync(path.join(wwwDir, 'cordova_plugins.js'), cordova_plugins, 'utf8');

        libraryRelease.transform(requireTr.transform);

        scripts.forEach(function(script) {
            libraryRelease.add(script);
        });

        var outReleaseFile = path.join(wwwDir, 'cordova.js');
        return generateFinalBundle(platform, libraryRelease, outReleaseFile, commitId, platformVersion, requireTr.getModules());
    });
};
