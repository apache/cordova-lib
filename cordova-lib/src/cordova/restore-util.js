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

var cordova_util    = require('./util'),
    ConfigParser    = require('cordova-common').ConfigParser,
    path            = require('path'),
    Q               = require('q'),
    fs              = require('fs'),
    events          = require('cordova-common').events,
    cordova         = require('./cordova'),
    semver          = require('semver'),
    platformsList   = require('../platforms/platforms.js'),
    promiseutil     = require('../util/promise-util');

exports.installPluginsFromConfigXML = installPluginsFromConfigXML;
exports.installPlatformsFromConfigXML = installPlatformsFromConfigXML;
// Install platforms looking at config.xml and package.json (if there is one).
function installPlatformsFromConfigXML(platforms, opts) {
    events.emit('verbose', 'Checking config.xml and package.json for saved platforms that haven\'t been added to the project');

    var projectHome = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectHome);
    var cfg = new ConfigParser(configPath);
    var engines = cfg.getEngines();
    var pkgJsonPath = path.join(projectHome,'package.json');
    var pkgJson;
    var pkgJsonPlatforms;
    var comboArray = []; 
    var configPlatforms = [];
    var modifiedPkgJson = false;
    var modifiedConfigXML = false;
    var mergedPlatformSpecs = {};
    var key;

    // Check if path exists and require pkgJsonPath.
    if(fs.existsSync(pkgJsonPath)) {
        pkgJson = require(pkgJsonPath);
    }
    if(pkgJson !== undefined && pkgJson.cordova !== undefined && pkgJson.cordova.platforms !== undefined) {
        pkgJsonPlatforms = pkgJson.cordova.platforms;
    } 
    
    if(cfg !== undefined) {

        if (pkgJsonPlatforms !== undefined) {
            // Combining arrays and checking duplicates.
            comboArray = pkgJsonPlatforms.slice();
        }

        engines = cfg.getEngines(projectHome);
        configPlatforms = engines.map(function(Engine) {
            var configPlatName = Engine.name;
            // Add specs from config into mergedPlatformSpecs.
            if(mergedPlatformSpecs[configPlatName] === undefined && Engine.spec) {
                mergedPlatformSpecs[configPlatName] = Engine.spec;
            }
            return configPlatName;
        });
        configPlatforms.forEach(function(item) {
            if(comboArray.indexOf(item) < 0 ) {
                comboArray.push(item);
            }
        });
        // ComboArray should have all platforms from config.xml & package.json.
        // Remove duplicates in comboArray & sort.
        var uniq = comboArray.reduce(function(a,b) {
            if (a.indexOf(b) < 0 ) a.push(b);
                return a;
        },[]);
        comboArray = uniq;
        comboArray = comboArray.sort();

        // No platforms to restore from either config.xml or package.json.
        if (comboArray.length <= 0) {
           return Q('No platforms found in config.xml or package.json. Nothing to restore');
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
            if (comboArray.toString() === pkgJson.cordova.platforms.sort().toString()) {
                events.emit('verbose', 'Config.xml and package.json platforms are the same. No pkg.json modification.');
            } else {
                // Modify pkg.json to include the elements.
                // From the comboArray array so that the arrays are identical.
                events.emit('verbose', 'Config.xml and package.json platforms are different. Updating package.json with most current list of platforms.');
                modifiedPkgJson = true;
            }

            events.emit('verbose', 'Package.json and config.xml platforms are different. Updating config.xml with most current list of platforms.');
            comboArray.forEach(function(item) {
                var prefixItem = ('cordova-'+item);
                // Modify package.json if any of these cases are true:
                if((pkgJson.dependencies === undefined && Object.keys(mergedPlatformSpecs).length)||
                    (pkgJson.dependencies[item] === undefined && mergedPlatformSpecs[item]) ||
                    (pkgJson.dependencies[prefixItem] === undefined && mergedPlatformSpecs[prefixItem])) {
                    modifiedPkgJson = true;
                }

                // Get the cordova- prefixed spec from package.json and add it to mergedPluginSpecs.
                if (pkgJson.dependencies && pkgJson.dependencies[prefixItem]) {
                    if(mergedPlatformSpecs[prefixItem] != pkgJson.dependencies[prefixItem]) {
                        modifiedPkgJson = true;
                    }
                    mergedPlatformSpecs[item] = pkgJson.dependencies[prefixItem];
                }

                // Get the spec from package.json and add it to mergedPluginSpecs.
                if (pkgJson.dependencies && pkgJson.dependencies[item] && pkgJson.dependencies[prefixItem] === undefined) {
                    if(mergedPlatformSpecs[item] != pkgJson.dependencies[item]) {
                        modifiedPkgJson = true;
                    }
                    mergedPlatformSpecs[item] = pkgJson.dependencies[item];
                }

                // First remove the engine and then add missing engine and elements to config.xml.
                // Remove to avoid duplicate engines.
                if(mergedPlatformSpecs[item]) {
                    cfg.removeEngine(item);
                    cfg.addEngine(item, mergedPlatformSpecs[item]);
                    modifiedConfigXML = true;
                // If there is no spec, just remove and add the engine.
                } else if (configPlatforms.indexOf(item) < 0) {
                    cfg.removeEngine(item);
                    cfg.addEngine(item);
                    modifiedConfigXML = true;
                } 
            });
        }

        // Write and update pkg.json if it has been modified.
        if (modifiedPkgJson === true) {
            pkgJson.cordova.platforms = comboArray;
            if(pkgJson.dependencies === undefined) {
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
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
        }
        if (modifiedConfigXML === true) {
            cfg.write();
        }
        if (!comboArray || !comboArray.length) {
            return Q('No platforms found in config.xml and/or package.json that haven\'t been added to the project');
        }
    }
    // Run `platform add` for all the platforms separately
    // so that failure on one does not affect the other.

    // CB-9278 : Run `platform add` serially, one platform after another
    // Otherwise, we get a bug where the following line: https://github.com/apache/cordova-lib/blob/0b0dee5e403c2c6d4e7262b963babb9f532e7d27/cordova-lib/src/util/npm-helper.js#L39
    // gets executed simultaneously by each platform and leads to an exception being thrown
    return promiseutil.Q_chainmap_graceful(comboArray, function(target) {
        var cwd = process.cwd();
        var platformsFolderPath = path.join(cwd,'platforms');
        var platformsInstalled = path.join(platformsFolderPath, target);
        if (target) {
            // Add the spec to the target
            if(mergedPlatformSpecs[target]) {
                target = target + '@' + mergedPlatformSpecs[target];
            }
            // If the platform is already installed, no need to re-install it.
            if (!fs.existsSync(platformsInstalled)) {
                events.emit('log', 'Discovered platform \"' + target + '\" in config.xml or package.json. Adding it to the project');
                return cordova.raw.platform('add', target, opts);
            }
        }
        return Q();
    }, function(err) {
        events.emit('warn', err);
    });
}

