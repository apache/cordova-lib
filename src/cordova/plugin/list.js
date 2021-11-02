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

const semver = require('semver');
const events = require('cordova-common').events;
const plugin_util = require('./util');
const cordova_util = require('../util');

module.exports = list;

function list (projectRoot, hooksRunner, opts) {
    const pluginsList = [];
    return hooksRunner.fire('before_plugin_ls', opts)
        .then(function () {
            return plugin_util.getInstalledPlugins(projectRoot);
        }).then(function (plugins) {
            if (plugins.length === 0) {
                events.emit('results', 'No plugins added. Use `' + cordova_util.binname + ' plugin add <plugin>`.');
                return;
            }
            const pluginsDict = {};
            const lines = [];
            let txt, p;
            for (let i = 0; i < plugins.length; i++) {
                p = plugins[i];
                pluginsDict[p.id] = p;
                pluginsList.push(p.id);
                txt = p.id + ' ' + p.version + ' "' + (p.name || p.description) + '"';
                lines.push(txt);
            }
            // Add warnings for deps with wrong versions.
            for (const id in pluginsDict) {
                p = pluginsDict[id];
                for (const depId in p.deps) {
                    const dep = pluginsDict[depId];
                    if (!dep) {
                        txt = 'WARNING, missing dependency: plugin ' + id +
                              ' depends on ' + depId +
                              ' but it is not installed';
                        lines.push(txt);
                    } else if (!semver.satisfies(dep.version, p.deps[depId].version)) {
                        txt = 'WARNING, broken dependency: plugin ' + id +
                              ' depends on ' + depId + ' ' + p.deps[depId].version +
                              ' but installed version is ' + dep.version;
                        lines.push(txt);
                    }
                }
            }
            events.emit('results', lines.join('\n'));
        })
        .then(function () {
            return hooksRunner.fire('after_plugin_ls', opts);
        })
        .then(function () {
            return pluginsList;
        });
}
