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
var cordovaUtil = require('../cordova/util');
var events = require('cordova-common').events;
var PluginInfoProvider = require('cordova-common').PluginInfoProvider;
var ConfigParser = require('cordova-common').ConfigParser;

/**
 * Implements logic to retrieve hook script files defined in special folders and configuration
 * files: config.xml, hooks/hook_type, plugins/../plugin.xml, etc
 */
module.exports = {
    /**
     * Returns all script files for the hook type specified.
     */
    getHookScripts: function (hook, opts) {
        // args check
        if (!hook) {
            throw new Error('hook type is not specified');
        }
        return getApplicationHookScripts(hook, opts)
            .concat(getPluginsHookScripts(hook, opts));
    }
};

/**
 * Gets all scripts defined in config.xml with the specified type and platforms.
 */
function getApplicationHookScripts (hook, opts) {
    // args check
    if (!hook) {
        throw new Error('hook type is not specified');
    }

    const configPath = cordovaUtil.projectConfig(opts.projectRoot);
    const configXml = new ConfigParser(configPath);

    return configXml.getHookScripts(hook, opts.cordova.platforms)
        .map(scriptElement => ({
            path: scriptElement.attrib.src,
            fullPath: path.join(opts.projectRoot, scriptElement.attrib.src)
        }));
}

/**
 * Returns script files defined by plugin developers as part of plugin.xml.
 */
function getPluginsHookScripts (hook, opts) {
    // args check
    if (!hook) {
        throw new Error('hook type is not specified');
    }

    // In case before_plugin_install, after_plugin_install, before_plugin_uninstall hooks we receive opts.plugin and
    // retrieve scripts exclusive for this plugin.
    if (opts.plugin) {
        events.emit('verbose', 'Finding scripts for "' + hook + '" hook from plugin ' + opts.plugin.id + ' on ' + opts.plugin.platform + ' platform only.');
        // if plugin hook is not run for specific platform then use all available platforms
        return getPluginScriptFiles(opts.plugin, hook, opts.plugin.platform ? [opts.plugin.platform] : opts.cordova.platforms);
    }

    return getAllPluginsHookScriptFiles(hook, opts);
}

/**
 * Gets hook scripts defined by the plugin.
 */
function getPluginScriptFiles (plugin, hook, platforms) {
    var scriptElements = plugin.pluginInfo.getHookScripts(hook, platforms);

    return scriptElements.map(function (scriptElement) {
        return {
            path: scriptElement.attrib.src,
            fullPath: path.join(plugin.dir, scriptElement.attrib.src),
            plugin: plugin
        };
    });
}

/**
 * Gets hook scripts defined by all plugins.
 */
function getAllPluginsHookScriptFiles (hook, opts) {
    var scripts = [];
    var currentPluginOptions;

    var plugins = (new PluginInfoProvider()).getAllWithinSearchPath(path.join(opts.projectRoot, 'plugins'));

    plugins.forEach(function (pluginInfo) {
        currentPluginOptions = {
            id: pluginInfo.id,
            pluginInfo: pluginInfo,
            dir: pluginInfo.dir
        };

        scripts = scripts.concat(getPluginScriptFiles(currentPluginOptions, hook, opts.cordova.platforms));
    });
    return scripts;
}
