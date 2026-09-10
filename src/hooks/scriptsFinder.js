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

const fs = require('node:fs');
const path = require('node:path');
const cordovaUtil = require('../cordova/util');
const events = require('cordova-common').events;
const PluginInfoProvider = require('cordova-common').PluginInfoProvider;
const ConfigParser = require('cordova-common').ConfigParser;

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
    const scriptElements = plugin.pluginInfo.getHookScripts(hook, platforms);

    return scriptElements.map(function (scriptElement) {
        return {
            path: scriptElement.attrib.src,
            fullPath: path.join(plugin.dir, scriptElement.attrib.src),
            plugin
        };
    });
}

/**
 * Orders plugins by their position in package.json's `cordova.plugins`, so that their hooks run in
 * the order the plugins were installed in.
 *
 * `PluginInfoProvider.getAllWithinSearchPath` globs the plugins directory and does not sort, so
 * without this the order hooks run in is whatever the filesystem returned for that directory. That
 * silently decides which of two plugins writing the same file wins, and it can differ from one
 * machine to the next. Installation order already follows package.json (see
 * cordova/platform/addHelper.js), and this uses the same comparison so the two agree.
 *
 * Plugins missing from package.json keep sorting before the listed ones, exactly as they do during
 * installation, and `Array.prototype.sort` is stable, so plugins that compare equal stay in the
 * order the search path yielded.
 *
 * @param {PluginInfo[]} plugins   as returned by the plugin search path
 * @param {string} projectRoot     the project directory holding package.json
 * @returns {PluginInfo[]} the plugins, ordered
 */
function sortPluginsByPackageJson (plugins, projectRoot) {
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
        return plugins;
    }

    const pkgJson = cordovaUtil.requireNoCache(pkgJsonPath);
    if (!pkgJson || !pkgJson.cordova || !pkgJson.cordova.plugins) {
        return plugins;
    }

    const pkgPluginIDs = Object.keys(pkgJson.cordova.plugins);
    return plugins.slice().sort(function (a, b) {
        return pkgPluginIDs.indexOf(a.id) - pkgPluginIDs.indexOf(b.id);
    });
}

/**
 * Gets hook scripts defined by all plugins.
 */
function getAllPluginsHookScriptFiles (hook, opts) {
    let scripts = [];
    let currentPluginOptions;

    const plugins = sortPluginsByPackageJson(
        (new PluginInfoProvider()).getAllWithinSearchPath(path.join(opts.projectRoot, 'plugins')),
        opts.projectRoot
    );

    plugins.forEach(function (pluginInfo) {
        currentPluginOptions = {
            id: pluginInfo.id,
            pluginInfo,
            dir: pluginInfo.dir
        };

        scripts = scripts.concat(getPluginScriptFiles(currentPluginOptions, hook, opts.cordova.platforms));
    });
    return scripts;
}
