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
const semver = require('semver');
const { listPlatforms, requireNoCache } = require('../src/cordova/util');
const { tmpDir: getTmpDir, testPlatform, getFixture, setDefaultTimeout } = require('../spec/helpers');
const projectTestHelpers = require('../spec/project-test-helpers');
const cordova = require('../src/cordova/cordova');

describe('pkgJson', function () {
    const TIMEOUT = 150 * 1000;
    setDefaultTimeout(TIMEOUT);

    const fixturesPath = path.join(__dirname, '../spec/cordova/fixtures');
    let tmpDir, project, pkgJsonPath;
    const {
        getPkgJsonPath, setupBaseProject, getCfg, getPkgJson, setPkgJson
    } = projectTestHelpers(() => project);

    beforeEach(() => {
        tmpDir = getTmpDir('pkgJson');
        project = path.join(tmpDir, 'project');
        pkgJsonPath = getPkgJsonPath();
        delete process.env.PWD;
    });

    afterEach(() => {
        process.chdir(__dirname); // Needed to rm the dir on Windows.
        fs.removeSync(tmpDir);
    });

    // Copies a fixture to temp dir to avoid modifiying it as they get installed as symlinks
    function copyFixture (fixtureRelativePath) {
        const fixturePath = path.join(fixturesPath, fixtureRelativePath);
        const tmpPath = path.join(tmpDir, path.basename(fixtureRelativePath));
        fs.copySync(fixturePath, tmpPath);
        return tmpPath;
    }

    function installedPlatforms () {
        // Sort platform list to allow for easy pseudo set equality
        return listPlatforms(project).sort();
    }

    function platformVersion (platformName) {
        const p = path.join(project, 'platforms', platformName, 'cordova/Api.js');
        expect(p).toExist();
        return requireNoCache(p).version();
    }

    function pluginVersion (pluginName) {
        const p = path.join(project, 'plugins', pluginName, 'package.json');
        expect(p).toExist();
        return fs.readJsonSync(p).version;
    }

    function specSatisfiedBy (version) {
        return {
            asymmetricMatch: spec => semver.satisfies(version, spec),
            jasmineToString: _ => `<specSatisfiedBy(${version})>`
        };
    }

    function specWithMinSatisfyingVersion (version) {
        return {
            asymmetricMatch: spec =>
                !semver.intersects(spec, `<${version}`) &&
                semver.intersects(spec, `>=${version}`),
            jasmineToString: _ => `<specWithMinSatisfyingVersion(${version})>`
        };
    }

    const customMatchers = {
        toSatisfy: () => ({
            compare (version, spec) {
                const pass = semver.satisfies(version, spec);
                const expectation = (pass ? 'not ' : '') + 'to satisfy';
                return {
                    pass, message: `expected ${version} ${expectation} ${spec}`
                };
            }
        }),
        tohaveMinSatisfyingVersion: () => ({
            compare (spec, version) {
                const pass = specWithMinSatisfyingVersion(version).asymmetricMatch(spec);
                const expectation = (pass ? 'not ' : '') + 'to have minimal satisfying version';
                return {
                    pass, message: `expected ${spec} ${expectation} ${version}`
                };
            }
        })
    };

    // Add our custom matchers
    beforeEach(() => jasmine.addMatchers(customMatchers));

    // This group of tests checks if plugins are added and removed as expected from package.json.
    describe('plugin end-to-end', function () {
        const pluginId = 'cordova-plugin-device';

        // Prepare a project with platform that can be reused by below tests
        let projectFixture;
        beforeAll(() => {
            projectFixture = getTmpDir('pkgJson-project-fixture');
            return getFixture('projectWithPlatform').copyTo(projectFixture);
        });

        afterAll(() => {
            process.chdir(__dirname); // Needed to rm the dir on Windows.
            fs.removeSync(projectFixture);
        });

        beforeEach(function () {
            fs.copySync(projectFixture, project);
            process.chdir(project);
        });

        it('Test#001 : should successfully add and remove a plugin with save and correct spec', function () {
            // No plugins in config or pkg.json yet.
            expect(getCfg().getPluginIdList()).toEqual([]);
            expect(getPkgJson('cordova.plugins')).toBeUndefined();

            // Add the plugin with --save.
            return cordova.plugin('add', `${pluginId}@1.1.2`, { save: true })
                .then(function () {
                    // Check that the plugin and spec add was successful to pkg.json.
                    expect(getPkgJson('cordova.plugins')[pluginId]).toBeDefined();
                    expect(getPkgJson('devDependencies')[pluginId]).tohaveMinSatisfyingVersion('1.1.2');

                    expect(getCfg().getPluginIdList()).toEqual([]);
                }).then(function () {
                    // And now remove it with --save.
                    return cordova.plugin('rm', pluginId, { save: true });
                }).then(function () {
                    // Expect plugin to be removed from pkg.json.
                    expect(getPkgJson('cordova.plugins')[pluginId]).toBeUndefined();
                    expect(getPkgJson('devDependencies')[pluginId]).toBeUndefined();
                });
        });

        it('Test#002 : should NOT add a plugin to package.json if --save is not used', function () {
            const SAVED_PLUGIN = 'cordova-plugin-geolocation';
            expect(pkgJsonPath).toExist();

            // Add the geolocation plugin with --save.
            return cordova.plugin('add', SAVED_PLUGIN, { save: true })
                .then(function () {
                    // Add a second plugin without save.
                    return cordova.plugin('add', pluginId);
                }).then(function () {
                    // Expect that only the plugin that had --save was added.
                    expect(getPkgJson('cordova.plugins')).toEqual({
                        [SAVED_PLUGIN]: jasmine.anything()
                    });
                });
        });

        it('Test#003 : should NOT remove plugin from package.json if there is no --save', function () {
            expect(pkgJsonPath).toExist();

            // Add the plugin with --save.
            return cordova.plugin('add', pluginId, { save: true })
                .then(function () {
                    expect(getPkgJson('cordova.plugins')).toEqual({
                        [pluginId]: {}
                    });
                }).then(function () {
                    // And now remove it, but without --save.
                    return cordova.plugin('rm', pluginId);
                }).then(function () {
                    // The plugin should still be in package.json.
                    expect(getPkgJson('cordova.plugins')).toEqual({
                        [pluginId]: {}
                    });
                });
        });

        it('Test#004 : should successfully add and remove a plugin with variables and save to package.json', function () {
            expect(pkgJsonPath).toExist();

            // Add the plugin with --save.
            return cordova.plugin('add', pluginId, { save: true, cli_variables: { someKey: 'someValue' } })
                .then(function () {
                    // Check the plugin add was successful and that variables have been added too.
                    expect(getPkgJson('cordova.plugins')).toEqual({
                        [pluginId]: { someKey: 'someValue' }
                    });
                }).then(function () {
                    // And now remove it with --save.
                    return cordova.plugin('rm', pluginId, { save: true });
                }).then(function () {
                    // Checking that the plugin and variables were removed successfully.
                    expect(getPkgJson('cordova.plugins')).toEqual({});
                });
        });

        it('Test#005 : should successfully add and remove multiple plugins with save & fetch', function () {
            const OTHER_PLUGIN = 'cordova-plugin-device-motion';
            expect(pkgJsonPath).toExist();

            // Add the plugin with --save.
            return cordova.plugin('add', [pluginId, OTHER_PLUGIN], { save: true })
                .then(function () {
                    // Check that the plugin add was successful.
                    expect(getPkgJson('cordova.plugins')).toEqual({
                        [pluginId]: {}, [OTHER_PLUGIN]: {}
                    });
                    expect(getPkgJson('devDependencies')).toEqual({
                        'cordova-android': jasmine.any(String),
                        [pluginId]: jasmine.any(String),
                        [OTHER_PLUGIN]: jasmine.any(String)
                    });
                }).then(function () {
                    // And now remove it with --save.
                    return cordova.plugin('rm', [pluginId, OTHER_PLUGIN], { save: true });
                }).then(function () {
                    // Checking that the plugin removed is in not in the platforms.
                    expect(getPkgJson('cordova.plugins')).toEqual({});
                    expect(getPkgJson('devDependencies')).toEqual({
                        'cordova-android': jasmine.any(String)
                    });
                });
        });

        // Test #023 : if pkg.json and config.xml have no platforms/plugins/spec.
        // and --save is called, use the pinned version or plugin pkg.json version.
        it('Test#023 : use pinned/lastest version if there is no platform/plugin version passed in and no platform/plugin versions in pkg.json or config.xml', function () {
            const PLATFORM = 'ios';
            const PLUGIN = 'cordova-plugin-geolocation';

            // Pkg.json has no platform or plugin or specs.
            expect(getPkgJson('cordova.platforms')).not.toContain(PLATFORM);
            expect(getPkgJson(`devDependencies.${PLUGIN}`)).toBeUndefined();

            // Config.xml has no platform or plugin or specs.
            expect(getCfg().getEngines()).not.toContain(PLATFORM);
            expect(getCfg().getPluginIdList()).toEqual([]);

            return cordova.platform('add', PLATFORM, { save: true })
                .then(function () {
                    expect(getPkgJson('cordova.platforms')).toContain(PLATFORM);
                }).then(function () {
                    return cordova.plugin('add', PLUGIN, { save: true });
                }).then(function () {
                    const iosJson = fs.readJsonSync(path.join(project, 'platforms/ios/ios.json'));
                    expect(iosJson.installed_plugins[PLUGIN]).toBeDefined();

                    // Check that installed version satisfies the dependency spec
                    const version = pluginVersion(PLUGIN);
                    expect(version).toSatisfy(getPkgJson(`devDependencies.${PLUGIN}`));
                });
        });

        // Test#025: has a pkg.json. Checks if local path is added to pkg.json for platform and plugin add.
        it('Test#025 : if you add a plugin with local path, pkg.json gets updated', () => {
            const PLUGIN = 'cordova-lib-test-plugin';
            const pluginPath = copyFixture(path.join('plugins', PLUGIN));

            // Run cordova plugin add local path --save
            return cordova.plugin('add', pluginPath, { save: true })
                .then(() => {
                    // Pkg.json has test plugin.
                    expect(getPkgJson(`cordova.plugins.${PLUGIN}`)).toBeDefined();
                    expect(getPkgJson(`devDependencies.${PLUGIN}`)).toBeDefined();
                });
        });

        it('Test#026 : should successfully add a plugin with git/semver combo', async () => {
            const TAG = '#semver:2.0.x';
            const URL = `https://github.com/apache/cordova-plugin-device.git${TAG}`;

            expect(getPkgJson('cordova.plugins')).toBeUndefined();
            expect(getPkgJson(`devDependencies.${pluginId}`)).toBeUndefined();

            await cordova.plugin('add', URL, { save: true });
            expect(getPkgJson('cordova.plugins')[pluginId]).toBeDefined();
            expect(getPkgJson('devDependencies')[pluginId]).toContain(TAG);
        });
    });

    // This group of tests checks if platforms are added and removed as expected from package.json.
    describe('platform end-to-end with --save', function () {
        beforeEach(() => setupBaseProject());

        it('Test#006 : platform is added and removed correctly with --save', function () {
            expect(pkgJsonPath).toExist();
            expect(installedPlatforms()).toEqual([]);

            // Add the testing platform with --save.
            return cordova.platform('add', testPlatform, { save: true }).then(function () {
                // Check the platform add was successful.
                expect(installedPlatforms()).toEqual([testPlatform]);
                expect(getPkgJson('cordova.platforms')).toEqual([testPlatform]);
            }).then(function () {
                // And now remove it with --save.
                return cordova.platform('rm', testPlatform, { save: true });
            }).then(function () {
                // Checking that the platform removed is in not in the platforms key.
                expect(getPkgJson('cordova.platforms')).toEqual([]);
            });
        });

        it('Test#007 : should not remove platforms from package.json when removing without --save', function () {
            expect(pkgJsonPath).toExist();
            expect(installedPlatforms()).toEqual([]);

            // Add the testing platform with --save.
            return cordova.platform('add', testPlatform, { save: true }).then(function () {
                // Check the platform add was successful.
                expect(installedPlatforms()).toEqual([testPlatform]);
                expect(getPkgJson('cordova.platforms')).toEqual([testPlatform]);
            }).then(function () {
                // And now remove it without --save.
                return cordova.platform('rm', testPlatform);
            }).then(function () {
                // Check that the removed platform is still in cordova.platforms...
                expect(getPkgJson('cordova.platforms')).toEqual([testPlatform]);
                // ... but is not actually installed any longer
                expect(installedPlatforms()).toEqual([]);
            });
        });

        it('Test#008 : should not add platform to package.json when adding without --save', function () {
            expect(getPkgJson('cordova')).toBeUndefined();

            // Add platform without --save.
            return cordova.platform('add', testPlatform)
                .then(function () {
                    // Test platform should have been installed but not added to pkg.json
                    expect(installedPlatforms()).toEqual([testPlatform]);
                    expect(getPkgJson('cordova')).toBeUndefined();
                });
        });

        it('Test#009 : should only add the platform to package.json with --save', function () {
            const platformNotToAdd = 'ios';
            expect(pkgJsonPath).toExist();

            // Add a platform without --save.
            return cordova.platform('add', platformNotToAdd)
                .then(function () {
                    // And now add another platform with --save.
                    return cordova.platform('add', testPlatform, { save: true });
                }).then(function () {
                    // Check that only the platform added with --save was added to package.json.
                    expect(getPkgJson('cordova.platforms')).toEqual([testPlatform]);
                });
        });

        it('Test#010 : two platforms are added and removed correctly with --save', function () {
            // No platforms installed nor saved in config or pkg.json yet.
            expect(getPkgJson('cordova')).toBeUndefined();
            expect(getCfg().getEngines()).toEqual([]);
            expect(installedPlatforms()).toEqual([]);

            // Add the testing platform with --save and add specific version to android platform.
            return cordova.platform('add', ['android@9.0.0', 'ios@6.1.0'], { save: true }).then(function () {
                expect(installedPlatforms()).toEqual(['android', 'ios']);

                // Check the platform add was successful in platforms list and
                // dependencies should have specific version from add.
                expect(getPkgJson('cordova.platforms')).toEqual(['android', 'ios']);
                expect(getPkgJson('devDependencies')).toEqual({
                    'cordova-android': specWithMinSatisfyingVersion('9.0.0'),
                    'cordova-ios': specWithMinSatisfyingVersion('6.1.0')
                });

                expect(getCfg().getEngines()).toEqual([]);
            }).then(function () {
                // And now remove it with --save.
                return cordova.platform('rm', ['android', 'ios'], { save: true });
            }).then(function () {
                // Expect platforms to be uninstalled & removed from config files
                expect(getPkgJson('cordova.platforms')).toEqual([]);
                expect(getPkgJson('devDependencies') || {}).toEqual({});
                expect(getCfg().getEngines()).toEqual([]);
                expect(installedPlatforms()).toEqual([]);
            });
        });

        it('Test#012 : platform with local path is added correctly with --save', () => {
            const PLATFORM = 'android';
            const platformPath = path.join(tmpDir, PLATFORM);

            expect(getPkgJson('cordova')).toBeUndefined();
            expect(installedPlatforms()).toEqual([]);

            return getFixture('androidPlatform').copyTo(platformPath)
                .then(() => {
                    return cordova.platform('add', platformPath, { save: true });
                })
                .then(() => {
                    expect(installedPlatforms()).toEqual([PLATFORM]);
                    expect(getPkgJson('cordova.platforms')).toEqual([PLATFORM]);
                    expect(getPkgJson(`devDependencies.cordova-${PLATFORM}`)).toBeDefined();
                });
        });
    });

    // Test #020 : pkg.json contains platform/spec and plugin/spec and config.xml does not
    describe('with differing config files', function () {
        beforeEach(() => setupBaseProject());

        /** Test#020 will check that pkg.json, config.xml, platforms.json, and cordova platform ls
        *   are updated with the correct (platform and plugin) specs from pkg.json.
        */
        // @todo add a test to also support checking dependencies
        it('Test#020 : During add, if pkg.json has a spec, use that one.', function () {
            const PLATFORM = 'ios';
            const PLUGIN = 'cordova-plugin-splashscreen';

            setPkgJson('cordova.platforms', [PLATFORM]);
            setPkgJson('devDependencies', {
                [PLUGIN]: '^3.2.2',
                [`cordova-${PLATFORM}`]: '^6.1.0'
            });

            // config.xml has no platforms or plugins yet.
            expect(getCfg().getEngines()).toEqual([]);
            expect(getCfg().getPluginIdList()).toEqual([]);

            expect(installedPlatforms()).toEqual([]);

            return cordova.platform('add', PLATFORM, { save: true }).then(function () {
                // No change to pkg.json platforms or spec for ios.
                expect(getPkgJson('cordova.platforms')).toEqual([PLATFORM]);
                // Config.xml and ios/cordova/version check.
                const version = platformVersion(PLATFORM);
                // Check that pkg.json and ios/cordova/version versions "satisfy" each other.
                const pkgSpec = getPkgJson(`devDependencies.cordova-${PLATFORM}`);
                expect(version).toSatisfy(pkgSpec);
            }).then(function () {
                return cordova.plugin('add', PLUGIN, { save: true });
            }).then(function () {
                // Check that installed version satisfies the dependency spec
                expect(pluginVersion(PLUGIN)).toSatisfy(getPkgJson(`devDependencies.${PLUGIN}`));
            });
        }, TIMEOUT * 2);

        /** Test#021 during add, this test will check that pkg.json, config.xml, platforms.json,
        *   and cordova platform ls are updated with the correct platform/plugin spec from config.xml.
        */
        it('Test#021 : If config.xml has a spec (and none was specified and pkg.json does not have one), use config.', function () {
            const PLATFORM = 'ios';
            const PLUGIN = 'cordova-plugin-splashscreen';

            getCfg()
                .addEngine(PLATFORM, '~4.2.1')
                .addPlugin({ name: PLUGIN, spec: '~3.2.2' })
                .write();

            expect(installedPlatforms()).toEqual([]);

            // Remove for testing purposes so platform is not pre-installed.
            return cordova.platform('rm', PLATFORM, { save: true }).then(function () {
                return cordova.platform('add', PLATFORM, { save: true });
            }).then(function () {
                // pkg.json has new platform.
                expect(getPkgJson('cordova.platforms')).toEqual([PLATFORM]);
            }).then(function () {
                return cordova.plugin('add', PLUGIN, { save: true });
            }).then(function () {
                expect(getCfg().getPlugins()).toEqual([{
                    name: PLUGIN,
                    spec: specSatisfiedBy(pluginVersion(PLUGIN)),
                    variables: {}
                }]);
            });
        });

        /** Test#022 : when adding with a specific platform version, always use that one
        *   regardless of what is in package.json or config.xml.
        */
        it('Test#022 : when adding with a specific platform version, always use that one.', function () {
            const PLATFORM = 'ios';
            const PLUGIN = 'cordova-plugin-splashscreen';

            setPkgJson('cordova.platforms', [PLATFORM]);
            setPkgJson('devDependencies', {
                [`cordova-${PLATFORM}`]: '^6.1.0',
                [PLUGIN]: '^3.2.2'
            });
            getCfg()
                .addEngine(PLATFORM, '~6.1.0')
                .addPlugin({ name: PLUGIN, spec: '~3.2.1' })
                .write();

            expect(installedPlatforms()).toEqual([]);

            return cordova.platform('add', `${PLATFORM}@6.1.0`, { save: true }).then(function () {
                // Pkg.json has ios.
                expect(getPkgJson('cordova.platforms')).toEqual([PLATFORM]);
            }).then(function () {
                return cordova.plugin('add', `${PLUGIN}@4.0.0`, { save: true });
            }).then(function () {
                // Check that installed version satisfies the dependency spec
                const version = pluginVersion(PLUGIN);
                expect(version).toSatisfy(getCfg().getPlugin(PLUGIN).spec);
                expect(version).toSatisfy(getPkgJson(`devDependencies.${PLUGIN}`));
            });
        });
    });
});
