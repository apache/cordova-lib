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

const path = require('path');
const fs = require('fs-extra');
const { tmpDir: getTmpDir, testPlatform } = require('../helpers');
const projectTestHelpers = require('../project-test-helpers');

/**
 * Checks if "cordova/restore-util" is restoring platforms and plugins as
 * expected given different configurations of package.json and/or config.xml.
*/
describe('cordova/restore-util', () => {
    var tmpDir, project, pkgJsonPath, configXmlPath;
    var restore, cordovaPlatform, cordovaPlugin;
    const {
        getPkgJsonPath, getConfigXmlPath, setupBaseProject, getCfg, getPkgJson, setPkgJson
    } = projectTestHelpers(() => project);

    beforeEach(() => {
        tmpDir = getTmpDir('pkgJson');
        project = path.join(tmpDir, 'project');
        pkgJsonPath = getPkgJsonPath();
        configXmlPath = getConfigXmlPath();
        delete process.env.PWD;

        restore = require('../../src/cordova/restore-util');

        cordovaPlugin = require('../../src/cordova/plugin');
        spyOn(cordovaPlugin, 'add')
            .and.returnValue(Promise.resolve());

        cordovaPlatform = require('../../src/cordova/platform');
        spyOn(cordovaPlatform, 'add')
            .and.returnValue(Promise.resolve());

        setupBaseProject();
    });

    afterEach(() => {
        process.chdir(__dirname); // Needed to rm the dir on Windows.
        fs.removeSync(tmpDir);
    });

    function getCfgEngineNames (cfg = getCfg()) {
        return cfg.getEngines().map(({ name }) => name);
    }

    function platformPkgName (platformName) {
        return platformName.replace(/^(?:cordova-)?/, 'cordova-');
    }

    function expectPluginsInPkgJson (plugins) {
        const pkgJson = getPkgJson();
        expect(pkgJson).toBeDefined();

        // Check that cordova.plugins key in package.json contains the expected
        // variables and ONLY them
        const variables = plugins.reduce((o, { name, variables }) => {
            o[name] = variables;
            return o;
        }, {});
        expect(pkgJson.cordova).toBeDefined();
        expect(pkgJson.cordova.plugins).toEqual(variables);

        // Check that dependencies key in package.json contains the expected specs
        // We only check the specs for plugins where an expected spec was given
        const expectedSpecs = plugins.reduce((o, { name, spec }) => {
            if (spec) o[name] = spec;
            return o;
        }, {});
        if (Object.keys(expectedSpecs).length > 0) {
            const specs = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies);
            expect(specs).toEqual(jasmine.objectContaining(expectedSpecs));
        }
    }

    function expectPlatformAdded (platform) {
        const expectedOpts = {
            platforms: jasmine.arrayContaining([
                jasmine.stringMatching(platform)
            ])
        };

        expect(cordovaPlatform.add).toHaveBeenCalledWith(
            jasmine.anything(), jasmine.any(String),
            jasmine.arrayContaining([platform]),
            jasmine.objectContaining(expectedOpts)
        );
    }

    function expectPluginAdded (plugin) {
        const expectedOpts = {
            plugins: jasmine.arrayContaining([
                jasmine.stringMatching(plugin.name)
            ])
        };
        if ('variables' in plugin) {
            expectedOpts.cli_variables = plugin.variables;
        }
        expect(cordovaPlugin.add).toHaveBeenCalledWith(
            jasmine.any(String), jasmine.anything(),
            jasmine.objectContaining(expectedOpts)
        );
    }

    function expectPluginsAddedAndSavedToPkgJson (plugins) {
        expectPluginsInPkgJson(plugins);
        plugins.forEach(expectPluginAdded);
    }

    describe('installPlatformsFromConfigXML', () => {
        it('Test#001 : should restore saved platform from package.json', () => {
            setPkgJson('cordova.platforms', [testPlatform]);

            return restore.installPlatformsFromConfigXML().then(() => {
                // Check that the platform was properly restored
                expectPlatformAdded(testPlatform);
            });
        });

        it('Test#017 : should restore saved platform from package.json using an URL spec', () => {
            const PLATFORM = 'browser';
            const PLATFORM_URL = 'https://github.com/apache/cordova-browser';

            setPkgJson('dependencies', {
                [platformPkgName(PLATFORM)]: `git+${PLATFORM_URL}.git`
            });
            setPkgJson('cordova.platforms', [PLATFORM]);

            return restore.installPlatformsFromConfigXML().then(() => {
                // Check config.xml for spec modification.
                expect(getCfg().getEngines()).not.toEqual([{
                    name: PLATFORM,
                    spec: `git+${PLATFORM_URL}.git`
                }]);
                // No change to pkg.json.
                const pkgJson = getPkgJson();
                expect(pkgJson.cordova.platforms).toEqual([PLATFORM]);

                const specs = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies);
                expect(specs[platformPkgName(PLATFORM)]).toEqual(`git+${PLATFORM_URL}.git`);
            });
        });

        it('Test#004 : should not modify either file if both have the same platforms', () => {
            getCfg()
                .addEngine(testPlatform)
                .write();
            setPkgJson('cordova.platforms', [testPlatform]);

            const getModTimes = _ => ({
                cfg: fs.statSync(configXmlPath).mtime,
                pkg: fs.statSync(pkgJsonPath).mtime
            });
            const modTimes = getModTimes();

            return restore.installPlatformsFromConfigXML().then(() => {
                expect(getModTimes()).toEqual(modTimes);
            });
        });

        it('Test#005 : should update package.json to include platforms from config.xml', () => {
            const PLATFORM_1 = 'android';
            const PLATFORM_2 = 'browser';

            getCfg()
                .addEngine(PLATFORM_1, '7.0.0')
                .addEngine(PLATFORM_2, '^5.0.3')
                .write();
            setPkgJson('cordova.platforms', [testPlatform]);

            return restore.installPlatformsFromConfigXML().then(() => {
                const pkgJson = getPkgJson();
                // Expect both pkg.json and config.xml to each have both platforms in their arrays.
                expect(getCfgEngineNames()).toEqual([PLATFORM_1, PLATFORM_2]);
                expect(pkgJson.cordova.platforms).toEqual([PLATFORM_1, PLATFORM_2]);

                // Platform specs from config.xml have been added to pkg.json.
                const specs = Object.assign({}, pkgJson.dependencies, pkgJson.devDependencies);
                expect(specs).toEqual({
                    [platformPkgName(PLATFORM_1)]: '7.0.0',
                    [platformPkgName(PLATFORM_2)]: '^5.0.3'
                });
            });
        });

        it('Test#006 : should update a package.json without `cordova` key to match platforms from config.xml', () => {
            getCfg()
                .addEngine('android')
                .write();

            return restore.installPlatformsFromConfigXML().then(() => {
                // Expect no change to config.xml.
                expect(getCfgEngineNames()).toEqual(['android']);
                // Expect cordova key and 'android' platform to be added to pkg.json.
                expect(getPkgJson('cordova.platforms')).toEqual(['android']);
            });
        });

        it('Test#007 : should find platform spec', () => {
            setPkgJson('cordova.platforms', ['android']);
            setPkgJson('devDependencies', {
                'cordova-android': '1.0.0'
            });

            return restore.installPlatformsFromConfigXML(['android'], {}).then(() => {
                expect(cordovaPlatform.add).toHaveBeenCalledWith(
                    jasmine.anything(),
                    jasmine.anything(),
                    ['android@1.0.0'],
                    jasmine.anything()
                );
            });
        });

        it('Test#016 : should restore platforms & plugins and create a missing package.json', () => {
            getCfg()
                .addEngine(testPlatform)
                .write();
            fs.removeSync(pkgJsonPath);

            return restore.installPlatformsFromConfigXML().then(() => {
                // Package.json should be auto-created using values from config.xml
                const cfg = getCfg();
                expect(getPkgJson()).toEqual(jasmine.objectContaining({
                    name: cfg.packageName().toLowerCase(),
                    version: cfg.version(),
                    displayName: cfg.name()
                }));
            });
        });
    });

    // These tests will check the plugin/variable list in package.json and config.xml.
    describe('installPluginsFromConfigXML', () => {
        beforeEach(() => {
            // Add some platform to test the plugins with
            setPkgJson('cordova.platforms', [testPlatform]);
        });

        it('Test#011 : restores saved plugin', () => {
            setPkgJson('dependencies', {
                'cordova-plugin-camera': '^2.3.0'
            });
            setPkgJson('cordova.plugins', {
                'cordova-plugin-camera': { variable_1: 'value_1' }
            });

            return restore.installPluginsFromConfigXML({ save: true }).then(() => {
                expectPluginAdded({
                    name: 'cordova-plugin-camera',
                    spec: '^2.3.0',
                    variables: { variable_1: 'value_1' }
                });
            });
        });

        it('Test#012 : restores saved plugin using an URL spec', () => {
            const PLUGIN_ID = 'cordova-plugin-splashscreen';
            const PLUGIN_URL = 'https://github.com/apache/cordova-plugin-splashscreen';

            setPkgJson('dependencies', {
                [PLUGIN_ID]: `git+${PLUGIN_URL}.git`
            });
            setPkgJson('cordova.plugins', { [PLUGIN_ID]: {} });

            return restore.installPluginsFromConfigXML({ save: true }).then(() => {
                expectPluginAdded({
                    name: PLUGIN_ID,
                    spec: `git+${PLUGIN_URL}.git`,
                    variables: {}
                });
            });
        });

        it('Test#013 : does NOT detect plugins from dependencies ', () => {
            setPkgJson('dependencies', { 'cordova-plugin-device': '~1.0.0' });
            setPkgJson('devDependencies', { 'cordova-plugin-camera': '~1.0.0' });

            return restore.installPluginsFromConfigXML({ save: true }).then(() => {
                expect(cordovaPlugin.add).not.toHaveBeenCalled();
            });
        });

        it('Test#014 : adds any plugins only present in config.xml to pkg.json', () => {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-device',
                    spec: '~1.0.0',
                    variables: {}
                })
                .write();

            setPkgJson('cordova.plugins', { 'cordova-plugin-camera': {} });
            setPkgJson('devDependencies', { 'cordova-plugin-camera': '^2.3.0' });

            return restore.installPluginsFromConfigXML({ save: true }).then(() => {
                expectPluginsAddedAndSavedToPkgJson([{
                    name: 'cordova-plugin-camera',
                    spec: '^2.3.0',
                    variables: {}
                }, {
                    name: 'cordova-plugin-device',
                    spec: '~1.0.0',
                    variables: {}
                }]);
            });
        });

        it('Test#015 : prefers pkg.json plugins over those from config.xml', () => {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-camera',
                    spec: '~2.2.0',
                    variables: { common_var: 'xml', xml_var: 'foo' }
                })
                .write();

            setPkgJson('cordova.plugins', {
                'cordova-plugin-camera': { common_var: 'json', json_var: 'foo' }
            });
            setPkgJson('devDependencies', { 'cordova-plugin-camera': '^2.3.0' });

            return restore.installPluginsFromConfigXML({ save: true }).then(() => {
                expectPluginsAddedAndSavedToPkgJson([{
                    name: 'cordova-plugin-camera',
                    spec: '^2.3.0',
                    variables: { common_var: 'json', json_var: 'foo' }
                }]);
            });
        });

        it('Test#018 : does NOT produce conflicting dependencies', () => {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-camera',
                    spec: '~2.2.0',
                    variables: { common_var: 'xml', xml_var: 'foo' }
                })
                .write();

            setPkgJson('dependencies', { 'cordova-plugin-camera': '^2.3.0' });

            return restore.installPluginsFromConfigXML({ save: true }).then(() => {
                expectPluginsAddedAndSavedToPkgJson([{
                    name: 'cordova-plugin-camera',
                    spec: '^2.3.0',
                    variables: { common_var: 'xml', xml_var: 'foo' }
                }]);

                const pluginOccurences = !!getPkgJson('dependencies.cordova-plugin-camera') +
                                       !!getPkgJson('devDependencies.cordova-plugin-camera');
                expect(pluginOccurences).toBe(1);
            });
        });
    });
});
