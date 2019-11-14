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

var path = require('path');
var fs = require('fs-extra');
var ActionStack = require('cordova-common').ActionStack;
var dependencies = require('./util/dependencies');
var CordovaError = require('cordova-common').CordovaError;
var events = require('cordova-common').events;
var platform_modules = require('../platforms/platforms');
var promiseutil = require('../util/promise-util');
var HooksRunner = require('../hooks/HooksRunner');
var cordovaUtil = require('../cordova/util');
var npmUninstall = require('cordova-fetch').uninstall;

var PlatformJson = require('cordova-common').PlatformJson;
var PluginInfoProvider = require('cordova-common').PluginInfoProvider;
var variableMerge = require('../plugman/variable-merge');

// possible options: cli_variables, www_dir
// Returns a promise.
module.exports = uninstall;
function uninstall (platform, project_dir, id, plugins_dir, options) {
    project_dir = cordovaUtil.convertToRealPathSafe(project_dir);
    plugins_dir = cordovaUtil.convertToRealPathSafe(plugins_dir);

    options = options || {};
    options.is_top_level = true;
    options.pluginInfoProvider = options.pluginInfoProvider || new PluginInfoProvider();
    plugins_dir = plugins_dir || path.join(project_dir, 'cordova', 'plugins');

    // Allow `id` to be a path to a file.
    var xml_path = path.join(id, 'plugin.xml');
    if (fs.existsSync(xml_path)) {
        id = options.pluginInfoProvider.get(id).id;
    }

    return module.exports.uninstallPlatform(platform, project_dir, id, plugins_dir, options)
        .then(function () {
            return module.exports.uninstallPlugin(id, plugins_dir, options);
        });
}

// Returns a promise.
module.exports.uninstallPlatform = function (platform, project_dir, id, plugins_dir, options) {
    project_dir = cordovaUtil.convertToRealPathSafe(project_dir);
    plugins_dir = cordovaUtil.convertToRealPathSafe(plugins_dir);

    options = options || {};
    options.is_top_level = true;
    options.pluginInfoProvider = options.pluginInfoProvider || new PluginInfoProvider();
    plugins_dir = plugins_dir || path.join(project_dir, 'cordova', 'plugins');

    if (!platform_modules[platform]) {
        return Promise.reject(new CordovaError('Platform "' + platform + '" not supported.'));
    }

    var plugin_dir = path.join(plugins_dir, id);
    if (!fs.existsSync(plugin_dir)) {
        return Promise.reject(new CordovaError('Plugin "' + id + '" not found. Already uninstalled?'));
    }

    var current_stack = new ActionStack();

    return Promise.resolve().then(function () {
        if (options.platformVersion) {
            return Promise.resolve(options.platformVersion);
        }
        return Promise.resolve(cordovaUtil.getPlatformVersion(project_dir));
    }).then(function (platformVersion) {
        options.platformVersion = platformVersion;
        return runUninstallPlatform(current_stack, platform, project_dir, plugin_dir, plugins_dir, options);
    });
};

