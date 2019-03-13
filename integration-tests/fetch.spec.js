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
var fs = require('fs-extra');
var helpers = require('../spec/helpers');
var cordova = require('../src/cordova/cordova');

const TIMEOUT = 60 * 1000;
var plugins_dir = path.join(__dirname, '..', 'spec', 'plugman', 'plugins');

var plugins = {
    'Test1': path.join(plugins_dir, 'dependencies', 'Test1'),
    'Test2': path.join(plugins_dir, 'dependencies', 'Test2'),
    'Test3': path.join(plugins_dir, 'dependencies', 'Test3'),
    'Test4': path.join(plugins_dir, 'dependencies', 'Test4')
};

describe('end-to-end plugin dependency tests', function () {
    helpers.setDefaultTimeout(TIMEOUT);

    // This prepares a project that we will copy and use for all tests
    const preparedProject = helpers.tmpDir('plugin_dependency_test_project');
    beforeAll(function () {
        return cordova.create(preparedProject)
            .then(function () {
                process.chdir(preparedProject);
                return cordova.platform('add', 'android', { save: true });
            });
    });

    afterAll(function () {
        process.chdir(__dirname); // Needed to rm the dir on Windows.
        fs.removeSync(preparedProject);
    });

    var tmpDir, project, pluginsDir;
    beforeEach(function () {
        tmpDir = helpers.tmpDir('plugin_dependency_test');
        project = path.join(tmpDir, 'project');
        pluginsDir = path.join(project, 'plugins');

        fs.copySync(preparedProject, project);
        process.chdir(project);
        delete process.env.PWD;
    });

    afterEach(function () {
        process.chdir(__dirname); // Needed to rm the dir on Windows.
        fs.removeSync(tmpDir);
    });

    it('Test 029 : should fail if dependency already installed is wrong version', function () {
        return Promise.resolve()
            .then(function () {
                return cordova.plugin('add', 'cordova-plugin-file');
            }).then(function () {
                expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
                return cordova.plugin('add', plugins['Test1']);
            }).catch(function (err) {
                expect(err.message).toContain('does not satisfy dependency plugin requirement');
            });
    });

    it('Test 030 : should pass if dependency already installed is wrong version with --force', function () {
        return Promise.resolve()
            .then(function () {
                return cordova.plugin('add', 'cordova-plugin-file');
            })
            .then(function () {
                expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
                return cordova.plugin('add', plugins['Test1'], { 'force': true });
            })
            .then(function () {
                expect(path.join(pluginsDir, 'Test1')).toExist();
            });
    });

    it('Test 031 : should pass if dependency already installed is same major version (if specific version is specified)', function () {
        // Test1 requires cordova-plugin-file version 2.0.0 (which should automatically turn into ^2.0.0); we'll install version 2.1.0
        return Promise.resolve()
            .then(function () {
                return cordova.plugin('add', 'cordova-plugin-file@2.1.0');
            })
            .then(function () {
                expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
                return cordova.plugin('add', plugins['Test1']);
            })
            .then(function () {
                expect(path.join(pluginsDir, 'Test1')).toExist();
            });
    });

    it('Test 032 : should handle two plugins with same dependent plugin', function () {
        // Test1 and Test2 have compatible dependencies on cordova-plugin-file
        // Test1 and Test3 have incompatible dependencies on cordova-plugin-file
        return Promise.resolve()
            .then(function () {
                return cordova.plugin('add', plugins['Test1']);
            })
            .then(function () {
                expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
                expect(path.join(pluginsDir, 'Test1')).toExist();
                return cordova.plugin('add', plugins['Test2']);
            })
            .then(function () {
                return cordova.plugin('add', plugins['Test3']);
            })
            .catch(function (err) {
                expect(path.join(pluginsDir, 'Test2')).toExist();
                expect(path.join(pluginsDir, 'Test3')).not.toExist();
                expect(err.message).toContain('does not satisfy dependency plugin requirement');
            });
    });

    it('Test 033 : should use a dev version of a dependent plugin if it is already installed', function () {
        // Test4 has this dependency in its plugin.xml:
        // <dependency id="cordova-plugin-file" url="https://github.com/apache/cordova-plugin-file" />
        return Promise.resolve()
            .then(function () {
                return cordova.plugin('add', 'https://github.com/apache/cordova-plugin-file');
            })
            .then(function () {
                return cordova.plugin('add', plugins['Test4']);
            })
            .then(function () {
                expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
                expect(path.join(pluginsDir, 'Test4')).toExist();
            });
    });
});
