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

// This plugin is published to npm and defines cordovaDependencies
// in its package.json. Based on the dependencies and the version of
// cordova-android installed in our test project, the CLI should
// select version 1.1.2 of the plugin. We don't actually fetch from
// npm, but we do check the npm info.
var npmInfoTestPlugin = 'cordova-lib-test-plugin';
var npmInfoTestPluginVersion = '1.1.2';

var testGitPluginRepository = 'https://github.com/apache/cordova-plugin-device.git';
var testGitPluginId = 'cordova-plugin-device';

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
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(registry, 'info');
        addPlugin(npmInfoTestPlugin, npmInfoTestPlugin, {searchpath: pluginsDir}, done)
        .then(function() {
            expect(registry.info).not.toHaveBeenCalled();

            var fetchOptions = plugman.raw.fetch.mostRecentCall.args[2];
            expect(fetchOptions.searchpath).toBeDefined();
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });

    it('should not check npm info when using the noregistry flag', function(done) {
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(registry, 'info');
        addPlugin(npmInfoTestPlugin, npmInfoTestPlugin, {noregistry:true}, done)
        .then(function() {
            expect(registry.info).not.toHaveBeenCalled();

            var fetchOptions = plugman.raw.fetch.mostRecentCall.args[2];
            expect(fetchOptions.noregistry).toBeTruthy();
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });

    it('should not check npm info when fetching from a Git repository', function(done) {
        spyOn(registry, 'info');
        addPlugin(testGitPluginRepository, testGitPluginId, {}, done)
        .then(function() {
            expect(registry.info).not.toHaveBeenCalled();
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });

    it('should select the plugin version based on npm info when fetching from npm', function(done) {
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(registry, 'info').andCallThrough();
        addPlugin(npmInfoTestPlugin, npmInfoTestPlugin, {}, done)
        .then(function() {
            expect(registry.info).toHaveBeenCalled();

            var fetchTarget = plugman.raw.fetch.mostRecentCall.args[0];
            expect(fetchTarget).toEqual(npmInfoTestPlugin + '@' + npmInfoTestPluginVersion);
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });

    it('should handle scoped npm packages', function(done) {
        var scopedPackage = '@testscope/' + npmInfoTestPlugin;
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(registry, 'info').andReturn(Q({}));
        addPlugin(scopedPackage, npmInfoTestPlugin, {}, done)
        .then(function() {
            // Check to make sure that we are at least trying to get the correct package.
            // This package is not published to npm, so we can't truly do end-to-end tests

            expect(registry.info).toHaveBeenCalledWith([scopedPackage]);

            var fetchTarget = plugman.raw.fetch.mostRecentCall.args[0];
            expect(fetchTarget).toEqual(scopedPackage);
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });

    it('should handle scoped npm packages with given version tags', function(done) {
        var scopedPackage = '@testscope/' + npmInfoTestPlugin + '@latest';
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(registry, 'info');
        addPlugin(scopedPackage, npmInfoTestPlugin, {}, done)
        .then(function() {
            expect(registry.info).not.toHaveBeenCalled();

            var fetchTarget = plugman.raw.fetch.mostRecentCall.args[0];
            expect(fetchTarget).toEqual(scopedPackage);
        })
        .fail(errorHandler.errorCallback)
        .fin(done);
    });
});
