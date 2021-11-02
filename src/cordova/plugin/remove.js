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

const ConfigParser = require('cordova-common').ConfigParser;
const CordovaError = require('cordova-common').CordovaError;
const events = require('cordova-common').events;
const cordova_util = require('../util');
const plugin_util = require('./util');
const plugman = require('../../plugman/plugman');
const metadata = require('../../plugman/util/metadata');
const path = require('path');
const fs = require('fs-extra');
const PluginInfoProvider = require('cordova-common').PluginInfoProvider;
const detectIndent = require('detect-indent');
const { Q_chainmap } = require('../../util/promise-util');
const preparePlatforms = require('../prepare/platforms');

module.exports = remove;
module.exports.validatePluginId = validatePluginId;

function remove (projectRoot, targets, hooksRunner, opts) {
    if (!targets || !targets.length) {
        return Promise.reject(new CordovaError('No plugin specified. Please specify a plugin to remove. See: ' + cordova_util.binname + ' plugin list.'));
    }
    const pluginPath = path.join(projectRoot, 'plugins');
    const plugins = cordova_util.findPlugins(pluginPath);
    const platformList = cordova_util.listPlatforms(projectRoot);
    let shouldRunPrepare = false;
    const xml = cordova_util.projectConfig(projectRoot);
    const cfg = new ConfigParser(xml);

    opts.cordova = { plugins: cordova_util.findPlugins(pluginPath) };
    return hooksRunner.fire('before_plugin_rm', opts)
        .then(function () {
            return Q_chainmap(opts.plugins, removePlugin);
        }).then(function () {
            // CB-11022 We do not need to run prepare after plugin install until shouldRunPrepare flag is set to true
            if (!shouldRunPrepare) {
                return Promise.resolve();
            }
            return preparePlatforms(platformList, projectRoot, opts);
        }).then(function () {
            opts.cordova = { plugins: cordova_util.findPlugins(pluginPath) };
            return hooksRunner.fire('after_plugin_rm', opts);
        });

    function removePlugin (target) {
        return Promise.resolve()
            .then(function () {
                const validatedPluginId = module.exports.validatePluginId(target, plugins);
                if (!validatedPluginId) {
                    throw new CordovaError('Plugin "' + target + '" is not present in the project. See `' + cordova_util.binname + ' plugin list`.');
                }
                target = validatedPluginId;
            }).then(function () {
                // Iterate over all installed platforms and uninstall.
                // If this is a web-only or dependency-only plugin, then
                // there may be nothing to do here except remove the
                // reference from the platform's plugin config JSON.
                return Q_chainmap(platformList, platform =>
                    removePluginFromPlatform(target, platform)
                );
            }).then(function () {
                // TODO: Should only uninstallPlugin when no platforms have it.
                return plugman.uninstall.uninstallPlugin(target, pluginPath, opts);
            }).then(function () {
                if (!opts.save) return;
                persistRemovalToCfg(target);
                persistRemovalToPkg(target);
            }).then(function () {
                // Remove plugin from fetch.json
                events.emit('verbose', 'Removing plugin ' + target + ' from fetch.json');
                metadata.remove_fetch_metadata(pluginPath, target);
            });
    }

    function removePluginFromPlatform (target, platform) {
        let platformRoot;

        return Promise.resolve().then(function () {
            platformRoot = path.join(projectRoot, 'platforms', platform);
            const directory = path.join(pluginPath, target);
            const pluginInfo = new PluginInfoProvider().get(directory);
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
    }

    function persistRemovalToCfg (target) {
        const configPath = cordova_util.projectConfig(projectRoot);
        if (fs.existsSync(configPath)) { // should not happen with real life but needed for tests
            const configXml = new ConfigParser(configPath);

            if (configXml.getPlugin(target)) {
                events.emit('log', 'Removing plugin ' + target + ' from config.xml file...');
                configXml.removePlugin(target);
                configXml.write();
            }
        }
    }

    function persistRemovalToPkg (target) {
        let pkgJson;
        const pkgJsonPath = path.join(projectRoot, 'package.json');
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
            const file = fs.readFileSync(pkgJsonPath, 'utf8');
            const indent = detectIndent(file).indent || '  ';
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent), 'utf8');
        }
    }
}

function validatePluginId (pluginId, installedPlugins) {
    if (installedPlugins.indexOf(pluginId) >= 0) {
        return pluginId;
    }

    if (pluginId.indexOf('cordova-plugin-') < 0) {
        return validatePluginId('cordova-plugin-' + pluginId, installedPlugins);
    }
}
