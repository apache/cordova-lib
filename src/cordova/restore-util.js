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

var cordova_util = require('./util');
var ConfigParser = require('cordova-common').ConfigParser;
var path = require('path');
var fs = require('fs-extra');
var events = require('cordova-common').events;
var semver = require('semver');
var detectIndent = require('detect-indent');
var detectNewline = require('detect-newline');
var stringifyPackage = require('stringify-package');
var writeFileAtomicSync = require('write-file-atomic').sync;

exports.installPluginsFromConfigXML = installPluginsFromConfigXML;
exports.installPlatformsFromConfigXML = installPlatformsFromConfigXML;

// Install platforms looking at config.xml and package.json (if there is one).
function installPlatformsFromConfigXML (platforms, opts) {
    events.emit('verbose', 'Checking for saved platforms that haven\'t been added to the project');

    const installAllPlatforms = !platforms || platforms.length === 0;
    const projectRoot = cordova_util.getProjectRoot();
    const platformRoot = path.join(projectRoot, 'platforms');
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    const confXmlPath = cordova_util.projectConfig(projectRoot);
    const cfg = new ConfigParser(confXmlPath);

    let pkgJson = {};
    let indent = '  ';
    let newline = '\n';

    if (fs.existsSync(pkgJsonPath)) {
        const fileData = fs.readFileSync(pkgJsonPath, 'utf8');
        indent = detectIndent(fileData).indent;
        newline = detectNewline(fileData);
        pkgJson = JSON.parse(fileData);
    } else {
        if (cfg.packageName()) {
            pkgJson.name = cfg.packageName().toLowerCase();
        }

        if (cfg.version()) {
            pkgJson.version = cfg.version();
        }

        if (cfg.name()) {
            pkgJson.displayName = cfg.name();
        }
    }

    pkgJson.dependencies = pkgJson.dependencies || {};
    pkgJson.devDependencies = pkgJson.devDependencies || {};
    pkgJson.cordova = pkgJson.cordova || {};
    pkgJson.cordova.platforms = pkgJson.cordova.platforms || [];

    const pkgPlatforms = pkgJson.cordova.platforms.slice();
    const pkgSpecs = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies);

    // Check for platforms listed in config.xml
    const cfgPlatforms = cfg.getEngines();

    cfgPlatforms.forEach(engine => {
        const platformModule = engine.name.startsWith('cordova-') ? engine.name : `cordova-${engine.name}`;

        // If package.json includes the platform, we use that config
        // Otherwise, we need to add the platform to package.json
        if (!pkgPlatforms.includes(engine.name) || (engine.spec && !(platformModule in pkgSpecs))) {
            events.emit('info', `Platform '${engine.name}' found in config.xml... Migrating it to package.json`);

            // If config.xml has a spec for the platform and package.json has
            // not, add the spec to devDependencies of package.json
            if (engine.spec && !(platformModule in pkgSpecs)) {
                pkgJson.devDependencies[platformModule] = engine.spec;
            }

            if (!pkgPlatforms.includes(engine.name)) {
                pkgJson.cordova.platforms.push(engine.name);
            }
        }
    });

    // Now that platforms have been updated, re-fetch them from package.json
    const platformIDs = pkgJson.cordova.platforms.slice();

    if (platformIDs.length !== pkgPlatforms.length) {
        // We've modified package.json and need to save it
        writeFileAtomicSync(pkgJsonPath, stringifyPackage(pkgJson, indent, newline), { encoding: 'utf8' });
    }

    const specs = Object.assign({}, pkgJson.dependencies || {}, pkgJson.devDependencies);

    const platformInfo = platformIDs.map(plID => ({
        name: plID,
        spec: specs[plID]
    }));

    let platformName = '';

    function restoreCallback (platform) {
        platformName = platform.name;

        const platformPath = path.join(platformRoot, platformName);
        if (fs.existsSync(platformPath) || (!installAllPlatforms && !platforms.includes(platformName))) {
            // Platform already exists
            return Promise.resolve();
        }

        events.emit('log', `Discovered platform "${platformName}". Adding it to the project`);

        // Install from given URL if defined or using a plugin id. If spec
        // isn't a valid version or version range, assume it is the location to
        // install from.
        // CB-10761 If plugin spec is not specified, use plugin name
        var installFrom = platform.spec || platformName;
        if (platform.spec && semver.validRange(platform.spec, true)) {
            installFrom = platformName + '@' + platform.spec;
        }

        const cordovaPlatform = require('./platform');
        return cordovaPlatform('add', installFrom, opts);
    }

    function errCallback (error) {
        // CB-10921 emit a warning in case of error
        const msg = `Failed to restore platform "${platformName}". You might need to try adding it again. Error: ${error}`;
        process.exitCode = 1;
        events.emit('warn', msg);

        return Promise.reject(error);
    }

    // CB-9278 : Run `platform add` serially, one platform after another
    // Otherwise, we get a bug where the following line: https://github.com/apache/cordova-lib/blob/0b0dee5e403c2c6d4e7262b963babb9f532e7d27/cordova-lib/src/util/npm-helper.js#L39
    // gets executed simultaneously by each platform and leads to an exception being thrown
    return platformInfo.reduce(function (soFar, platform) {
        return soFar.then(() => restoreCallback(platform), errCallback);
    }, Promise.resolve());
}

