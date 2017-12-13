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

var helpers = require('../spec/helpers');
var path = require('path');
var Q = require('q');
var shell = require('shelljs');
var events = require('cordova-common').events;
var cordova = require('../src/cordova/cordova');
var platforms = require('../src/platforms/platforms');
var plugman = require('../src/plugman/plugman');
var install = require('../src/plugman/install');
var plugin_util = require('../src/cordova/plugin/util');

var util = require('../src/cordova/util');

var tmpDir = helpers.tmpDir('plugin_test');
var project = path.join(tmpDir, 'project');
var fixturesDir = path.join(__dirname, '..', 'spec', 'cordova', 'fixtures');
var pluginsDir = path.join(fixturesDir, 'plugins');

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
function addPlugin (target, id, options) {
    // Check there are no plugins yet.
    return cordova.plugin('list').then(function () {
        expect(results).toMatch(/No plugins added/gi);
    }).then(function () {
        // Add a fake plugin from fixtures.
        return cordova.plugin('add', target, options);
    }).then(function () {
        expect(path.join(project, 'plugins', id, 'plugin.xml')).toExist();
    }).then(function () {
        return cordova.plugin('ls');
    }).then(function () {
        expect(results).toContain(id);
    });
}

// Runs: remove, list
function removePlugin (id) {
    return cordova.plugin('rm', id)
        .then(function () {
            // The whole dir should be gone.
            expect(path.join(project, 'plugins', id)).not.toExist();
        }).then(function () {
            return cordova.plugin('ls');
        }).then(function () {
            expect(results).toMatch(/No plugins added/gi);
        });
}

var errorHandler = {
    errorCallback: function (error) {
        // We want the error to be printed by jasmine
        expect(error).toBeUndefined();
    }
};

// We can't call add with a searchpath or else we will conflict with other tests
// that use a searchpath. See loadLocalPlugins() in plugman/fetch.js for details.
// The searchpath behavior gets tested in the plugman spec
function mockPluginFetch (id, dir) {
    spyOn(plugman, 'fetch').and.callFake(function (target, pluginPath, fetchOptions) {
        var dest = path.join(project, 'plugins', id);
        var src = path.join(dir, 'plugin.xml');

        shell.mkdir(dest);
        shell.cp(src, dest);
        return Q(dest);
    });
}

