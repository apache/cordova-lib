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
const rewire = require('rewire');
const { ConfigParser } = require('cordova-common');
const { tmpDir: getTmpDir, testPlatform } = require('../helpers');

/**
 * Checks if "cordova/restore-util" is restoring platforms and plugins as
 * expected given different configurations of package.json and/or config.xml.
*/
describe('cordova/restore-util', () => {
    const fixturesPath = path.join(__dirname, './fixtures');
    var tmpDir, project, pkgJsonPath, configXmlPath;
    var restore, cordovaPlatform, cordovaPlugin;

    beforeEach(() => {
        tmpDir = getTmpDir('pkgJson');
        project = path.join(tmpDir, 'project');
        pkgJsonPath = path.join(project, 'package.json');
        configXmlPath = path.join(project, 'config.xml');
        delete process.env.PWD;

        cordovaPlugin = require('../../src/cordova/plugin');
        spyOn(cordovaPlugin, 'add')
            .and.returnValue(Promise.resolve());

        cordovaPlatform = jasmine.createSpy('cordovaPlatform')
            .and.returnValue(Promise.resolve());
        restore = rewire('../../src/cordova/restore-util');
        restore.__set__({ cordovaPlatform });

        setupBaseProject();
    });

    afterEach(() => {
        process.chdir(__dirname); // Needed to rm the dir on Windows.
        fs.removeSync(tmpDir);
    });

    function setupBaseProject () {
        fs.copySync(path.join(fixturesPath, 'basePkgJson'), project);
        process.chdir(project);

        // It's quite bland, I assure you
        expect(getCfg().getPlugins()).toEqual([]);
        expect(getCfg().getEngines()).toEqual([]);
        expect(getPkgJson('cordova')).toBeUndefined();
        expect(getPkgJson('dependencies')).toBeUndefined();
    }

    // TODO remove this once apache/cordova-common#38
    // and apache/cordova-common#39 are resolved
    class TestConfigParser extends ConfigParser {
        addPlugin (plugin) {
            return (super.addPlugin(plugin, plugin.variables), this);
        }
        addEngine (...args) {
            return (super.addEngine(...args), this);
        }
    }
    function getCfg () {
        expect(configXmlPath).toExist();
        return new TestConfigParser(configXmlPath);
    }

    function getCfgEngineNames (cfg = getCfg()) {
        return cfg.getEngines().map(({ name }) => name);
    }

    function getPkgJson (propPath) {
        expect(pkgJsonPath).toExist();
        const keys = propPath ? propPath.split('.') : [];
        return keys.reduce((obj, key) => {
            expect(obj).toBeDefined();
            return obj[key];
        }, fs.readJsonSync(pkgJsonPath));
    }

    function setPkgJson (propPath, value) {
        expect(pkgJsonPath).toExist();
        const keys = propPath.split('.');
        const target = keys.pop();
        const pkgJsonObj = fs.readJsonSync(pkgJsonPath);
        const parentObj = keys.reduce((obj, key) => {
            return obj[key] || (obj[key] = {});
        }, pkgJsonObj);
        parentObj[target] = value;
        fs.writeJsonSync(pkgJsonPath, pkgJsonObj);
    }

    function platformPkgName (platformName) {
        return platformName.replace(/^(?:cordova-)?/, 'cordova-');
    }

    function expectPluginsInPkgJson (plugins) {
        const pkgJson = getPkgJson();
        expect(pkgJson).toBeDefined();

        // Check that cordova.plugins key in package.json contains the expected
        // variables and ONLY them
        const variables = plugins.reduce((o, {name, variables}) => {
            o[name] = variables;
            return o;
        }, {});
        expect(pkgJson.cordova).toBeDefined();
        expect(pkgJson.cordova.plugins).toEqual(variables);

        // Check that dependencies key in package.json contains the expected specs
        // We only check the specs for plugins where an expected spec was given
        const specs = plugins.reduce((o, {name, spec}) => {
            if (spec) o[name] = spec;
            return o;
        }, {});
        if (Object.keys(specs).length > 0) {
            expect(pkgJson.dependencies).toEqual(jasmine.objectContaining(specs));
        }
    }

    function expectPlatformAdded (platform) {
        expect(cordovaPlatform).toHaveBeenCalledWith('add', platform, undefined);
    }

    function expectPluginAdded (plugin) {
        expect(cordovaPlugin.add).toHaveBeenCalledWith(
            jasmine.any(String), jasmine.anything(),
            jasmine.objectContaining({
                plugins: jasmine.arrayContaining([
                    jasmine.stringMatching(plugin)
                ])
            })
        );
    }

    function expectConsistentPlugins (plugins) {
        expect(getCfg().getPlugins()).toEqual(jasmine.arrayWithExactContents(plugins));

        const unwrappedPlugins = plugins.map(p => p.sample || p);
        expectPluginsInPkgJson(unwrappedPlugins);

        const pluginNames = unwrappedPlugins.map(({ name }) => name);
        pluginNames.forEach(expectPluginAdded);
    }

    describe('installPlatformsFromConfigXML', () => {

        it('Test#000 : should change specs in config.xml from using ~ to using ^', () => {
            const PLATFORM = 'android';

            getCfg()
                .addEngine(PLATFORM, '~7.1.1')
                .write();

            setPkgJson('dependencies', {
                [platformPkgName(PLATFORM)]: '^7.1.1'
            });

            return restore.installPlatformsFromConfigXML().then(() => {
                // No changes to pkg.json spec for android.
                const pkgJson = getPkgJson();
                expect(pkgJson.cordova.platforms).toEqual([PLATFORM]);
                expect(pkgJson.dependencies[platformPkgName(PLATFORM)]).toMatch(/^\^/);

                // config.xml spec should change from '~' to '^'.
                expect(getCfg().getEngines()).toEqual([jasmine.objectContaining({
                    name: PLATFORM,
                    spec: jasmine.stringMatching(/^\^/)
                })]);
            });
        });

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
                expect(getCfg().getEngines()).toEqual([jasmine.objectContaining({
                    name: PLATFORM,
                    spec: `git+${PLATFORM_URL}.git`
                })]);
                // No change to pkg.json.
                const pkgJson = getPkgJson();
                expect(pkgJson.cordova.platforms).toEqual([PLATFORM]);
                expect(pkgJson.dependencies[platformPkgName(PLATFORM)]).toEqual(`git+${PLATFORM_URL}.git`);
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
                expect(pkgJson.dependencies).toEqual(jasmine.objectContaining({
                    [platformPkgName(PLATFORM_1)]: '7.0.0',
                    [platformPkgName(PLATFORM_2)]: '^5.0.3'
                }));
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

        it('Test#007 : should update config.xml to include platforms from package.json', () => {
            getCfg()
                .addEngine('ios', '6.0.0')
                .write();
            setPkgJson('dependencies', {
                'cordova-ios': '^4.5.4', 'cordova-browser': '^5.0.3'
            });
            setPkgJson('cordova.platforms', ['ios', 'browser']);

            return restore.installPlatformsFromConfigXML().then(() => {
                // Check to make sure that 'browser' spec was added properly.
                expect(getCfg().getEngines()).toEqual([
                    { name: 'ios', spec: '^4.5.4' },
                    { name: 'browser', spec: '^5.0.3' }
                ]);
                // No change to pkg.json dependencies.
                expect(getPkgJson('dependencies')).toEqual({
                    'cordova-ios': '^4.5.4', 'cordova-browser': '^5.0.3'
                });
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
            getCfg()
                .addEngine(testPlatform)
                .write();
            setPkgJson('cordova.platforms', [testPlatform]);
        });

        /**
        *   When pkg.json and config.xml define different values for a plugin variable,
        *   pkg.json should win and that value will be used to replace config's value.
        */
        it('Test#011 : updates config.xml to use the variable found in pkg.json', () => {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-camera',
                    variables: { variable_1: 'config' }
                })
                .write();
            setPkgJson('cordova.plugins', {
                'cordova-plugin-camera': { variable_1: 'json' }
            });

            return restore.installPluginsFromConfigXML({save: true}).then(() => {
                expectConsistentPlugins([
                    jasmine.objectContaining({
                        name: 'cordova-plugin-camera',
                        variables: { variable_1: 'json' }
                    })
                ]);
            });
        });

        /**
        *   When config.xml and pkg.json share a common plugin but pkg.json defines no variables for it,
        *   prepare will update pkg.json to match config.xml's plugins/variables.
        */
        it('Test#012 : update pkg.json to include plugin and variable found in config.xml', () => {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-camera',
                    variables: { variable_1: 'value_1' }
                })
                .write();
            setPkgJson('cordova.plugins', {
                'cordova-plugin-camera': {}
            });

            return restore.installPluginsFromConfigXML({save: true}).then(() => {
                expectConsistentPlugins([
                    jasmine.objectContaining({
                        name: 'cordova-plugin-camera',
                        variables: { variable_1: 'value_1' }
                    })
                ]);
            });
        });

        /**
        *   For plugins that are the same, it will merge their variables together for the final list.
        *   Plugins that are unique to that file, will be copied over to the file that is missing it.
        *   Config.xml and pkg.json will have identical plugins and variables after cordova prepare.
        */
        it('Test#013 : update pkg.json AND config.xml to include all plugins and merge unique variables', () => {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-camera',
                    variables: { variable_3: 'value_3' }
                })
                .addPlugin({
                    name: 'cordova-plugin-splashscreen',
                    variables: {}
                })
                .write();
            setPkgJson('cordova.plugins', {
                'cordova-plugin-splashscreen': {},
                'cordova-plugin-camera': { variable_1: ' ', variable_2: ' ' },
                'cordova-plugin-device': { variable_1: 'value_1' }
            });

            return restore.installPluginsFromConfigXML({save: true}).then(() => {
                expectConsistentPlugins([
                    jasmine.objectContaining({
                        name: 'cordova-plugin-camera',
                        variables: { variable_1: ' ', variable_2: ' ', variable_3: 'value_3' }
                    }),
                    jasmine.objectContaining({
                        name: 'cordova-plugin-splashscreen',
                        variables: {}
                    }),
                    jasmine.objectContaining({
                        name: 'cordova-plugin-device',
                        variables: { variable_1: 'value_1' }
                    })
                ]);
            });
        });

        /**
        *   If either file is missing a plugin, it will be added with the correct variables.
        *   If there is a matching plugin name, the variables will be merged and then added
        *   to config and pkg.json.
        */
        it('Test#014 : update pkg.json AND config.xml to include all plugins and merge variables (no dupes)', () => {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-camera',
                    spec: '~2.2.0',
                    variables: { variable_1: 'value_1', variable_2: 'value_2' }
                })
                .addPlugin({
                    name: 'cordova-plugin-device',
                    spec: '~1.0.0',
                    variables: {}
                })
                .write();
            setPkgJson('dependencies', {
                'cordova-plugin-camera': '^2.3.0'
            });
            setPkgJson('cordova.plugins', {
                'cordova-plugin-splashscreen': {},
                'cordova-plugin-camera': { variable_1: 'value_1', variable_3: 'value_3' }
            });

            return restore.installPluginsFromConfigXML({save: true}).then(() => {
                expectConsistentPlugins([{
                    name: 'cordova-plugin-camera',
                    spec: '^2.3.0',
                    variables: { variable_1: 'value_1', variable_2: 'value_2', variable_3: 'value_3' }
                }, {
                    name: 'cordova-plugin-device',
                    spec: '~1.0.0',
                    variables: {}
                }, {
                    name: 'cordova-plugin-splashscreen',
                    spec: undefined,
                    variables: {}
                }]);
            });
        });

        /**
        *   When config has no plugins and is restored, the plugins will be restored with the
        *   pkg.json plugins and with the spec from pkg.json dependencies.
        */
        it('Test#015 : update config.xml to include all plugins/variables from pkg.json', () => {
            setPkgJson('dependencies', {
                'cordova-plugin-camera': '^2.3.0'
            });
            setPkgJson('cordova.plugins', {
                'cordova-plugin-camera': { variable_1: 'value_1' }
            });

            return restore.installPluginsFromConfigXML({save: true}).then(() => {
                expectConsistentPlugins([{
                    name: 'cordova-plugin-camera',
                    spec: '^2.3.0',
                    variables: { variable_1: 'value_1' }
                }]);
            });
        });

        it('Test#018 : should restore saved plugin using an URL spec', () => {
            const PLUGIN_ID = 'cordova-plugin-splashscreen';
            const PLUGIN_URL = 'https://github.com/apache/cordova-plugin-splashscreen';

            getCfg()
                .addPlugin({ name: PLUGIN_ID, spec: PLUGIN_URL })
                .write();

            setPkgJson('dependencies', {
                [PLUGIN_ID]: `git+${PLUGIN_URL}.git`
            });
            setPkgJson('cordova.plugins', { [PLUGIN_ID]: {} });

            return restore.installPluginsFromConfigXML({ save: true }).then(() => {
                // Config.xml spec now matches the one in pkg.json.
                expectConsistentPlugins([{
                    name: PLUGIN_ID,
                    spec: `git+${PLUGIN_URL}.git`,
                    variables: jasmine.any(Object)
                }]);
            });
        });
    });
});
