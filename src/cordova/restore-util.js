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
var cordovaPlatform = require('./platform');
var semver = require('semver');
var platformsList = require('../platforms/platforms.js');
var promiseutil = require('../util/promise-util');
var detectIndent = require('detect-indent');

exports.installPluginsFromConfigXML = installPluginsFromConfigXML;
exports.installPlatformsFromConfigXML = installPlatformsFromConfigXML;
// Install platforms looking at config.xml and package.json (if there is one).
function installPlatformsFromConfigXML (platforms, opts) {
    events.emit('verbose', 'Checking config.xml and package.json for saved platforms that haven\'t been added to the project');

    var projectHome = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectHome);
    var cfg = new ConfigParser(configPath);
    var engines = cfg.getEngines();
    var pkgJsonPath = path.join(projectHome, 'package.json');
    var pkgJson;
    var pkgJsonPlatforms;
    var comboArray = [];
    var configPlatforms = [];
    var modifiedPkgJson = false;
    var mergedPlatformSpecs = {};
    var key;
    var installAllPlatforms = !platforms || platforms.length === 0;
    var file;
    var indent;

    // Check if path exists and require pkgJsonPath.
    if (fs.existsSync(pkgJsonPath)) {
        pkgJson = require(pkgJsonPath);
        file = fs.readFileSync(pkgJsonPath, 'utf8');
        indent = detectIndent(file).indent || '  ';
    }

    if (pkgJson !== undefined && pkgJson.cordova !== undefined && pkgJson.cordova.platforms !== undefined) {
        pkgJsonPlatforms = pkgJson.cordova.platforms;
    }

    if (cfg !== undefined) {

        if (pkgJsonPlatforms !== undefined) {
            // Combining arrays and checking duplicates.
            comboArray = pkgJsonPlatforms.slice();
        }

        engines = cfg.getEngines(projectHome);

        // TODO: CB-12592: Eventually refactor out to pacakge manager module.
        // If package.json doesn't exist, auto-create one.
        if (engines.length > 0 && pkgJson === undefined) {
            pkgJson = {};
            if (cfg.packageName()) {
                pkgJson.name = cfg.packageName().toLowerCase();
            }
            if (cfg.version()) {
                pkgJson.version = cfg.version();
            }
            if (cfg.name()) {
                pkgJson.displayName = cfg.name();
            }
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent), 'utf8');
        }

        configPlatforms = engines.map(function (Engine) {
            var configPlatName = Engine.name;
            // Add specs from config into mergedPlatformSpecs.
            if (mergedPlatformSpecs[configPlatName] === undefined && Engine.spec) {
                mergedPlatformSpecs[configPlatName] = Engine.spec;
            }
            return configPlatName;
        });
        configPlatforms.forEach(function (item) {
            if (comboArray.indexOf(item) < 0) {
                comboArray.push(item);
            }
        });
        // ComboArray should have all platforms from config.xml & package.json.
        // Remove duplicates in comboArray & sort.
        var uniq = comboArray.reduce(function (a, b) {
            if (a.indexOf(b) < 0) a.push(b);
            return a;
        }, []);
        comboArray = uniq;

        // No platforms to restore from either config.xml or package.json.
        if (comboArray.length <= 0) {
            return Promise.resolve('No platforms found in config.xml or package.json. Nothing to restore');
        }

        // If no package.json, don't continue.
        if (pkgJson !== undefined) {
            // If config.xml & pkgJson exist and the cordova key is undefined, create a cordova key.
            if (pkgJson.cordova === undefined) {
                pkgJson.cordova = {};
            }
            // If there is no platforms array, create an empty one.
            if (pkgJson.cordova.platforms === undefined) {
                pkgJson.cordova.platforms = [];
            }
            // If comboArray has the same platforms as pkg.json, no modification to pkg.json.
            if (comboArray.toString() === pkgJson.cordova.platforms.toString()) {
                events.emit('verbose', 'Config.xml and package.json platforms are the same. No pkg.json modification.');
            } else {
                // Modify pkg.json to include the elements.
                // From the comboArray array so that the arrays are identical.
                events.emit('verbose', 'Config.xml and package.json platforms are different. Updating package.json with most current list of platforms.');
                modifiedPkgJson = true;
            }

            events.emit('verbose', 'Package.json and config.xml platforms are different. Updating config.xml with most current list of platforms.');
            comboArray.forEach(function (item) {
                var prefixItem = ('cordova-' + item);

                // Modify package.json if any of these cases are true:
                if ((pkgJson.dependencies === undefined && Object.keys(mergedPlatformSpecs).length) ||
                (pkgJson.dependencies && mergedPlatformSpecs && pkgJson.dependencies[item] === undefined && mergedPlatformSpecs[item]) ||
                (pkgJson.dependencies && mergedPlatformSpecs && pkgJson.dependencies[prefixItem] === undefined && mergedPlatformSpecs[prefixItem])) {
                    modifiedPkgJson = true;
                }

                // Get the cordova- prefixed spec from package.json and add it to mergedPluginSpecs.
                if (pkgJson.dependencies && pkgJson.dependencies[prefixItem]) {
                    if (mergedPlatformSpecs[prefixItem] !== pkgJson.dependencies[prefixItem]) {
                        modifiedPkgJson = true;
                    }
                    mergedPlatformSpecs[item] = pkgJson.dependencies[prefixItem];
                }

                // Get the spec from package.json and add it to mergedPluginSpecs.
                if (pkgJson.dependencies && pkgJson.dependencies[item] && pkgJson.dependencies[prefixItem] === undefined) {
                    if (mergedPlatformSpecs[item] !== pkgJson.dependencies[item]) {
                        modifiedPkgJson = true;
                    }
                    mergedPlatformSpecs[item] = pkgJson.dependencies[item];
                }
            });
        }

        // Write and update pkg.json if it has been modified.
        if (modifiedPkgJson === true) {
            pkgJson.cordova.platforms = comboArray;
            if (pkgJson.dependencies === undefined) {
                pkgJson.dependencies = {};
            }
            // Check if key is part of cordova alias list.
            // Add prefix if it is.
            for (key in mergedPlatformSpecs) {
                var prefixKey = key;
                if (key in platformsList) {
                    prefixKey = 'cordova-' + key;
                }
                pkgJson.dependencies[prefixKey] = mergedPlatformSpecs[key];
            }
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent), 'utf8');
        }
        if (!comboArray || !comboArray.length) {
            return Promise.resolve('No platforms found in config.xml and/or package.json that haven\'t been added to the project');
        }
    }
    // Run `platform add` for all the platforms separately
    // so that failure on one does not affect the other.

    // CB-9278 : Run `platform add` serially, one platform after another
    // Otherwise, we get a bug where the following line: https://github.com/apache/cordova-lib/blob/0b0dee5e403c2c6d4e7262b963babb9f532e7d27/cordova-lib/src/util/npm-helper.js#L39
    // gets executed simultaneously by each platform and leads to an exception being thrown

    return promiseutil.Q_chainmap_graceful(comboArray, function (target) {
        var cwd = process.cwd();
        var platformsFolderPath = path.join(cwd, 'platforms');
        var platformsInstalled = path.join(platformsFolderPath, target);
        if (target) {
            var platformName = target;
            // Add the spec to the target
            if (mergedPlatformSpecs[target]) {
                target = target + '@' + mergedPlatformSpecs[target];
            }
            // If the platform is already installed, no need to re-install it.
            if (!fs.existsSync(platformsInstalled) && (installAllPlatforms || platforms.indexOf(platformName) > -1)) {
                events.emit('log', 'Discovered platform "' + target + '" in config.xml or package.json. Adding it to the project');
                return cordovaPlatform('add', target, opts);
            }
        }
        return Promise.resolve();
    }, function (err) {
        events.emit('warn', err);
    });
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

    if (fs.existsSync(pkgJsonPath)) {
        const fileData = fs.readFileSync(pkgJsonPath, 'utf8');
        indent = detectIndent(fileData).indent;
        pkgJson = JSON.parse(fileData);
    }

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
        fs.outputJsonSync(pkgJsonPath, pkgJson, {
            indent: indent,
            encoding: 'utf8'
        });
    }

    const specs = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies);

    const plugins = pluginIDs.map(plID => ({
        name: plID,
        spec: specs[plID],
        variables: pkgJson.cordova.plugins[plID] || {}
    }));

    let pluginName = '';

    // CB-9560 : Run `plugin add` serially, one plugin after another
    // We need to wait for the plugin and its dependencies to be installed
    // before installing the next root plugin otherwise we can have common
    // plugin dependencies installed twice which throws a nasty error.
    return promiseutil.Q_chainmap_graceful(plugins, function (pluginConfig) {
        pluginName = pluginConfig.name;

        const pluginPath = path.join(pluginsRoot, pluginName);
        if (fs.existsSync(pluginPath)) {
            // Plugin already exists
            return Promise.resolve();
        }

        events.emit('log', `Discovered saved plugin "${pluginName}". Adding it to the project`);

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
    }, function (error) {
        // CB-10921 emit a warning in case of error
        var msg = 'Failed to restore plugin "' + pluginName + '" from config.xml. ' +
            'You might need to try adding it again. Error: ' + error;
        process.exitCode = 1;
        events.emit('warn', msg);
    });
}
