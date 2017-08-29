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
var underscore = require('underscore');

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
    var pluginInfoProvider = options.pluginInfoProvider;
    var pluginInfo = pluginInfoProvider.get(plugin_dir);
    var filtered_variables = {};

    var prefs = pluginInfo.getPreferences(platform);
    var keys = underscore.keys(prefs);

    options.cli_variables = options.cli_variables || {};
    var missing_vars = underscore.difference(keys, Object.keys(options.cli_variables));

    underscore.each(missing_vars, function (_key) {
        var def = prefs[_key];
        if (def) {
            options.cli_variables[_key] = def;
        }
    });

    // test missing vars once again after having default
    missing_vars = underscore.difference(keys, Object.keys(options.cli_variables));

    if (missing_vars.length > 0) {
        throw new Error('Variable(s) missing: ' + missing_vars.join(', '));
    }

    filtered_variables = underscore.pick(options.cli_variables, keys);
    return filtered_variables;
}
