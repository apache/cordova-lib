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
    Q = require('q'),
    shell = require('shelljs'),
    events = require('cordova-common').events,
    cordova = require('../src/cordova/cordova'),
    plugman = require('../src/plugman/plugman'),
    registry = require('../src/plugman/registry/registry');

var tmpDir = helpers.tmpDir('plugin_test');
var project = path.join(tmpDir, 'project');
var pluginsDir = path.join(__dirname, 'fixtures', 'plugins');
var pluginId = 'org.apache.cordova.fakeplugin1';
var org_test_defaultvariables = 'org.test.defaultvariables';

var results;


// Runs: list, add, list
function addPlugin(target, id, options) {
    // Check there are no plugins yet.
    return cordova.raw.plugin('list').then(function() {
        expect(results).toMatch(/No plugins added/gi);
    }).then(function() {
        // Add a fake plugin from fixtures.
        return cordova.raw.plugin('add', target, options);
    }).then(function() {
        expect(path.join(project, 'plugins', id, 'plugin.xml')).toExist();
    }).then(function() {
        return cordova.raw.plugin('ls');
    }).then(function() {
        expect(results).toContain(id);
    });
}

// Runs: remove, list
function removePlugin(id) {
    return cordova.raw.plugin('rm', id)
    .then(function() {
        // The whole dir should be gone.
        expect(path.join(project, 'plugins', id)).not.toExist();
    }).then(function() {
        return cordova.raw.plugin('ls');
    }).then(function() {
        expect(results).toMatch(/No plugins added/gi);
    });
}

var errorHandler = {
    errorCallback: function(error) {
        // We want the error to be printed by jasmine
        expect(error).toBeUndefined();
    }
};

// We can't call add with a searchpath or else we will conflict with other tests
// that use a searchpath. See loadLocalPlugins() in plugman/fetch.js for details.
// The searchpath behavior gets tested in the plugman spec
function mockPluginFetch(id, dir) {
    spyOn(plugman.raw, 'fetch').andCallFake(function(target, pluginPath, fetchOptions) {
        var dest = path.join(project, 'plugins', id);
        var src = path.join(dir, 'plugin.xml');

        shell.mkdir(dest);
        shell.cp(src, dest);
        return Q(dest);
    });
}

describe('plugin end-to-end', function() {
    events.on('results', function(res) { results = res; });

    beforeEach(function() {
        shell.rm('-rf', project);

        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'base'), tmpDir);
        shell.mv(path.join(tmpDir, 'base'), project);
        // Copy some platform to avoid working on a project with no platforms.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'platforms', helpers.testPlatform), path.join(project, 'platforms'));
        process.chdir(project);

        spyOn(errorHandler, 'errorCallback').andCallThrough();
    });

    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
        expect(errorHandler.errorCallback).not.toHaveBeenCalled();
    });

    it('should successfully add and remove a plugin with no options', function(done) {
        addPlugin(path.join(pluginsDir, 'fake1'), pluginId, {}, done)
        .then(function() {
            return removePlugin(pluginId);
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });

    it('should successfully add a plugin when specifying CLI variables', function(done) {
        addPlugin(path.join(pluginsDir, org_test_defaultvariables), org_test_defaultvariables, {cli_variables: { REQUIRED:'yes', REQUIRED_ANDROID:'yes'}}, done)
        .fail(errorHandler.errorCallback)
        .fin(done);
    });

    it('should not check npm info when using the searchpath flag', function(done) {
        mockPluginFetch(pluginId, path.join(pluginsDir, 'fake1'));

        spyOn(registry, 'info');
        addPlugin(pluginId, pluginId, {searchpath: pluginsDir}, done)
        .then(function() {
            expect(registry.info).not.toHaveBeenCalled();

            var fetchOptions = plugman.raw.fetch.mostRecentCall.args[2];
            expect(fetchOptions.searchpath).toBeDefined();
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });

    it('should not check npm info when using the noregistry flag', function(done) {
        mockPluginFetch(pluginId, path.join(pluginsDir, 'fake1'));

        spyOn(registry, 'info');
        addPlugin(pluginId, pluginId, {noregistry:true}, done)
        .then(function() {
            expect(registry.info).not.toHaveBeenCalled();

            var fetchOptions = plugman.raw.fetch.mostRecentCall.args[2];
            expect(fetchOptions.noregistry).toBeTruthy();
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });
});
