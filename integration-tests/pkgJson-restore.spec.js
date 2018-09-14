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

'use strict';

const path = require('path');
const fs = require('fs-extra');
const prepare = require('../src/cordova/prepare');
const cordovaPlugin = require('../src/cordova/plugin');
const cordovaPlatform = require('../src/cordova/platform');

const ConfigParser = require('cordova-common').ConfigParser;
const listPlatforms = require('../src/cordova/util').listPlatforms;

const helpers = require('../spec/helpers');
const getTmpDir = helpers.tmpDir;
const testPlatform = helpers.testPlatform;
const setDefaultTimeout = helpers.setDefaultTimeout;

const TIMEOUT = 240 * 1000;

/** Testing will check if "cordova prepare" is restoring platforms and plugins as expected.
*   Uses different basePkgJson files depending on testing expecations of what (platforms/plugins/variables)
*   should initially be in pkg.json and/or config.xml.
*/
describe('restore', function () {
    setDefaultTimeout(TIMEOUT);

    const fixturesPath = path.join(__dirname, '../spec/cordova/fixtures');
    var tmpDir, project, pkgJsonPath, configXmlPath;

    beforeEach(() => {
        tmpDir = getTmpDir('pkgJson');
        project = path.join(tmpDir, 'project');
        pkgJsonPath = path.join(project, 'package.json');
        configXmlPath = path.join(project, 'config.xml');
        delete process.env.PWD;

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
        expect(installedPlatforms()).toEqual([]);
    }

    // TODO remove this once apache/cordova-common#38
    // and apache/cordova-common#39 are resolved
    class TestConfigParser extends ConfigParser {
        addPlugin (plugin) {
            return (super.addPlugin(plugin, plugin.variables), this);
        }
        addEngine (name, spec) {
            return (super.addEngine(name, spec), this);
        }
    }
    function getCfg () {
        expect(configXmlPath).toExist();
        return new TestConfigParser(configXmlPath);
    }

    function getCfgEngineNames (cfg) {
        cfg = cfg || getCfg();
        return cfg.getEngines().map(_ => _.name);
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

    function pluginPath (pluginName) {
        return path.join(project, 'plugins', pluginName);
    }

    function installedPlatforms () {
        // Sort platform list to allow for easy pseudo set equality
        return listPlatforms(project).sort();
    }

    function expectPluginsInPkgJson (plugins) {
        const pkgJson = getPkgJson();
        expect(pkgJson).toBeDefined();

        // Check that cordova.plugins key in package.json contains the expected
        // variables and ONLY them
        const variables = plugins.reduce((o, _) => {
            o[_.name] = _.variables;
            return o;
        }, {});
        expect(pkgJson.cordova).toBeDefined();
        expect(pkgJson.cordova.plugins).toEqual(variables);

        // Check that dependencies key in package.json contains the expected specs
        // We only check the specs for plugins where an expected spec was given
        const specs = plugins.reduce((o, _) => {
            if (_.spec) o[_.name] = _.spec;
            return o;
        }, {});
        if (Object.keys(specs).length > 0) {
            expect(pkgJson.dependencies).toEqual(jasmine.objectContaining(specs));
        }
    }

    function expectConsistentPlugins (plugins) {
        expect(getCfg().getPlugins()).toEqual(plugins);

        const unwrappedPlugins = plugins.map(p => p.sample || p);
        expectPluginsInPkgJson(unwrappedPlugins);

        const pluginNames = unwrappedPlugins.map(_ => _.name);
        pluginNames.forEach(name => expect(pluginPath(name)).toExist());
    }

    describe('with --save', function () {

        /** Test#000 will check that when a platform is added with a spec, it will
        *   add to pkg.json with a '^' and to config.xml with a '~'. When prepare is run,
        *   pkg.json will have no change and config.xml (first char) will change from a '~' to a '^'.
        */
        it('Test#000 : tests that the spec (~,^) is added and updated as expected in config.xml', function () {
            const PLATFORM = 'android';

            return cordovaPlatform('add', PLATFORM, {save: true}).then(function () {
                // When spec is added to pkg.json, first char is '^'.
                const pkgJson = getPkgJson();
                expect(pkgJson.cordova.platforms).toEqual([PLATFORM]);
                expect(pkgJson.dependencies[platformPkgName(PLATFORM)]).toMatch(/^\^/);

                // When spec is added to config.xml, first char is '~'.
                expect(getCfg().getEngines()).toEqual([jasmine.objectContaining({
                    name: PLATFORM,
                    spec: jasmine.stringMatching(/^~/)
                })]);
            }).then(function () {
                return prepare();
            }).then(function () {
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
        }, 300000);

        /** Test#001 will add a platform to package.json with the 'save' flag.
        *   It will remove it from platforms.json without the save flag.
        *   After running cordova prepare, that platform should be restored in the
        *   installed platform list in platforms.json.
        */
        it('Test#001 : should restore platform that has been removed from project', function () {
            return Promise.resolve().then(function () {
                // Add the testing platform with --save.
                return cordovaPlatform('add', testPlatform, {save: true});
            }).then(function () {
                // Check the platform add was successful in package.json.
                expect(getPkgJson('cordova.platforms')).toEqual([testPlatform]);
                // Check that the platform was actually installed
                expect(installedPlatforms()).toEqual([testPlatform]);
            }).then(function () {
                // And now remove testPlatform without --save.
                return cordovaPlatform('rm', testPlatform);
            }).then(function () {
                // Check that the platform removed without --save is still in platforms key.
                expect(getPkgJson('cordova.platforms')).toEqual([testPlatform]);
            }).then(function () {
                return prepare();
            }).then(function () {
                // Check that the platform was properly restored
                expect(installedPlatforms()).toEqual([testPlatform]);
            });
        });

        /** Test#002 will add two platforms to package.json with the 'save' flag.
        *   It will remove one platform from pkg.json without the 'save' flag and remove
        *   the other platform with the 'save' flag. After running cordova prepare,
        *   the platform removed with the 'save' flag should NOT be restored in platforms.json.
        */
        it('Test#002 : should NOT restore platform that was removed with --save', function () {
            const savedPlatform = 'browser';
            const testPlatforms = Object.freeze([
                testPlatform, savedPlatform
            ]);

            return Promise.resolve().then(function () {
                // Add the test platforms with --save.
                return cordovaPlatform('add', testPlatforms, {save: true});
            }).then(function () {
                // Check the platform add of both platforms (to pkg.Json) was successful.
                expect(getPkgJson('cordova.platforms')).toEqual(testPlatforms);
                // Check that the platforms were actually installed
                expect(installedPlatforms()).toEqual(testPlatforms);
            }).then(function () {
                // Remove testPlatform with --save.
                return cordovaPlatform('rm', testPlatform, {save: true});
            }).then(function () {
                // Remove secondPlatformAdded without --save.
                return cordovaPlatform('rm', savedPlatform);
            }).then(function () {
                // Check that ONLY the platform removed without --save is still in (pkg.json) platforms key.
                expect(getPkgJson('cordova.platforms')).toEqual([savedPlatform]);
            }).then(function () {
                return prepare();
            }).then(function () {
                // Check that the platform was properly restored
                expect(installedPlatforms()).toEqual([savedPlatform]);
            });
        });

        /** Test#017
        *   When platform is added with url and fetch and restored with fetch,
        *   pkg.json and config.xml would add it to their files properly.
        *   When prepare is run with fetch, platform should be installed.
        */
        it('Test#017 : test to make sure that platform url is added and restored properly', function () {
            const PLATFORM = 'browser';
            const PLATFORM_VERSION = '5.0.4'; // EXTRA workaround to pass on Node.js 4
            const PLATFORM_URL = 'https://github.com/apache/cordova-browser';

            return Promise.resolve().then(function () {
                // Add platform with save and fetch
                return cordovaPlatform('add', `${PLATFORM_URL}#${PLATFORM_VERSION}`, {save: true});
            }).then(function () {
                // Check that platform was added to config.xml successfully.
                expect(getCfg().getEngines()).toEqual([jasmine.objectContaining({
                    name: PLATFORM,
                    spec: PLATFORM_URL + '#' + PLATFORM_VERSION
                })]);

                // Check that platform was added to pkg.json successfully.
                const pkgJson = getPkgJson();
                expect(pkgJson.cordova.platforms).toEqual([PLATFORM]);
                expect(pkgJson.dependencies[platformPkgName(PLATFORM)]).toEqual(`git+${PLATFORM_URL}.git#${PLATFORM_VERSION}`);
            }).then(function () {
                // Remove platform without --save.
                return cordovaPlatform('rm', PLATFORM);
            }).then(function () {
                // Platform in pkg.json should still be there.
                const pkgJson = getPkgJson();
                expect(pkgJson.cordova.platforms).toEqual([PLATFORM]);
                expect(pkgJson.dependencies[platformPkgName(PLATFORM)]).toEqual(`git+${PLATFORM_URL}.git#${PLATFORM_VERSION}`);
            }).then(function () {
                return prepare();
            }).then(function () {
                // Check config.xml for spec modification.
                expect(getCfg().getEngines()).toEqual([jasmine.objectContaining({
                    name: PLATFORM,
                    spec: `git+${PLATFORM_URL}.git#${PLATFORM_VERSION}`
                })]);
                // No change to pkg.json.
                const pkgJson = getPkgJson();
                expect(pkgJson.cordova.platforms).toEqual([PLATFORM]);
                expect(pkgJson.dependencies[platformPkgName(PLATFORM)]).toEqual(`git+${PLATFORM_URL}.git#${PLATFORM_VERSION}`);
            });
        });

        /** Test#018
        *   When plugin is added with url and fetch and restored with fetch,
        *   pkg.json and config.xml would add it to their files properly.
        *   When prepare is run with fetch, plugin should be installed.
        */
        it('Test#018 : test to make sure that plugin url is added and restored properly', function () {
            const PLUGIN_ID = 'cordova-plugin-splashscreen';
            const PLUGIN_URL = 'https://github.com/apache/cordova-plugin-splashscreen';

            return Promise.resolve().then(function () {
                // Add plugin with save and fetch.
                return cordovaPlugin('add', PLUGIN_URL, {save: true});
            }).then(function () {
                // Plugin was installed and added to config.xml and pkg.json
                expect(getCfg().getPlugins()).toEqual([{
                    name: PLUGIN_ID,
                    spec: PLUGIN_URL,
                    variables: jasmine.any(Object)
                }]);
                expectPluginsInPkgJson([{
                    name: PLUGIN_ID,
                    spec: `git+${PLUGIN_URL}.git`,
                    variables: jasmine.any(Object)
                }]);
                expect(pluginPath(PLUGIN_ID)).toExist();
            }).then(function () {
                // Remove plugin without --save.
                return cordovaPlugin('rm', PLUGIN_ID);
            }).then(function () {
                // config.xml and pkg.json remain unchanged
                expect(getCfg().getPlugins()).toEqual([{
                    name: PLUGIN_ID,
                    spec: PLUGIN_URL,
                    variables: jasmine.any(Object)
                }]);
                expectPluginsInPkgJson([{
                    name: PLUGIN_ID,
                    spec: `git+${PLUGIN_URL}.git`,
                    variables: jasmine.any(Object)
                }]);
                // Plugin was removed from the installed plugin list successfully.
                expect(pluginPath(PLUGIN_ID)).not.toExist();
            }).then(function () {
                // Add platform (so that prepare can run).
                return cordovaPlatform('add', 'browser', {save: true});
            }).then(function () {
                return prepare({save: true});
            }).then(function () {
                // Config.xml spec now matches the one in pkg.json.
                expectConsistentPlugins([{
                    name: PLUGIN_ID,
                    spec: `git+${PLUGIN_URL}.git`,
                    variables: jasmine.any(Object)
                }]);
            });
        });

        /** Test#003 will add two platforms to package.json - one with the 'save' flag and one
        *   without the 'save' flag. It will remove both platforms without a 'save' flag.
        *   After running cordova prepare, only the platform added with the 'save' flag is restored
        *   in platforms.json.
        */
        it('Test#003 : should NOT restore platform that was not saved and removed', function () {
            const PLATFORM_1 = 'ios';
            const PLATFORM_2 = 'browser';

            return Promise.resolve().then(function () {
                // Add PLATFORM_1 platform to project without --save
                return cordovaPlatform('add', PLATFORM_1);
            }).then(function () {
                // Add PLATFORM_2 to project with --save
                return cordovaPlatform('add', PLATFORM_2, {save: true});
            }).then(function () {
                // Both platforms are installed but only PLATFORM_2 is in pkg.json
                expect(installedPlatforms()).toEqual([PLATFORM_2, PLATFORM_1]);
                expect(getPkgJson('cordova.platforms')).toEqual([PLATFORM_2]);
            }).then(function () {
                // Remove all platforms without --save.
                return cordovaPlatform('rm', [PLATFORM_1, PLATFORM_2]);
            }).then(function () {
                // Check that the platform that was added with --save is still in package.json.
                expect(getPkgJson('cordova.platforms')).toEqual([PLATFORM_2]);
            }).then(function () {
                return prepare();
            }).then(function () {
                // Check that the platform was properly restored
                expect(installedPlatforms()).toEqual([PLATFORM_2]);
            });
        });
    });

    describe('without --save', function () {

        /** Test#004 will check the platform list in package.json and config.xml.
        *   When both files contain the same platforms and cordova prepare is run,
        *   neither file is modified.
        */
        it('Test#004 : should not modify either file if pkg.json and config.xml have the same platforms', function () {
            getCfg()
                .addEngine(testPlatform)
                .write();
            setPkgJson('cordova.platforms', [testPlatform]);

            const getModTimes = _ => ({
                cfg: fs.statSync(configXmlPath).mtime,
                pkg: fs.statSync(pkgJsonPath).mtime
            });
            const modTimes = getModTimes();

            return prepare().then(function () {
                expect(getModTimes()).toEqual(modTimes);
            });
        });

        /** Test#005 will check the platform list in package.json and config.xml.
        *   When config.xml has 'android and browser' and pkg.json only contains 'android', run cordova
        *   and pkg.json is updated to include 'browser'. This test will also check that pkg.json
        *   is updated with the correct spec/dependencies when restored. Checks that specs are
        *   added properly, too.
        */
        it('Test#005 : should update pkg.json to include platforms from config.xml', function () {
            const PLATFORM_1 = 'android';
            const PLATFORM_2 = 'browser';

            getCfg()
                .addEngine(PLATFORM_1, '7.0.0')
                .addEngine(PLATFORM_2, '^5.0.3')
                .write();
            setPkgJson('cordova.platforms', [testPlatform]);

            return prepare().then(function () {
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

        /** Test#006 will check if pkg.json has a cordova key and platforms installed already.
         *   If it does not and config.xml has a platform(s) installed already, run cordova prepare
         *   and it will add a cordova key and the platform(s) from config.xml to package.json.
         */
        it('Test#006 : should update a package.json without cordova key to include platforms from config.xml', function () {
            getCfg()
                .addEngine('android')
                .write();

            return prepare().then(function () {
                // Expect no change to config.xml.
                expect(getCfgEngineNames()).toEqual(['android']);
                // Expect cordova key and 'android' platform to be added to pkg.json.
                expect(getPkgJson('cordova.platforms')).toEqual(['android']);
            });
        });

        /** Test#007 will check the platform list in package.json and config.xml.
        *   When package.json has 'android and browser' and config.xml only contains 'android', run cordova
        *   and config.xml is updated to include 'browser'. Also, if there is a specified spec in pkg.json,
        *   it should be added to config.xml during restore.
        */
        it('Test#007 : should update config.xml to include platforms from pkg.json', function () {
            getCfg()
                .addEngine('ios', '6.0.0')
                .write();
            setPkgJson('dependencies', {
                'cordova-ios': '^4.5.4', 'cordova-browser': '^5.0.3'
            });
            setPkgJson('cordova.platforms', ['ios', 'browser']);

            return prepare().then(function () {
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

        /** Test#016 will check that cordova prepare will still restore the correct
        *   platforms and plugins even without package.json file.
        */
        it('Test#016 : should restore platforms & plugins and create a missing pkg.json', function () {
            const PLUGIN_ID = 'cordova-plugin-device';
            const PLATFORM_1 = 'android';

            getCfg()
                .addEngine(PLATFORM_1)
                .addPlugin({ name: PLUGIN_ID })
                .write();
            fs.removeSync(pkgJsonPath);

            return prepare().then(function () {
                const cfg = getCfg();
                expect(getCfgEngineNames(cfg)).toEqual([PLATFORM_1]);
                expect(cfg.getPluginIdList()).toEqual([PLUGIN_ID]);

                expect(installedPlatforms()).toEqual([PLATFORM_1]);
                expect(pluginPath(PLUGIN_ID)).toExist();

                // Package.json should be auto-created using values from config.xml
                expect(getPkgJson()).toEqual(jasmine.objectContaining({
                    name: cfg.packageName().toLowerCase(),
                    version: cfg.version(),
                    displayName: cfg.name()
                }));
            });
        });
    });

    // These tests will check the plugin/variable list in package.json and config.xml.
    describe('plugins', function () {
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
        it('Test#011 : updates config.xml to use the variable found in pkg.json', function () {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-camera',
                    variables: { variable_1: 'config' }
                })
                .write();
            setPkgJson('cordova.plugins', {
                'cordova-plugin-camera': { variable_1: 'json' }
            });

            return prepare({save: true}).then(function () {
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
        it('Test#012 : update pkg.json to include plugin and variable found in config.xml', function () {
            getCfg()
                .addPlugin({
                    name: 'cordova-plugin-camera',
                    variables: { variable_1: 'value_1' }
                })
                .write();
            setPkgJson('cordova.plugins', {
                'cordova-plugin-camera': {}
            });

            return prepare({save: true}).then(function () {
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
        it('Test#013 : update pkg.json AND config.xml to include all plugins and merge unique variables', function () {
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

            return prepare({save: true}).then(function () {
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
        it('Test#014 : update pkg.json AND config.xml to include all plugins and merge variables (no dupes)', function () {
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

            return prepare({save: true}).then(function () {
                expectConsistentPlugins([{
                    name: 'cordova-plugin-camera',
                    spec: '^2.4.1',
                    variables: { variable_1: 'value_1', variable_2: 'value_2', variable_3: 'value_3' }
                }, {
                    name: 'cordova-plugin-device',
                    spec: '^1.0.1',
                    variables: {}
                }, {
                    name: 'cordova-plugin-splashscreen',
                    spec: jasmine.any(String),
                    variables: {}
                }]);
            });
        });

        /**
        *   When config has no plugins and is restored, the plugins will be restored with the
        *   pkg.json plugins and with the spec from pkg.json dependencies.
        */
        it('Test#015 : update config.xml to include all plugins/variables from pkg.json', function () {
            setPkgJson('dependencies', {
                'cordova-plugin-camera': '^2.3.0'
            });
            setPkgJson('cordova.plugins', {
                'cordova-plugin-camera': { variable_1: 'value_1' }
            });

            return prepare({save: true}).then(function () {
                expectConsistentPlugins([{
                    name: 'cordova-plugin-camera',
                    spec: '^2.4.1',
                    variables: { variable_1: 'value_1' }
                }]);
            });
        });
    });
});