describe('plugin end-to-end', function () {
    events.on('results', function (res) { results = res; });

    beforeEach(function () {
        shell.rm('-rf', project);

        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(fixturesDir, 'base'), tmpDir);
        shell.mv(path.join(tmpDir, 'base'), project);
        // Copy some platform to avoid working on a project with no platforms.
        shell.cp('-R', path.join(__dirname, '..', 'spec', 'plugman', 'projects', helpers.testPlatform), path.join(project, 'platforms'));
        process.chdir(project);

        // Reset origCwd before each spec to respect chdirs
        util._resetOrigCwd();
        delete process.env.PWD;

        spyOn(platforms, 'getPlatformApi').and.callThrough();
        spyOn(install, 'runInstall').and.callThrough();
        spyOn(errorHandler, 'errorCallback').and.callThrough();
    });

    afterEach(function () {
        process.chdir(path.join(__dirname, '..')); // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
        expect(errorHandler.errorCallback).not.toHaveBeenCalled();
    });

    it('Test 001 : should successfully add and remove a plugin with no options', function (done) {
        addPlugin(path.join(pluginsDir, 'fake1'), pluginId, {'fetch': true}, done)
            .then(function () {
                expect(install.runInstall).toHaveBeenCalled();
                expect(platforms.getPlatformApi.calls.count()).toEqual(1);
                return removePlugin(pluginId);
            }).then(function () {
                expect(platforms.getPlatformApi.calls.count()).toEqual(2);
            }).fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 004 : should successfully add a plugin using relative path when running from subdir inside of project', function (done) {
        // Copy plugin to subdir inside of the project. This is required since path.relative
        // returns an absolute path when source and dest are on different drives
        var plugindir = path.join(project, 'custom-plugins/some-plugin-inside-subfolder');
        shell.mkdir('-p', plugindir);
        shell.cp('-r', path.join(pluginsDir, 'fake1/*'), plugindir);

        // Create a subdir, where we're going to run cordova from
        var subdir = path.join(project, 'bin');
        shell.mkdir('-p', subdir);
        shell.cd(subdir);

        // Add plugin using relative path
        addPlugin(path.relative(subdir, plugindir), pluginId, {'fetch': true}, done)
            .then(function () {
                return removePlugin(pluginId);
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 005 : should respect preference default values', function (done) {
        var plugin_util = require('../src/cordova/plugin/util');
        spyOn(plugin_util, 'mergeVariables').and.returnValue({ REQUIRED: 'NO', REQUIRED_ANDROID: 'NO' });
        addPlugin(path.join(pluginsDir, org_test_defaultvariables), org_test_defaultvariables, { cli_variables: { REQUIRED: 'NO', REQUIRED_ANDROID: 'NO' }, 'fetch': true }, done)
            .then(function () {
                var platformJsonPath = path.join(project, 'plugins', helpers.testPlatform + '.json');
                var installed_plugins = require(platformJsonPath).installed_plugins;
                var defaultPluginPreferences = installed_plugins[org_test_defaultvariables];
                expect(defaultPluginPreferences).toBeDefined();
                expect(defaultPluginPreferences.DEFAULT).toBe('yes');
                expect(defaultPluginPreferences.DEFAULT_ANDROID).toBe('yes');
                expect(defaultPluginPreferences.REQUIRED_ANDROID).toBe('NO');
                expect(defaultPluginPreferences.REQUIRED).toBe('NO');
                return removePlugin(org_test_defaultvariables);
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 006 : should successfully add a plugin when specifying CLI variables', function (done) {
        addPlugin(path.join(pluginsDir, org_test_defaultvariables), org_test_defaultvariables, {cli_variables: { REQUIRED: 'yes', REQUIRED_ANDROID: 'yes' }, 'fetch': true}, done)
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 007 : should not check npm info when using the searchpath flag', function (done) {
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));
        spyOn(plugin_util, 'info');
        return addPlugin(npmInfoTestPlugin, npmInfoTestPlugin, {searchpath: pluginsDir}, done)
            .then(function () {
                expect(plugin_util.info).not.toHaveBeenCalled();
                var fetchOptions = plugman.fetch.calls.mostRecent().args[2];
                expect(fetchOptions.searchpath[0]).toExist();
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 008 : should not check npm info when using the noregistry flag', function (done) {
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(plugin_util, 'info');
        addPlugin(npmInfoTestPlugin, npmInfoTestPlugin, {noregistry: true}, done)
            .then(function () {
                expect(plugin_util.info).not.toHaveBeenCalled();

                var fetchOptions = plugman.fetch.calls.mostRecent().args[2];
                expect(fetchOptions.noregistry).toBeTruthy();
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 009 : should not check npm info when fetching from a Git repository', function (done) {
        spyOn(plugin_util, 'info');
        addPlugin(testGitPluginRepository, testGitPluginId, {'fetch': true}, done)
            .then(function () {
                expect(plugin_util.info).not.toHaveBeenCalled();
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 010 : should select the plugin version based on npm info when fetching from npm', function (done) {
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(plugin_util, 'info').and.callThrough();
        addPlugin(npmInfoTestPlugin, npmInfoTestPlugin, {'fetch': true}, done)
            .then(function () {
                expect(plugin_util.info).toHaveBeenCalled();

                var fetchTarget = plugman.fetch.calls.mostRecent().args[0];
                expect(fetchTarget).toEqual(npmInfoTestPlugin + '@' + npmInfoTestPluginVersion);
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 011 : should handle scoped npm packages', function (done) {
        var scopedPackage = '@testscope/' + npmInfoTestPlugin;
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(plugin_util, 'info').and.returnValue(Q({}));
        addPlugin(scopedPackage, npmInfoTestPlugin, {}, done)
            .then(function () {
                // Check to make sure that we are at least trying to get the correct package.
                // This package is not published to npm, so we can't truly do end-to-end tests

                expect(plugin_util.info).toHaveBeenCalledWith([scopedPackage]);

                var fetchTarget = plugman.fetch.calls.mostRecent().args[0];
                expect(fetchTarget).toEqual(scopedPackage);
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);

    it('Test 012 : should handle scoped npm packages with given version tags', function (done) {
        var scopedPackage = '@testscope/' + npmInfoTestPlugin + '@latest';
        mockPluginFetch(npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(plugin_util, 'info');
        addPlugin(scopedPackage, npmInfoTestPlugin, {}, done)
            .then(function () {
                expect(plugin_util.info).not.toHaveBeenCalled();

                var fetchTarget = plugman.fetch.calls.mostRecent().args[0];
                expect(fetchTarget).toEqual(scopedPackage);
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 30000);
});
