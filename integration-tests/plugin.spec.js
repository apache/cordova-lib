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

const fs = require('fs-extra');
const helpers = require('../spec/helpers');
const path = require('path');
const events = require('cordova-common').events;
const cordova = require('../src/cordova/cordova');
const platforms = require('../src/platforms/platforms');
const plugman = require('../src/plugman/plugman');
const install = require('../src/plugman/install');
const plugin_util = require('../src/cordova/plugin/util');
const HooksRunner = require('../src/hooks/HooksRunner');

const util = require('../src/cordova/util');

const tmpDir = helpers.tmpDir('plugin_test');
const preparedProject = path.join(tmpDir, 'prepared-project');
const fixturesDir = path.join(__dirname, '..', 'spec', 'cordova', 'fixtures');
const pluginsDir = path.join(fixturesDir, 'plugins');

const pluginId = 'org.apache.cordova.fakeplugin1';
const org_test_defaultvariables = 'org.test.defaultvariables';

// This plugin is published to npm and defines cordovaDependencies
// in its package.json. Based on the dependencies and the version of
// cordova-android installed in our test project, the CLI should
// select version 1.1.2 of the plugin. We don't actually fetch from
// npm, but we do check the npm info.
const npmInfoTestPlugin = 'cordova-lib-test-plugin';
const npmInfoTestPluginVersion = '1.1.2';

const scopedTestPlugin = '@cordova/plugin-test-dummy';

const testGitPluginRepository = 'https://github.com/apache/cordova-plugin-device.git';
const testGitPluginId = 'cordova-plugin-device';

let results;

