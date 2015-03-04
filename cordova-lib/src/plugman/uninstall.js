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

/* jshint laxcomma:true, sub:true, expr:true */

var path = require('path'),
    fs   = require('fs'),
    semver = require('semver'),
    shell= require('shelljs'),
    action_stack = require('./util/action-stack'),
    dependencies = require('./util/dependencies'),
    CordovaError  = require('../CordovaError'),
    underscore = require('underscore'),
    Q = require('q'),
    events = require('../events'),
    platform_modules = require('./platforms'),
    plugman = require('./plugman'),
    promiseutil = require('../util/promise-util'),
    HooksRunner = require('../hooks/HooksRunner'),
    cordovaUtil      = require('../cordova/util');

var superspawn = require('../cordova/superspawn');
var PlatformJson = require('./util/PlatformJson');
var PluginInfoProvider = require('../PluginInfoProvider');

// possible options: cli_variables, www_dir
// Returns a promise.
module.exports = uninstall;
function uninstall(platform, project_dir, id, plugins_dir, options) {
    options = options || {};
    options.is_top_level = true;
    options.pluginInfoProvider = options.pluginInfoProvider || new PluginInfoProvider();
    plugins_dir = plugins_dir || path.join(project_dir, 'cordova', 'plugins');

    // Allow `id` to be a path to a file.
    var xml_path = path.join(id, 'plugin.xml');
    if ( fs.existsSync(xml_path) ) {
        id = options.pluginInfoProvider.get(id).id;
    }

    return module.exports.uninstallPlatform(platform, project_dir, id, plugins_dir, options)
    .then(function() {
        return module.exports.uninstallPlugin(id, plugins_dir, options);
    });
}

// Returns a promise.
module.exports.uninstallPlatform = function(platform, project_dir, id, plugins_dir, options) {
    options = options || {};
    options.is_top_level = true;
    options.pluginInfoProvider = options.pluginInfoProvider || new PluginInfoProvider();
    plugins_dir = plugins_dir || path.join(project_dir, 'cordova', 'plugins');

    if (!platform_modules[platform]) {
        return Q.reject(new CordovaError(platform + ' not supported.'));
    }

    var plugin_dir = path.join(plugins_dir, id);
    if (!fs.existsSync(plugin_dir)) {
        return Q.reject(new CordovaError('Plugin "' + id + '" not found. Already uninstalled?'));
    }

    var current_stack = new action_stack();

    return Q().then(function() {
        if (options.platformVersion) {
            return Q(options.platformVersion);
        }
        return Q(superspawn.maybeSpawn(path.join(project_dir, 'cordova', 'version')));
    }).then(function(platformVersion) {
        options.platformVersion = platformVersion;
        return runUninstallPlatform(current_stack, platform, project_dir, plugin_dir, plugins_dir, options);
    });
};