// Returns a promise.
module.exports.uninstallPlugin = function (id, plugins_dir, options) {
    plugins_dir = cordovaUtil.convertToRealPathSafe(plugins_dir);

    options = options || {};
    options.pluginInfoProvider = options.pluginInfoProvider || new PluginInfoProvider();
    var pluginInfoProvider = options.pluginInfoProvider;

    var plugin_dir = path.join(plugins_dir, id);

    // @tests - important this event is checked spec/uninstall.spec.js
    events.emit('log', 'Removing "' + id + '"');

    // If already removed, skip.
    if (!fs.existsSync(plugin_dir)) {
        events.emit('verbose', 'Plugin "' + id + '" already removed (' + plugin_dir + ')');
        return Promise.resolve();
    }

    /*
     * Deletes plugin from plugins directory and node_modules directory.
     *
     * @param {String} id   the id of the plugin being removed
     *
     * @return {Promise||Error} Returns a empty promise or a promise of doing the npm uninstall
     */
    var doDelete = function (id) {
        var plugin_dir = path.join(plugins_dir, id);
        if (!fs.existsSync(plugin_dir)) {
            events.emit('verbose', 'Plugin "' + id + '" already removed (' + plugin_dir + ')');
            return Promise.resolve();
        }

        fs.removeSync(plugin_dir);
        events.emit('verbose', 'Deleted plugin "' + id + '"');

        // remove plugin from node_modules directory
        return npmUninstall(id, options.projectRoot, options);
    };

    // We've now lost the metadata for the plugins that have been uninstalled, so we can't use that info.
    // Instead, we list all dependencies of the target plugin, and check the remaining metadata to see if
    // anything depends on them, or if they're listed as top-level.
    // If neither, they can be deleted.
    var top_plugin_id = id;

    // Recursively remove plugins which were installed as dependents (that are not top-level)
    var toDelete = [];
    function findDependencies (pluginId) {
        var depPluginDir = path.join(plugin_dir, '..', pluginId);
        // Skip plugin check for dependencies if it does not exist (CB-7846).
        if (!fs.existsSync(depPluginDir)) {
            events.emit('verbose', 'Plugin "' + pluginId + '" does not exist (' + depPluginDir + ')');
            return;
        }
        var pluginInfo = pluginInfoProvider.get(depPluginDir);
        // TODO: Should remove dependencies in a separate step, since dependencies depend on platform.
        var deps = pluginInfo.getDependencies();
        deps.forEach(function (d) {
            if (toDelete.indexOf(d.id) === -1) {
                toDelete.push(d.id);
                findDependencies(d.id);
            }
        });
    }
    findDependencies(top_plugin_id);
    toDelete.push(top_plugin_id);

    // Okay, now we check if any of these are depended on, or top-level.
    // Find the installed platforms by whether they have a metadata file.
    var platforms = Object.keys(platform_modules).filter(function (platform) {
        return fs.existsSync(path.join(plugins_dir, platform + '.json'));
    });

    // Can have missing plugins on some platforms when not supported..
    var dependList = {};
    platforms.forEach(function (platform) {
        var platformJson = PlatformJson.load(plugins_dir, platform);
        var depsInfo = dependencies.generateDependencyInfo(platformJson, plugins_dir, pluginInfoProvider);
        var tlps = depsInfo.top_level_plugins;
        var deps;

        // Top-level deps must always be explicitely asked to remove by user
        tlps.forEach(function (plugin_id) {
            if (top_plugin_id === plugin_id) { return; }

            var i = toDelete.indexOf(plugin_id);
            if (i >= 0) { toDelete.splice(i, 1); }
        });

        toDelete.forEach(function (plugin) {
            deps = dependencies.dependents(plugin, depsInfo, platformJson, pluginInfoProvider);

            var i = deps.indexOf(top_plugin_id);
            if (i >= 0) { deps.splice(i, 1); } // remove current/top-level plugin as blocking uninstall

            if (deps.length) {
                dependList[plugin] = deps.join(', ');
            }
        });
    });

    var dependPluginIds = toDelete.filter(function (plugin_id) {
        return dependList[plugin_id];
    });
    var createMsg = function (plugin_id) {
        return 'Plugin "' + plugin_id + '" is required by (' + dependList[plugin_id] + ')';
    };
    var createMsg2 = function (plugin_id) {
        return createMsg(plugin_id) + ' and cannot be removed (hint: use -f or --force)';
    };
    if (!options.force && dependPluginIds.includes(top_plugin_id)) {
        var msg = createMsg2(top_plugin_id);
        return Promise.reject(new CordovaError(msg));
    }

    // action emmiting events.
    if (options.force) {
        dependPluginIds.forEach(function (plugin_id) {
            var msg = createMsg(plugin_id);
            events.emit('log', msg + ' but forcing removal.');
        });
    } else {
        dependPluginIds.forEach(function (plugin_id) {
            var msg = createMsg2(plugin_id);
            events.emit('warn', msg);
        });
    }
    var deletePluginIds = options.force ? toDelete : toDelete.filter(function (plugin_id) { return !dependList[plugin_id]; });
    var deleteExecList = deletePluginIds.map(function (plugin_id) {
        return function () { return doDelete(plugin_id); };
    });
    return deleteExecList.reduce(function (acc, deleteExec) {
        return acc.then(deleteExec);
    }, Promise.resolve());
};

