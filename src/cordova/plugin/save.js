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

var cordova_util = require('../util');
var pluginSpec = require('./plugin_spec_parser');
var ConfigParser = require('cordova-common').ConfigParser;
var PluginInfoProvider = require('cordova-common').PluginInfoProvider;
var path = require('path');
var fs = require('fs');
var Q = require('q');
var semver = require('semver');

module.exports = save;
module.exports.getSpec = getSpec;
module.exports.getPluginVariables = getPluginVariables;
module.exports.versionString = versionString;

function save (projectRoot, opts) {
    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);

    // First, remove all pre-existing plugins from config.xml
    cfg.getPluginIdList().forEach(function (plugin) {
        cfg.removePlugin(plugin);
    });

    // Then, save top-level plugins and their sources
    var jsonFile = path.join(projectRoot, 'plugins', 'fetch.json');
    var plugins;
    try {
        // It might be the case that fetch.json file is not yet existent.
        // for example: when we have never ran the command 'cordova plugin add foo' on the project
        // in that case, there's nothing to do except bubble up the error
        plugins = JSON.parse(fs.readFileSync(jsonFile, 'utf-8'));
    } catch (err) {
        return Q.reject(err.message);
    }

    Object.keys(plugins).forEach(function (pluginName) {
        var plugin = plugins[pluginName];
        var pluginSource = plugin.source;

        // If not a top-level plugin, skip it, don't save it to config.xml
        if (!plugin.is_top_level) {
            return;
        }

        var attribs = {name: pluginName};
        var spec = module.exports.getSpec(pluginSource, projectRoot, pluginName);
        if (spec) {
            attribs.spec = spec;
        }

        var variables = module.exports.getPluginVariables(plugin.variables);
        cfg.addPlugin(attribs, variables);
    });
    cfg.write();

    return Q.resolve();
}

function getSpec (pluginSource, projectRoot, pluginName) {
    if (pluginSource.hasOwnProperty('url') || pluginSource.hasOwnProperty('path')) {
        return pluginSource.url || pluginSource.path;
    }

    var version = null;
    var scopedPackage = null;
    if (pluginSource.hasOwnProperty('id')) {
        // Note that currently version is only saved here if it was explicitly specified when the plugin was added.
        var parsedSpec = pluginSpec.parse(pluginSource.id);
        version = parsedSpec.version;
        if (version) {
            version = module.exports.versionString(version);
        }

        if (parsedSpec.scope) {
            scopedPackage = parsedSpec.package;
        }
    }

    if (!version) {
        // Fallback on getting version from the plugin folder, if it's there
        var pluginInfoProvider = new PluginInfoProvider();
        var dir = path.join(projectRoot, 'plugins', pluginName);

        try {
            // pluginInfoProvider.get() will throw if directory does not exist.
            var pluginInfo = pluginInfoProvider.get(dir);
            if (pluginInfo) {
                version = module.exports.versionString(pluginInfo.version);
            }
        } catch (err) {
        }
    }

    if (scopedPackage) {
        version = scopedPackage + '@' + version;
    }

    return version;
}

function getPluginVariables (variables) {
    var result = [];
    if (!variables) {
        return result;
    }

    Object.keys(variables).forEach(function (pluginVar) {
        result.push({name: pluginVar, value: variables[pluginVar]});
    });

    return result;
}

function versionString (version) {
    var validVersion = semver.valid(version, true);
    if (validVersion) {
        return '~' + validVersion;
    }

    if (semver.validRange(version, true)) {
        // Return what we were passed rather than the result of the validRange() call, as that call makes modifications
        // we don't want, like converting '^1.2.3' to '>=1.2.3-0 <2.0.0-0'
        return version;
    }

    return null;
}
