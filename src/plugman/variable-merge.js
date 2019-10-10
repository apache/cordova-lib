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

var PluginInfoProvider = require('cordova-common').PluginInfoProvider;

module.exports.mergeVariables = mergeVariables;

/*
 * At this point, cli and config vars have already merged.
 * Merges those vars (cli and config) with plugin.xml variables.
 *
 * @param   {string}    plugin directory
 * @param   {string}    platform
 * @param   {object}    options
 *
 * @return  {object}    list of filtered variables
 */
function mergeVariables (plugin_dir, platform, options) {
    options.pluginInfoProvider = options.pluginInfoProvider || new PluginInfoProvider();
    const pluginInfo = options.pluginInfoProvider.get(plugin_dir);
    const prefs = pluginInfo.getPreferences(platform);
    const keys = Object.keys(prefs);

    options.cli_variables = options.cli_variables || {};

    // For all vars defined in prefs, take the value from cli_variables or
    // default to the value from prefs if truthy.
    const mergedVars = {};
    for (const key of keys) {
        if (key in options.cli_variables) {
            mergedVars[key] = options.cli_variables[key];
        } else if (prefs[key]) {
            mergedVars[key] = options.cli_variables[key] = prefs[key];
        }
    }

    // Test for missing vars after having applied defaults
    const mergedVarKeys = new Set(Object.keys(mergedVars));
    const missing_vars = keys.filter(key => !mergedVarKeys.has(key));

    if (missing_vars.length > 0) {
        throw new Error('Variable(s) missing: ' + missing_vars.join(', '));
    }

    return mergedVars;
}
