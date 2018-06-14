/**
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
'License'); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/

/*
A utility funciton to help output the information needed
when submitting a help request.
 */
var cordova_util = require('./util');
var superspawn = require('cordova-common').superspawn;
var pkg = require('../../package');
var path = require('path');
var fs = require('fs');
var Q = require('q');

const indent = s => require('indent-string')(s, 2);

function failSafeSpawn (command, args) {
    return superspawn.spawn(command, args)
        .catch(err => `ERROR: ${err.message}`);
}

function getPlatformInfo (platform) {
    switch (platform) {
    case 'ios':
        return failSafeSpawn('xcodebuild', ['-version'])
            .then(out => 'iOS platform:\n' + indent(out));
    case 'android':
        return failSafeSpawn('android', ['list', 'target'])
            .then(out => 'Android platform:\n' + indent(out));
    }
}

module.exports = function info () {
    // Get projectRoot
    var projectRoot = cordova_util.cdProjectRoot();
    if (!projectRoot) {
        return Q.reject(new Error('Current working directory is not a Cordova-based project.'));
    }

    const infoPromises = [
        // Get Node version
        Q('Node version: ' + process.version),
        // Get Cordova version
        Q('Cordova version: ' + pkg.version),
        // Get list of plugins
        listPlugins(projectRoot),
        // Get Platforms information
        getPlatforms(projectRoot),
        // Get project config.xml file using ano
        getProjectConfig(projectRoot)
    ];

    const failSafePromises = infoPromises.map(p => Q(p).catch(err => err));
    return Q.all(failSafePromises)
        .then(results => console.info(results.join('\n\n')));
};

function getPlatforms (projectRoot) {
    var platforms = cordova_util.listPlatforms(projectRoot);
    if (!platforms.length) {
        return 'No Platforms Currently Installed';
    }
    return Q.all(platforms.map(getPlatformInfo))
        .then(outs => outs.join('\n\n'));
}

function listPlugins (projectRoot) {
    var pluginPath = path.join(projectRoot, 'plugins');
    var plugins = cordova_util.findPlugins(pluginPath).join('\n');
    return 'Plugins:' + (plugins.length ? '\n' + indent(plugins) : ' []');
}

function getProjectConfig (projectRoot) {
    const configPath = cordova_util.projectConfig(projectRoot);
    if (!fs.existsSync(configPath)) {
        return 'config.xml file not found';
    }
    const config = fs.readFileSync(configPath, 'utf-8');
    return `config.xml <<EOF\n${config}\nEOF`;
}