// Returns a promise.
function installPluginsFromConfigXML (args) {
    events.emit('verbose', 'Checking for saved plugins that haven\'t been added to the project');

    const projectRoot = cordova_util.getProjectRoot();
    const pluginsRoot = path.join(projectRoot, 'plugins');
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    const confXmlPath = cordova_util.projectConfig(projectRoot);

    let pkgJson = {};
    let indent = '  ';
    let newline = '\n';

    if (fs.existsSync(pkgJsonPath)) {
        const fileData = fs.readFileSync(pkgJsonPath, 'utf8');
        indent = detectIndent(fileData).indent;
        newline = detectNewline(fileData);
        pkgJson = JSON.parse(fileData);
    }

    pkgJson.dependencies = pkgJson.dependencies || {};
    pkgJson.devDependencies = pkgJson.devDependencies || {};
    pkgJson.cordova = pkgJson.cordova || {};
    pkgJson.cordova.plugins = pkgJson.cordova.plugins || {};

    const pkgPluginIDs = Object.keys(pkgJson.cordova.plugins);
    const pkgSpecs = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies);

    // Check for plugins listed in config.xml
    const cfg = new ConfigParser(confXmlPath);
    const cfgPluginIDs = cfg.getPluginIdList();

    cfgPluginIDs.forEach(plID => {
        // If package.json includes the plugin, we use that config
        // Otherwise, we need to add the plugin to package.json
        if (!pkgPluginIDs.includes(plID)) {
            events.emit('info', `Plugin '${plID}' found in config.xml... Migrating it to package.json`);

            const cfgPlugin = cfg.getPlugin(plID);

            // If config.xml has a spec for the plugin and package.json has not,
            // add the spec to devDependencies of package.json
            if (cfgPlugin.spec && !(plID in pkgSpecs)) {
                pkgJson.devDependencies[plID] = cfgPlugin.spec;
            }

            pkgJson.cordova.plugins[plID] = Object.assign({}, cfgPlugin.variables);
        }
    });

    // Now that plugins have been updated, re-fetch them from package.json
    const pluginIDs = Object.keys(pkgJson.cordova.plugins);

    if (pluginIDs.length !== pkgPluginIDs.length) {
        // We've modified package.json and need to save it
        writeFileAtomicSync(pkgJsonPath, stringifyPackage(pkgJson, indent, newline), { encoding: 'utf8' });
    }

    const specs = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies);

    const plugins = pluginIDs.map(plID => ({
        name: plID,
        spec: specs[plID],
        variables: pkgJson.cordova.plugins[plID] || {}
    }));

    let pluginName = '';

    function restoreCallback (pluginConfig) {
        pluginName = pluginConfig.name;

        const pluginPath = path.join(pluginsRoot, pluginName);
        if (fs.existsSync(pluginPath)) {
            // Plugin already exists
            return Promise.resolve();
        }

        events.emit('log', `Discovered plugin "${pluginName}". Adding it to the project`);

        // Install from given URL if defined or using a plugin id. If spec isn't a valid version or version range,
        // assume it is the location to install from.
        // CB-10761 If plugin spec is not specified, use plugin name
        var installFrom = pluginConfig.spec || pluginName;
        if (pluginConfig.spec && semver.validRange(pluginConfig.spec, true)) {
            installFrom = pluginName + '@' + pluginConfig.spec;
        }

        // Add feature preferences as CLI variables if have any
        var options = {
            cli_variables: pluginConfig.variables,
            searchpath: args.searchpath,
            save: args.save || false
        };

        const plugin = require('./plugin');
        return plugin('add', installFrom, options);
    }

    function errCallback (error) {
        // CB-10921 emit a warning in case of error
        const msg = `Failed to restore plugin "${pluginName}". You might need to try adding it again. Error: ${error}`;
        process.exitCode = 1;
        events.emit('warn', msg);
    }

    // CB-9560 : Run `plugin add` serially, one plugin after another
    // We need to wait for the plugin and its dependencies to be installed
    // before installing the next root plugin otherwise we can have common
    // plugin dependencies installed twice which throws a nasty error.
    return plugins.reduce(function (soFar, plugin) {
        return soFar.then(() => restoreCallback(plugin), errCallback);
    }, Promise.resolve());
}
