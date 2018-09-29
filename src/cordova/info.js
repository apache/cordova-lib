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

var cordova_util = require('./util');
var superspawn = require('cordova-common').superspawn;
var pkg = require('../../package');
var path = require('path');
var fs = require('fs-extra');

const indent = s => require('indent-string')(s, 2);

/**
 * Outputs information about your system, your Cordova installation and
 * the Cordova project this is called in, if applicable.
 *
 * Useful when submitting bug reports and asking for help.
 *
 * @return {Promise} resolved when info has been dumped
 */
module.exports = function info () {
    const basicInfo = [
        // Get versions for cordova and all direct cordova dependencies
        cordovaVersionInfo(),
        // Get information on the current environment
        environmentInformation()
    ];

    const projectRoot = cordova_util.isCordova();
    const projectInfo = !projectRoot ? [] : [
        // Get list of plugins
        listPlugins(projectRoot),
        // Get Platforms information
        getPlatforms(projectRoot),
        // Display project config.xml file
        displayFileContents(cordova_util.projectConfig(projectRoot)),
        // Display project package.json file
        displayFileContents(path.join(projectRoot, 'package.json'))
    ];

    const infoPromises = [].concat(basicInfo, projectInfo);
    const failSafePromises = infoPromises.map(p => Promise.resolve(p).catch(err => err));
    return Promise.all(failSafePromises)
        .then(results => console.info(results.join('\n\n')));
};

function cordovaVersionInfo () {
    const versionFor = name => require(`${name}/package`).version;
    const deps = Object.keys(pkg.dependencies)
        .filter(name => name.startsWith('cordova-'))
        .map(name => `${name}@${versionFor(name)}`)
        .join('\n');
    return `cordova-lib@${pkg.version} with:\n${indent(deps)}`;
}

function environmentInformation () {
    return Promise.all([
        'OS: ' + process.platform,
        'Node: ' + process.version,
        failSafeSpawn('npm', ['-v']).then(out => 'npm: ' + out)
    ])
        .then(env => env.join('\n'))
        .then(env => 'Environment: \n' + indent(env));
}

function listPlugins (projectRoot) {
    var pluginPath = path.join(projectRoot, 'plugins');
    var plugins = cordova_util.findPlugins(pluginPath).join('\n');
    return 'Plugins:' + (plugins.length ? '\n' + indent(plugins) : ' []');
}

function getPlatforms (projectRoot) {
    var platforms = cordova_util.listPlatforms(projectRoot);
    if (!platforms.length) {
        return 'No Platforms Currently Installed';
    }
    return Promise.all(platforms.map(getPlatformInfo))
        .then(outs => outs.join('\n\n'));
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

function failSafeSpawn (command, args) {
    return superspawn.spawn(command, args)
        .catch(err => `ERROR: ${err.message}`);
}

function displayFileContents (filePath) {
    const fileName = path.basename(filePath);
    if (!fs.existsSync(filePath)) {
        return fileName + ' file not found';
    }
    const contents = fs.readFileSync(filePath, 'utf-8');
    return `${fileName} <<EOF\n${contents}\nEOF`;
}
