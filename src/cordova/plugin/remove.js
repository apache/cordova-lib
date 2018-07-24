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

var ConfigParser = require('cordova-common').ConfigParser;
var CordovaError = require('cordova-common').CordovaError;
var events = require('cordova-common').events;
var cordova_util = require('../util');
var config = require('../config');
var plugin_util = require('./util');
var plugman = require('../../plugman/plugman');
var metadata = require('../../plugman/util/metadata');
var Q = require('q');
var path = require('path');
var fs = require('fs');
var PluginInfoProvider = require('cordova-common').PluginInfoProvider;
var detectIndent = require('detect-indent');

module.exports = remove;
module.exports.validatePluginId = validatePluginId;

function remove (projectRoot, targets, hooksRunner, opts) {
    if (!targets || !targets.length) {
        return Q.reject(new CordovaError('No plugin specified. Please specify a plugin to remove. See: ' + cordova_util.binname + ' plugin list.'));
    }
    var config_json = config.read(projectRoot);
    var pluginPath = path.join(projectRoot, 'plugins');
    var plugins = cordova_util.findPlugins(pluginPath);
    var platformList = cordova_util.listPlatforms(projectRoot);
    var shouldRunPrepare = false;
    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);

    opts.cordova = { plugins: cordova_util.findPlugins(pluginPath) };
    return hooksRunner.fire('before_plugin_rm', opts)
        .then(function () {
            var pluginInfoProvider = new PluginInfoProvider();
            var platformRoot;
            return opts.plugins.reduce(function (soFar, target) {
                var validatedPluginId = module.exports.validatePluginId(target, plugins);
                if (!validatedPluginId) {
                    return Q.reject(new CordovaError('Plugin "' + target + '" is not present in the project. See `' + cordova_util.binname + ' plugin list`.'));
                }
                target = validatedPluginId;

                // Iterate over all installed platforms and uninstall.
                // If this is a web-only or dependency-only plugin, then
                // there may be nothing to do here except remove the
                // reference from the platform's plugin config JSON.
                return soFar.then(_ => platformList.reduce(function (soFar, platform) {
                    return soFar.then(function () {
                        platformRoot = path.join(projectRoot, 'platforms', platform);
                        var directory = path.join(pluginPath, target);
                        var pluginInfo = pluginInfoProvider.get(directory);
                        events.emit('verbose', 'Calling plugman.uninstall on plugin "' + target + '" for platform "' + platform + '"');
                        opts.force = opts.force || false;

                        return plugin_util.mergeVariables(pluginInfo, cfg, opts);
                    }).then(function (variables) {
                        opts.cli_variables = variables;
                        return plugman.uninstall.uninstallPlatform(platform, platformRoot, target, pluginPath, opts)
                            .then(function (didPrepare) {
                                // If platform does not returned anything we'll need
                                // to trigger a prepare after all plugins installed
                                // TODO: if didPrepare is falsy, what does that imply? WHY are we doing this?
                                if (!didPrepare) shouldRunPrepare = true;
                            });
                    });
                }, Q()))
                    .then(function () {
                        // TODO: Should only uninstallPlugin when no platforms have it.
                        return plugman.uninstall.uninstallPlugin(target, pluginPath, opts);
                    }).then(function () {
                        // remove plugin from config.xml
                        if (plugin_util.saveToConfigXmlOn(config_json, opts)) {
                            events.emit('log', 'Removing plugin ' + target + ' from config.xml file...');
                            var configPath = cordova_util.projectConfig(projectRoot);
                            if (fs.existsSync(configPath)) { // should not happen with real life but needed for tests
                                var configXml = new ConfigParser(configPath);
                                configXml.removePlugin(target);
                                configXml.write();
                            }
                            var pkgJson;
                            var pkgJsonPath = path.join(projectRoot, 'package.json');
                            // If statement to see if pkgJsonPath exists in the filesystem
                            if (fs.existsSync(pkgJsonPath)) {
                                // delete any previous caches of require(package.json)
                                pkgJson = cordova_util.requireNoCache(pkgJsonPath);
                            }
                            // If package.json exists and contains a specified plugin in cordova['plugins'], it will be removed
                            if (pkgJson !== undefined && pkgJson.cordova !== undefined && pkgJson.cordova.plugins !== undefined) {
                                events.emit('log', 'Removing ' + target + ' from package.json');
                                // Remove plugin from package.json
                                delete pkgJson.cordova.plugins[target];
                                // Write out new package.json with plugin removed correctly.
                                var file = fs.readFileSync(pkgJsonPath, 'utf8');
                                var indent = detectIndent(file).indent || '  ';
                                fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent), 'utf8');
                            }
                        }
                    }).then(function () {
                        // Remove plugin from fetch.json
                        events.emit('verbose', 'Removing plugin ' + target + ' from fetch.json');
                        metadata.remove_fetch_metadata(pluginPath, target);
                    });
            }, Q());
        }).then(function () {
            // CB-11022 We do not need to run prepare after plugin install until shouldRunPrepare flag is set to true
            if (!shouldRunPrepare) {
                return Q();
            }
            return require('../prepare').preparePlatforms(platformList, projectRoot, opts);
        }).then(function () {
            opts.cordova = { plugins: cordova_util.findPlugins(pluginPath) };
            return hooksRunner.fire('after_plugin_rm', opts);
        });
}

function validatePluginId (pluginId, installedPlugins) {
    if (installedPlugins.indexOf(pluginId) >= 0) {
        return pluginId;
    }

    if (pluginId.indexOf('cordova-plugin-') < 0) {
        return validatePluginId('cordova-plugin-' + pluginId, installedPlugins);
    }
}