// Runs: list, add, list
function addPlugin (project, target, id, options) {
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
function removePlugin (project, id) {
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

// We can't call add with a searchpath or else we will conflict with other tests
// that use a searchpath. See loadLocalPlugins() in plugman/fetch.js for details.
// The searchpath behavior gets tested in the plugman spec
function mockPluginFetch (project, id, dir) {
    spyOn(plugman, 'fetch').and.callFake(function (target, pluginPath, fetchOptions) {
        const dest = path.join(project, 'plugins', id);

        fs.copySync(path.join(dir, 'plugin.xml'), path.join(dest, 'plugin.xml'));
        return Promise.resolve(dest);
    });
}

describe('plugin end-to-end', function () {
    let project;

    events.on('results', function (res) { results = res; });

    beforeAll(() => {
        return helpers.getFixture('projectWithPlatform').copyTo(preparedProject);
    }, 20000);

    beforeEach(function () {
        project = path.join(tmpDir, `project-${Date.now()}`);
        // Reset our test project and change into it
        fs.copySync(preparedProject, project);
        process.chdir(project);

        // Reset origCwd before each spec to respect chdirs
        util._resetOrigCwd();
        delete process.env.PWD;

        spyOn(platforms, 'getPlatformApi').and.callThrough();
        spyOn(install, 'runInstall').and.callThrough();
    });

    afterEach(function () {
        process.chdir(path.join(__dirname, '..')); // Needed to rm the dir on Windows.
        fs.removeSync(project);
    });

    it('Test 001 : should successfully add and remove a plugin with no options', function () {
        return addPlugin(project, path.join(pluginsDir, 'fake1'), pluginId)
            .then(function () {
                expect(install.runInstall).toHaveBeenCalled();
                expect(platforms.getPlatformApi.calls.count()).toEqual(1);
                return removePlugin(project, pluginId);
            }).then(function () {
                expect(platforms.getPlatformApi.calls.count()).toEqual(2);
            });
    }, 30000);

    it('Test 004 : should successfully add a plugin using relative path when running from subdir inside of project', function () {
        // Copy plugin to subdir inside of the project. This is required since path.relative
        // returns an absolute path when source and dest are on different drives
        const plugindir = path.join(project, 'custom-plugins/some-plugin-inside-subfolder');
        fs.copySync(path.join(pluginsDir, 'fake1'), plugindir);

        // Create a subdir, where we're going to run cordova from
        const subdir = path.join(project, 'bin');
        fs.ensureDirSync(subdir);
        process.chdir(subdir);

        // Add plugin using relative path
        return addPlugin(project, path.relative(subdir, plugindir), pluginId)
            .then(function () {
                return removePlugin(project, pluginId);
            });
    }, 30000);

    it('Test 005 : should respect preference default values', function () {
        const plugin_util = require('../src/cordova/plugin/util');
        spyOn(plugin_util, 'mergeVariables').and.returnValue({ REQUIRED: 'NO', REQUIRED_ANDROID: 'NO' });
        return addPlugin(project, path.join(pluginsDir, org_test_defaultvariables), org_test_defaultvariables, { cli_variables: { REQUIRED: 'NO', REQUIRED_ANDROID: 'NO' } })
            .then(function () {
                const platformJsonPath = path.join(project, 'plugins', helpers.testPlatform + '.json');
                const installed_plugins = require(platformJsonPath).installed_plugins;
                const defaultPluginPreferences = installed_plugins[org_test_defaultvariables];
                expect(defaultPluginPreferences).toBeDefined();
                expect(defaultPluginPreferences.DEFAULT).toBe('yes');
                expect(defaultPluginPreferences.DEFAULT_ANDROID).toBe('yes');
                expect(defaultPluginPreferences.REQUIRED_ANDROID).toBe('NO');
                expect(defaultPluginPreferences.REQUIRED).toBe('NO');
                return removePlugin(project, org_test_defaultvariables);
            });
    }, 30000);

    it('Test 006 : should successfully add a plugin when specifying CLI variables', function () {
        return addPlugin(project, path.join(pluginsDir, org_test_defaultvariables), org_test_defaultvariables, { cli_variables: { REQUIRED: 'yes', REQUIRED_ANDROID: 'yes' } });
    }, 30000);

    it('Test 007 : should not check npm info when using the searchpath flag', function () {
        mockPluginFetch(project, npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));
        spyOn(plugin_util, 'info');
        return addPlugin(project, npmInfoTestPlugin, npmInfoTestPlugin, { searchpath: pluginsDir })
            .then(function () {
                expect(plugin_util.info).not.toHaveBeenCalled();
                const fetchOptions = plugman.fetch.calls.mostRecent().args[2];
                expect(fetchOptions.searchpath[0]).toExist();
            });
    }, 30000);

    it('Test 008 : should not check npm info when using the noregistry flag', function () {
        mockPluginFetch(project, npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(plugin_util, 'info');
        return addPlugin(project, npmInfoTestPlugin, npmInfoTestPlugin, { noregistry: true })
            .then(function () {
                expect(plugin_util.info).not.toHaveBeenCalled();

                const fetchOptions = plugman.fetch.calls.mostRecent().args[2];
                expect(fetchOptions.noregistry).toBeTruthy();
            });
    }, 30000);

    it('Test 009 : should not check npm info when fetching from a Git repository', function () {
        spyOn(plugin_util, 'info');
        return addPlugin(project, testGitPluginRepository, testGitPluginId)
            .then(function () {
                expect(plugin_util.info).not.toHaveBeenCalled();
            });
    }, 30000);

    it('Test 010 : should select the plugin version based on npm info when fetching from npm', function () {
        mockPluginFetch(project, npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));

        spyOn(plugin_util, 'info').and.callThrough();

        // Pretend to have cordova-android 5.2.2 installed to force the
        // expected version outcome for the plugin below
        const targetVersion = '5.2.2';
        const apiFile = path.join(project, 'node_modules/cordova-android/lib/Api.js');
        const apiString = fs.readFileSync(apiFile, 'utf8')
            .replace('const VERSION = require(\'../package\').version;', `const VERSION = '${targetVersion}';`);
        fs.writeFileSync(apiFile, apiString, 'utf8');

        return addPlugin(project, npmInfoTestPlugin, npmInfoTestPlugin)
            .then(function () {
                expect(plugin_util.info).toHaveBeenCalled();

                const fetchTarget = plugman.fetch.calls.mostRecent().args[0];
                expect(fetchTarget).toEqual(npmInfoTestPlugin + '@' + npmInfoTestPluginVersion);
            });
    }, 30000);

    it('Test 011 : should handle scoped npm packages', function () {
        mockPluginFetch(project, scopedTestPlugin, path.join(pluginsDir, scopedTestPlugin));

        spyOn(plugin_util, 'info').and.returnValue(Promise.resolve({}));
        return addPlugin(project, scopedTestPlugin, scopedTestPlugin, {})
            .then(function () {
                // Check to make sure that we are at least trying to get the correct package.
                // This package is not published to npm, so we can't truly do end-to-end tests

                expect(plugin_util.info).toHaveBeenCalledWith([scopedTestPlugin]);

                const fetchTarget = plugman.fetch.calls.mostRecent().args[0];
                expect(fetchTarget).toEqual(scopedTestPlugin);
            });
    }, 30000);

    it('Test 012 : should handle scoped npm packages with given version tags', function () {
        const scopedPackage = scopedTestPlugin + '@latest';
        mockPluginFetch(project, scopedTestPlugin, path.join(pluginsDir, scopedTestPlugin));

        spyOn(plugin_util, 'info');
        return addPlugin(project, scopedPackage, scopedTestPlugin, {})
            .then(function () {
                expect(plugin_util.info).not.toHaveBeenCalled();

                const fetchTarget = plugman.fetch.calls.mostRecent().args[0];
                expect(fetchTarget).toEqual(scopedPackage);
            });
    }, 30000);

    it('Test 013 : should be able to add and remove scoped npm packages without screwing up everything', () => {
        mockPluginFetch(project, scopedTestPlugin, path.join(pluginsDir, scopedTestPlugin));
        spyOn(plugin_util, 'info').and.returnValue(Promise.resolve({}));

        return addPlugin(project, scopedTestPlugin, scopedTestPlugin, {})
            .then(() => {
                expect(plugin_util.info).toHaveBeenCalledWith([scopedTestPlugin]);

                const fetchTarget = plugman.fetch.calls.mostRecent().args[0];
                expect(fetchTarget).toEqual(scopedTestPlugin);

                return removePlugin(project, scopedTestPlugin);
            });
    }, 30000);

    it('Test 014 : should run plugin (un)install hooks with correct opts', async () => {
        const testPluginInstalledPath = path.join(project, 'plugins', npmInfoTestPlugin);
        const expectedOpts = jasmine.objectContaining({
            cordova: {
                platforms: [helpers.testPlatform],
                plugins: [npmInfoTestPlugin],
                version: require('../package').version
            },
            plugin: {
                id: npmInfoTestPlugin,
                platform: helpers.testPlatform,
                dir: testPluginInstalledPath,
                pluginInfo: jasmine.objectContaining({
                    id: npmInfoTestPlugin,
                    dir: testPluginInstalledPath
                })
            },
            projectRoot: project
        });

        mockPluginFetch(project, npmInfoTestPlugin, path.join(pluginsDir, npmInfoTestPlugin));
        spyOn(HooksRunner.prototype, 'fire').and.callThrough();

        await cordova.plugin('add', npmInfoTestPlugin);
        await cordova.plugin('rm', npmInfoTestPlugin);

        HooksRunner.prototype.fire.calls.allArgs()
            .filter(([hook]) => /_plugin_(un)?install$/.test(hook))
            .forEach(([hook, opts]) => {
                expect(opts)
                    .withContext(`${hook} hook options`)
                    .toEqual(expectedOpts);
            });
    }, 20 * 1000);
});