// Returns a promise.
function installPluginsFromConfigXML(args) {
    events.emit('verbose', 'Checking config.xml for saved plugins that haven\'t been added to the project');
    //Install plugins that are listed in config.xml.
    var projectRoot = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(configPath);
    var plugins_dir = path.join(projectRoot, 'plugins');
    var pkgJsonPath = path.join(projectRoot,'package.json');
    var pkgJson;
    var modifiedPkgJson = false;
    var modifiedConfigXML = false;
    var comboObject;
    var mergedPluginSpecs = {};
    var comboPluginIdArray;
    var configPlugin;
    var configPluginVariables;
    var pkgJsonPluginVariables;
    var key;

    // Check if path exists and require pkgJsonPath.
    if(fs.existsSync(pkgJsonPath)) {
        pkgJson = require(pkgJsonPath);
    }

    if(pkgJson !== undefined && pkgJson.cordova !== undefined && pkgJson.cordova.plugins !== undefined) {
        comboPluginIdArray = Object.keys(pkgJson.cordova.plugins);
        // Create a merged plugin data array (comboObject)
        // and add all of the package.json plugins to comboObject.
        comboObject = pkgJson.cordova.plugins;
    } else {
        comboObject = {};
        comboPluginIdArray = [];
    }

    // Get all config.xml plugin ids (names).
    var pluginIdConfig = cfg.getPluginIdList();
    if(pluginIdConfig === undefined) {
        pluginIdConfig = [];
    }

    if(pkgJson !== undefined) {
        if (pkgJson.cordova === undefined) {
            pkgJson.cordova = {};
        }
        if (pkgJson.cordova.plugins === undefined) {
            pkgJson.cordova.plugins = {};
        }

        // Check to see which plugins are initially the same in pkg.json and config.xml.
        // Add missing plugin variables in package.json from config.xml.
        comboPluginIdArray.forEach(function(item) {
            if(pluginIdConfig.includes(item)) {
                configPlugin = cfg.getPlugin(item);
                configPluginVariables = configPlugin.variables;
                pkgJsonPluginVariables = comboObject[item];
                for(var key in configPluginVariables) {
                    // Handle conflicts, package.json wins.
                    // Only add the variable to package.json if it doesn't already exist.
                    if(pkgJsonPluginVariables[key] === undefined) {
                        pkgJsonPluginVariables[key] = configPluginVariables[key];
                        comboObject[item][key] = configPluginVariables[key];
                        modifiedPkgJson = true;
                    }
                }
            }
            // Get the spec from package.json and add it to mergedPluginSpecs.
            if (pkgJson.dependencies && pkgJson.dependencies[item]) {
                mergedPluginSpecs[item] = pkgJson.dependencies[item];
            }
        });

        // Check to see if pkg.json plugin(id) and config plugin(id) match.
        if(comboPluginIdArray.sort().toString() !== pluginIdConfig.sort().toString()) {
            // If there is a config plugin that does NOT already exist in
            // mergedPluginDataArray, add it and its variables.
            pluginIdConfig.forEach(function(item) {
                if(comboPluginIdArray.indexOf(item) < 0) {
                    comboPluginIdArray.push(item);
                    var configXMLPlugin = cfg.getPlugin(item);
                    comboObject[item] = configXMLPlugin.variables;
                    modifiedPkgJson = true;
                }
            });
        }

        // Add specs from config.xml to mergedPluginSpecs.
        pluginIdConfig.forEach(function(item) {
            var configXMLPlugin = cfg.getPlugin(item);
            if(mergedPluginSpecs[item] === undefined && configXMLPlugin.spec) {
                mergedPluginSpecs[item] = configXMLPlugin.spec;
                modifiedPkgJson = true;
            }
        });
        // If pkg.json plugins have been modified, write to it.
        if (modifiedPkgJson === true) {
            pkgJson.cordova.plugins = comboObject;
            if(pkgJson.dependencies === undefined) {
                pkgJson.dependencies = {};
            }
            for(key in mergedPluginSpecs) {
                pkgJson.dependencies[key] = mergedPluginSpecs[key];
            }
            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
        }
    }
    // Write config.xml (only if plugins exist in package.json).
    comboPluginIdArray.forEach(function(plugID) {
        if(pluginIdConfig.indexOf(plugID) < 0) {
            pluginIdConfig.push(plugID);
        }
        cfg.removePlugin(plugID);
        if (mergedPluginSpecs[plugID]) {
            cfg.addPlugin({name:plugID, spec: mergedPluginSpecs[plugID]}, comboObject[plugID]); 
            modifiedConfigXML = true;
        // If no spec, just add the plugin.
        } else {
            cfg.addPlugin({name:plugID}, comboObject[plugID]); 
            modifiedConfigXML = true;
        }
    });

    if (modifiedConfigXML === true) {
        cfg.write();    
    }
    
    // Intermediate variable to store current installing plugin name
    // to be able to create informative warning on plugin failure
    var pluginName;
    // CB-9560 : Run `plugin add` serially, one plugin after another
    // We need to wait for the plugin and its dependencies to be installed
    // before installing the next root plugin otherwise we can have common
    // plugin dependencies installed twice which throws a nasty error.
    return promiseutil.Q_chainmap_graceful(pluginIdConfig, function(featureId) {
        var pluginPath = path.join(plugins_dir, featureId);
        if (fs.existsSync(pluginPath)) {
            // Plugin already exists
            return Q();
        }
        events.emit('log', 'Discovered plugin "' + featureId + '" in config.xml. Adding it to the project');
        var pluginEntry = cfg.getPlugin(featureId);

        // Install from given URL if defined or using a plugin id. If spec isn't a valid version or version range,
        // assume it is the location to install from.
        var pluginSpec = pluginEntry.spec;
        pluginName = pluginEntry.name;

        // CB-10761 If plugin spec is not specified, use plugin name
        var installFrom = pluginSpec || pluginName;
        if (pluginSpec && semver.validRange(pluginSpec, true)) {
            installFrom = pluginName + '@' + pluginSpec;
        } else if(args.fetch && pluginSpec) {
            installFrom = pluginName + '@' + pluginSpec;
        }

        // Add feature preferences as CLI variables if have any
        var options = {
            cli_variables: pluginEntry.variables,
            searchpath: args.searchpath,
            fetch: args.fetch || false,
            save: args.save || false
        };
        var plugin = require('./plugin');
        return plugin('add', installFrom, options);
    }, function (error) {
        // CB-10921 emit a warning in case of error
        var msg = 'Failed to restore plugin \"' + pluginName + '\" from config.xml. ' +
            'You might need to try adding it again. Error: ' + error;
        events.emit('warn', msg);
    });
}