// possible options: cli_variables, www_dir, is_top_level
// Returns a promise
function runUninstallPlatform (actions, platform, project_dir, plugin_dir, plugins_dir, options) {
    var pluginInfoProvider = options.pluginInfoProvider;
    // If this plugin is not really installed, return (CB-7004).
    if (!fs.existsSync(plugin_dir)) {
        return Promise.resolve(true);
    }

    var pluginInfo = pluginInfoProvider.get(plugin_dir);
    var plugin_id = pluginInfo.id;

    // Merge cli_variables and plugin.xml variables
    var variables = variableMerge.mergeVariables(plugin_dir, platform, options);

    // Deps info can be passed recusively
    var platformJson = PlatformJson.load(plugins_dir, platform);
    var depsInfo = options.depsInfo || dependencies.generateDependencyInfo(platformJson, plugins_dir, pluginInfoProvider);

    // Check that this plugin has no dependents.
    var dependents = dependencies.dependents(plugin_id, depsInfo, platformJson, pluginInfoProvider);

    if (options.is_top_level && dependents && dependents.length > 0) {
        var msg = 'The plugin \'' + plugin_id + '\' is required by (' + dependents.join(', ') + ')';
        if (options.force) {
            events.emit('warn', msg + ' but forcing removal');
        } else {
            return Promise.reject(new CordovaError(msg + ', skipping uninstallation. (try --force if trying to update)'));
        }
    }

    // Check how many dangling dependencies this plugin has.
    var deps = depsInfo.graph.getChain(plugin_id);
    var danglers = dependencies.danglers(plugin_id, depsInfo, platformJson, pluginInfoProvider);

    var promise;
    if (deps && deps.length && danglers && danglers.length) {
        // @tests - important this event is checked spec/uninstall.spec.js
        events.emit('log', 'Uninstalling ' + danglers.length + ' dependent plugins.');
        promise = promiseutil.Q_chainmap(danglers, function (dangler) {
            var dependent_path = path.join(plugins_dir, dangler);
            var opts = Object.assign({}, options, {
                is_top_level: depsInfo.top_level_plugins.indexOf(dangler) > -1,
                depsInfo: depsInfo
            });

            return runUninstallPlatform(actions, platform, project_dir, dependent_path, plugins_dir, opts);
        });
    } else {
        promise = Promise.resolve();
    }

    var projectRoot = cordovaUtil.isCordova();

    if (projectRoot) {
        // CB-10708 This is the case when we're trying to uninstall plugin using plugman from specific
        // platform inside of the existing CLI project. This option is usually set by cordova-lib for CLI projects
        // but since we're running this code through plugman, we need to set it here implicitly
        options.usePlatformWww = true;
        options.cli_variables = variables;
    }

    return promise.then(function () {
        if (!projectRoot) return;

        var hooksRunner = new HooksRunner(projectRoot);
        var hooksRunnerOptions = {
            cordova: { platforms: [platform] },
            plugin: {
                id: pluginInfo.id,
                pluginInfo: pluginInfo,
                platform: platform,
                dir: plugin_dir
            }
        };
        return hooksRunner.fire('before_plugin_uninstall', hooksRunnerOptions);
    }).then(function () {
        return handleUninstall(actions, platform, pluginInfo, project_dir, options.www_dir, plugins_dir, options.is_top_level, options);
    });
}

// Returns a promise.
function handleUninstall (actions, platform, pluginInfo, project_dir, www_dir, plugins_dir, is_top_level, options) {
    events.emit('log', 'Uninstalling ' + pluginInfo.id + ' from ' + platform);

    // Set up platform to uninstall asset files/js modules
    // from <platform>/platform_www dir instead of <platform>/www.
    options.usePlatformWww = true;
    return platform_modules.getPlatformApi(platform, project_dir)
        .removePlugin(pluginInfo, options)
        .then(function (result) {
            // Remove plugin from installed list. This already done in platform,
            // but need to be duplicated here to remove plugin entry from project's
            // plugin list to manage dependencies properly.
            PlatformJson.load(plugins_dir, platform)
                .removePlugin(pluginInfo.id, is_top_level)
                .save();

            // CB-11022 propagate `removePlugin` result to the caller
            return Promise.resolve(result);
        });
}
