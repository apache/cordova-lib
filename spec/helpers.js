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
var fs = require('fs');
var os = require('os');
var ConfigParser = require('cordova-common').ConfigParser;

// Just use Android everywhere; we're mocking out any calls to the `android` binary.
module.exports.testPlatform = 'android';

function getConfigPath (dir) {
    // if path ends with 'config.xml', return it
    if (dir.indexOf('config.xml') === dir.length - 10) {
        return dir;
    }
    // otherwise, add 'config.xml' to the end of it
    return path.join(dir, 'config.xml');
}

module.exports.tmpDir = function (suffix) {
    suffix = suffix || 'test';
    const dir = path.join(os.tmpdir(), `cordova-lib-${suffix}-`);
    return fs.mkdtempSync(dir);
};

/**
 * Sets the default timeout for the current suite.
 *
 * Restores the previous timeout after the suite has finished. The timeout
 * applies to all `before*`, `after*` and `it` blocks within the suite.
 *
 * Must be called before defining any of the aforementioned blocks.
 *
 * @param {Number} timeout The desired default timeout in ms
 */
module.exports.setDefaultTimeout = timeout => {
    const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

    // Ensure new default timeout applies to beforeAll blocks
    beforeAll(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout;
    });

    // Refresh setting before every test, just to be safe
    beforeEach(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout;
    });

    // Revert to original setting after the last afterAll
    afterAll(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    });
};

module.exports.setEngineSpec = function (appPath, engine, spec) {
    appPath = getConfigPath(appPath);
    var parser = new ConfigParser(appPath);

    parser.removeEngine(engine);
    parser.addEngine(engine, spec);
    parser.write();
};

module.exports.getEngineSpec = function (appPath, engine) {
    appPath = getConfigPath(appPath);
    var parser = new ConfigParser(appPath);
    var engines = parser.getEngines();

    for (var i = 0; i < engines.length; i++) {
        if (engines[i].name === module.exports.testPlatform) {
            return engines[i].spec;
        }
    }
    return null;
};

module.exports.removeEngine = function (appPath, engine) {
    appPath = getConfigPath(appPath);
    var parser = new ConfigParser(appPath);

    parser.removeEngine(module.exports.testPlatform);
    parser.write();
};

module.exports.setPluginSpec = function (appPath, plugin, spec) {
    appPath = getConfigPath(appPath);
    var parser = new ConfigParser(appPath);
    var p = parser.getPlugin(plugin);
    var variables = [];

    if (p) {
        parser.removePlugin(p.name);
        if (p.variables.length && p.variables.length > 0) {
            variables = p.variables;
        }
    }

    parser.addPlugin({ 'name': plugin, 'spec': spec }, variables);
    parser.write();
};

module.exports.getPluginSpec = function (appPath, plugin) {
    appPath = getConfigPath(appPath);
    var parser = new ConfigParser(appPath);
    var p = parser.getPlugin(plugin);

    if (p) {
        return p.spec;
    }
    return null;
};

module.exports.getPluginVariable = function (appPath, plugin, variable) {
    appPath = getConfigPath(appPath);
    var parser = new ConfigParser(appPath);
    var p = parser.getPlugin(plugin);

    if (p && p.variables) {
        return p.variables[variable];
    }
    return null;
};

module.exports.removePlugin = function (appPath, plugin) {
    appPath = getConfigPath(appPath);
    var parser = new ConfigParser(appPath);

    parser.removePlugin(plugin);
    parser.write();
};

module.exports.getConfigContent = function (appPath) {
    var configFile = path.join(appPath, 'config.xml');
    return fs.readFileSync(configFile, 'utf-8');
};

module.exports.writeConfigContent = function (appPath, configContent) {
    var configFile = path.join(appPath, 'config.xml');
    fs.writeFileSync(configFile, configContent, 'utf-8');
};

const customMatchers = {
    toExist: () => ({ compare (file) {
        const pass = fs.existsSync(file);
        const expectation = (pass ? 'not ' : '') + 'to exist';
        return {
            pass, message: `expected ${file} ${expectation}`
        };
    }})
};

// Add our custom matchers
beforeEach(() => jasmine.addMatchers(customMatchers));
