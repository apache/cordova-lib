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

var helpers = require('./helpers'),
    path = require('path'),
    shell = require('shelljs'),
    events = require('../src/events'),
    cordova = require('../src/cordova/cordova');

var tmpDir = helpers.tmpDir('plugin_test');
var project = path.join(tmpDir, 'project');
var pluginsDir = path.join(__dirname, 'fixtures', 'plugins');
var pluginId = 'org.apache.cordova.fakeplugin1';
var org_test_defaultvariables = 'org.test.defaultvariables';

describe('plugin end-to-end', function() {
    var results;

    beforeEach(function() {
        shell.rm('-rf', project);
    });
    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    // The flow tested is: ls, add, ls, rm, ls.
    // Plugin dependencies are not tested as that should be corvered in plugman tests.
    // TODO (kamrik): Test the 'plugin search' command.
    it('should successfully run', function(done) {
        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'base'), tmpDir);
        shell.mv(path.join(tmpDir, 'base'), project);
        // Copy some platform to avoid working on a project with no platforms.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'platforms', helpers.testPlatform), path.join(project, 'platforms'));
        process.chdir(project);

        events.on('results', function(res) { results = res; });

        // Check there are no plugins yet.
        cordova.raw.plugin('list').then(function() {
            expect(results).toMatch(/No plugins added/gi);
        }).then(function() {
            // Add a fake plugin from fixtures.
            return cordova.raw.plugin('add', path.join(pluginsDir, 'fake1'));
        }).then(function() {
           expect(path.join(project, 'plugins', pluginId, 'plugin.xml')).toExist();
        }).then(function() {
            return cordova.raw.plugin('ls');
        }).then(function() {
            expect(results).toContain(pluginId);
        }).then(function() {
            // And now remove it.
            return cordova.raw.plugin('rm', pluginId);
        }).then(function() {
            // The whole dir should be gone.
            expect(path.join(project, 'plugins', pluginId)).not.toExist();
        }).then(function() {
            return cordova.raw.plugin('ls');
        }).then(function() {
            expect(results).toMatch(/No plugins added/gi);
        }).then(function() {
            // Testing Default Variables plugin
            return cordova.raw.plugin('add', path.join(pluginsDir, org_test_defaultvariables),{cli_variables: { REQUIRED:'yes', REQUIRED_ANDROID:'yes'}});
         }).then(function() {
            return cordova.raw.plugin('ls');
        }).then(function() {
            expect(results).toContain(org_test_defaultvariables);
        }).fail(function(err) {
            console.log(err.stack);
            expect(err).toBeUndefined();
        }).fin(done);
    });
});