// Returns a promise.
module.exports.uninstallPlugin = function(id, plugins_dir, options) {
    options = options || {};
    options.pluginInfoProvider = options.pluginInfoProvider || new PluginInfoProvider();
    var pluginInfoProvider = options.pluginInfoProvider;

    var plugin_dir = path.join(plugins_dir, id);

    // @tests - important this event is checked spec/uninstall.spec.js
    events.emit('log', 'Removing "'+ id +'"');

    // If already removed, skip.
    if ( !fs.existsSync(plugin_dir) ) {
        events.emit('verbose', 'Plugin "'+ id +'" already removed ('+ plugin_dir +')');
        return Q();
    }

    var doDelete = function(id) {
        var plugin_dir = path.join(plugins_dir, id);
        if ( !fs.existsSync(plugin_dir) ) {
            events.emit('verbose', 'Plugin "'+ id +'" already removed ('+ plugin_dir +')');
            return Q();
        }

        shell.rm('-rf', plugin_dir);
        events.emit('verbose', 'Deleted "'+ id +'"');
    };

    // We've now lost the metadata for the plugins that have been uninstalled, so we can't use that info.
    // Instead, we list all dependencies of the target plugin, and check the remaining metadata to see if
    // anything depends on them, or if they're listed as top-level.
    // If neither, they can be deleted.
    var top_plugin_id = id;

    // Recursively remove plugins which were installed as dependents (that are not top-level)
    var toDelete = [];
    function findDependencies(pluginId) {
        var depPluginDir = path.join(plugin_dir, '..', pluginId);
        // Skip plugin check for dependencies if it does not exist (CB-7846).
        if (!fs.existsSync(depPluginDir) ) {
            events.emit('verbose', 'Plugin "'+ pluginId +'" does not exist ('+ depPluginDir +')');
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
    var platforms = Object.keys(platform_modules).filter(function(platform) {
        return fs.existsSync(path.join(plugins_dir, platform + '.json'));
    });

    // Can have missing plugins on some platforms when not supported..
    var dependList = {};
    platforms.forEach(function(platform) {
        var platformJson = PlatformJson.load(plugins_dir, platform);
        var depsInfo = dependencies.generateDependencyInfo(platformJson, plugins_dir, pluginInfoProvider);
        var tlps = depsInfo.top_level_plugins;
        var deps;

        // Top-level deps must always be explicitely asked to remove by user
        tlps.forEach(function(plugin_id){
            if(top_plugin_id == plugin_id)
                return;

            var i = toDelete.indexOf(plugin_id);
            if(i >= 0)
                toDelete.splice(i, 1);
        });

        toDelete.forEach(function(plugin) {
            deps = dependencies.dependents(plugin, depsInfo, platformJson, pluginInfoProvider);

            var i = deps.indexOf(top_plugin_id);
            if(i >= 0)
                deps.splice(i, 1); // remove current/top-level plugin as blocking uninstall

            if(deps.length) {
                dependList[plugin] = deps.join(', ');
            }
        });
    });

    var i, plugin_id, msg;
    for(i in toDelete) {
        plugin_id = toDelete[i];

        if( dependList[plugin_id] ) {
            msg = '"' + plugin_id + '" is required by ('+ dependList[plugin_id] + ')';
            if(options.force) {
                events.emit('log', msg +' but forcing removal.');
            } else {
                // @tests - error and event message is checked spec/uninstall.spec.js
                msg += ' and cannot be removed (hint: use -f or --force)';

                if(plugin_id == top_plugin_id) {
                    return Q.reject( new CordovaError(msg) );
                } else {
                    events.emit('warn', msg +' and cannot be removed (hint: use -f or --force)');
                    continue;
                }
            }
        }

        doDelete(plugin_id);
    }

    return Q();
};

// possible options: cli_variables, www_dir, is_top_level
// Returns a promise
function runUninstallPlatform(actions, platform, project_dir, plugin_dir, plugins_dir, options) {
    var pluginInfoProvider = options.pluginInfoProvider;
    // If this plugin is not really installed, return (CB-7004).
    if (!fs.existsSync(plugin_dir)) {
        return Q();
    }

    var pluginInfo = pluginInfoProvider.get(plugin_dir);
    var plugin_id = pluginInfo.id;

    // Deps info can be passed recusively
    var platformJson = PlatformJson.load(plugins_dir, platform);
    var depsInfo = options.depsInfo || dependencies.generateDependencyInfo(platformJson, plugins_dir, pluginInfoProvider);

    // Check that this plugin has no dependents.
    var dependents = dependencies.dependents(plugin_id, depsInfo, platformJson, pluginInfoProvider);

    if(options.is_top_level && dependents && dependents.length > 0) {
        var msg = 'The plugin \'' + plugin_id + '\' is required by (' + dependents.join(', ') + ')';
        if(options.force) {
            events.emit('info', msg + ' but forcing removal');
        } else {
            return Q.reject( new CordovaError(msg + ', skipping uninstallation.') );
        }
    }

    // Check how many dangling dependencies this plugin has.
    var deps = depsInfo.graph.getChain(plugin_id);
    var danglers = dependencies.danglers(plugin_id, depsInfo, platformJson, pluginInfoProvider);

    var promise;
    if (deps && deps.length && danglers && danglers.length) {

        // @tests - important this event is checked spec/uninstall.spec.js
        events.emit('log', 'Uninstalling ' + danglers.length + ' dependent plugins.');
        promise = promiseutil.Q_chainmap(danglers, function(dangler) {
            var dependent_path = path.join(plugins_dir, dangler);

            var opts = underscore.extend({}, options, {
                is_top_level: depsInfo.top_level_plugins.indexOf(dangler) > -1,
                depsInfo: depsInfo
            });

            return runUninstallPlatform(actions, platform, project_dir, dependent_path, plugins_dir, opts);
        });
    } else {
        promise = Q();
    }

    var projectRoot = cordovaUtil.isCordova();

    if(projectRoot) {

        // using unified hooksRunner
        var hooksRunnerOptions = {
            cordova: { platforms: [ platform ] },
            plugin: {
                id: pluginInfo.id,
                pluginInfo: pluginInfo,
                platform: platform,
                dir: plugin_dir
            }
        };

        var hooksRunner = new HooksRunner(projectRoot);

        return promise.then(function() {
            return hooksRunner.fire('before_plugin_uninstall', hooksRunnerOptions);
        }).then(function() {
            return handleUninstall(actions, platform, pluginInfo, project_dir, options.www_dir, plugins_dir, options.is_top_level, options);
        });
    } else {
        // TODO: Need review here - this condition added for plugman install.spec.js and uninstall.spec.js passing -
        // where should we get projectRoot - via going up from project_dir?
        return handleUninstall(actions, platform, pluginInfo, project_dir, options.www_dir, plugins_dir, options.is_top_level, options);
    }
}

// Returns a promise.
function handleUninstall(actions, platform, pluginInfo, project_dir, www_dir, plugins_dir, is_top_level, options) {
    var plugin_id = pluginInfo.id;
    var plugin_dir = pluginInfo.dir;
    var platform_modules = require('./platforms');
    var handler = platform_modules[platform];
    www_dir = www_dir || handler.www_dir(project_dir);
    events.emit('log', 'Uninstalling ' + plugin_id + ' from ' + platform);

    var assets = pluginInfo.getAssets(platform);
    var sourceFiles = pluginInfo.getSourceFiles(platform);
    var headerFiles = pluginInfo.getHeaderFiles(platform);
    var libFiles = pluginInfo.getLibFiles(platform);
    var resourceFiles = pluginInfo.getResourceFiles(platform);
    var frameworkFiles = pluginInfo.getFrameworks(platform);

    // queue up native stuff
    sourceFiles.forEach(function(source) {
        actions.push(actions.createAction(handler['source-file'].uninstall,
                                         [source, project_dir, plugin_id, options],
                                         handler['source-file'].install,
                                         [source, plugin_dir, project_dir, plugin_id, options]));
    });

    headerFiles.forEach(function(header) {
        actions.push(actions.createAction(handler['header-file'].uninstall,
                                         [header, project_dir, plugin_id, options],
                                         handler['header-file'].install,
                                         [header, plugin_dir, project_dir, plugin_id, options]));
    });

    resourceFiles.forEach(function(resource) {
        actions.push(actions.createAction(handler['resource-file'].uninstall,
                                          [resource, project_dir, plugin_id, options],
                                          handler['resource-file'].install,
                                          [resource, plugin_dir, project_dir, options]));
    });

    // CB-5238 custom frameworks only
    frameworkFiles.forEach(function(framework) {
        if (framework.custom) {
            actions.push(actions.createAction(handler['framework'].uninstall,
                                              [framework, project_dir, plugin_id, options],
                                              handler['framework'].install,
                                              [framework, plugin_dir, project_dir, options]));
        }
    });

    libFiles.forEach(function(libFile) {
        actions.push(actions.createAction(handler['lib-file'].uninstall,
                                          [libFile, project_dir, plugin_id, options],
                                          handler['lib-file'].install,
                                          [libFile, plugin_dir, project_dir, plugin_id, options]));
    });

    // queue up asset installation
    var common = require('./platforms/common');
    assets.forEach(function(asset) {
        actions.push(actions.createAction(common.asset.uninstall, [asset, www_dir, plugin_id], common.asset.install, [asset, plugin_dir, www_dir]));
    });

    // run through the action stack
    return actions.process(platform, project_dir)
    .then(function() {
        // WIN!
        events.emit('verbose', plugin_id + ' uninstalled from ' + platform + '.');
        // queue up the plugin so prepare can remove the config changes
        var platformJson = PlatformJson.load(plugins_dir, platform);
        platformJson.addUninstalledPluginToPrepareQueue(plugin_id, is_top_level);
        platformJson.save();
        // call prepare after a successful uninstall
        if (options.browserify) {
            return plugman.prepareBrowserify(project_dir, platform, plugins_dir, www_dir, is_top_level, options.pluginInfoProvider);
        } else {
            return plugman.prepare(project_dir, platform, plugins_dir, www_dir, is_top_level, options.pluginInfoProvider);
        }
    }).then(function() {
        if (platform == 'android' && semver.gte(options.platformVersion, '4.0.0-dev') && frameworkFiles.length > 0) {
            events.emit('verbose', 'Updating build files since android plugin contained <framework>');
            var buildModule;
            try {
                buildModule = require(path.join(project_dir, 'cordova', 'lib', 'build'));
            } catch (e) {
                // Should occur only in unit tests.
            }
            if (buildModule && buildModule.prepBuildFiles) {
                buildModule.prepBuildFiles();
            }
        }
    });
}
