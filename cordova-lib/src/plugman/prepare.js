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

/* jshint expr:true, quotmark:false */

var platform_modules = require('../platforms/platforms'),
    path            = require('path'),
    config_changes  = require('./util/config-changes'),
    common          = require('./platforms/common'),
    fs              = require('fs'),
    shell           = require('shelljs'),
    Q               = require('q'),
    events          = require('../events');
var PlatformJson = require('./util/PlatformJson');
var PluginInfoProvider = require('../PluginInfoProvider');

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
    // - Write this object into www/cordova_plugins.json.
    // - Cordova.js contains code to load them at runtime from that file.
    events.emit('verbose', 'Preparing ' + platform + ' project');
    pluginInfoProvider = pluginInfoProvider || new PluginInfoProvider(); // Allow null for backwards-compat.
    var platformJson = PlatformJson.load(plugins_dir, platform);
    var wwwDir = www_dir || platform_modules.getPlatformProject(platform, project_dir).www_dir();

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

    events.emit('verbose', 'Processing configuration changes for plugins.');
    config_changes.process(plugins_dir, project_dir, platform, platformJson, pluginInfoProvider);

    // This array holds all the metadata for each module and ends up in cordova_plugins.json
    var plugins = Object.keys(platformJson.root.installed_plugins).concat(Object.keys(platformJson.root.dependent_plugins));
    var moduleObjects = [];
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
                var result = module.src.match(/([^\/]+)\.js/);
                moduleName += result[1];
            }

            var fsPath = path.join.apply(path, pathParts);
            var scriptContent = fs.readFileSync(path.join(pluginDir, fsPath), 'utf-8').replace(/^\ufeff/, ''); // Window BOM
            if (fsPath.match(/.*\.json$/)) {
                scriptContent = 'module.exports = ' + scriptContent;
            }
            scriptContent = 'cordova.define("' + moduleName + '", function(require, exports, module) { ' + scriptContent + '\n});\n';
            fs.writeFileSync(path.join(platformPluginsDir, plugin_id, fsPath), scriptContent, 'utf-8');

            // Prepare the object for cordova_plugins.json.
            var obj = {
                file: ['plugins', plugin_id, module.src].join('/'),
                id: moduleName
            };
            if (module.clobbers.length > 0) {
                obj.clobbers = module.clobbers.map(function(o) { return o.target; });
            }
            if (module.merges.length > 0) {
                obj.merges = module.merges.map(function(o) { return o.target; });
            }
            if (module.runs) {
                obj.runs = true;
            }

            // Add it to the list of module objects bound for cordova_plugins.json
            moduleObjects.push(obj);
        });
    });

    // Write out moduleObjects as JSON wrapped in a cordova module to cordova_plugins.js
    var final_contents = "cordova.define('cordova/plugin_list', function(require, exports, module) {\n";
    final_contents += 'module.exports = ' + JSON.stringify(moduleObjects,null,'    ') + ';\n';
    final_contents += 'module.exports.metadata = \n';
    final_contents += '// TOP OF METADATA\n';
    final_contents += JSON.stringify(pluginMetadata, null, '    ') + '\n';
    final_contents += '// BOTTOM OF METADATA\n';
    final_contents += '});'; // Close cordova.define.

    events.emit('verbose', 'Writing out cordova_plugins.js...');
    fs.writeFileSync(path.join(wwwDir, 'cordova_plugins.js'), final_contents, 'utf-8');
    
    return Q();
};
