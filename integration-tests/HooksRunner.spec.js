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
 **/

'use strict';

const Q = require('q');
const path = require('path');
const fs = require('fs-extra');
const globby = require('globby');

const HooksRunner = require('../src/hooks/HooksRunner');
const cordovaUtil = require('../src/cordova/util');
const cordova = require('../src/cordova/cordova');

const tmpDir = require('../spec/helpers').tmpDir;
const testPlatform = require('../spec/helpers').testPlatform;

const PluginInfo = require('cordova-common').PluginInfo;
const superspawn = require('cordova-common').superspawn;

const Q_chainmap = require('../src/util/promise-util').Q_chainmap;

const tmp = tmpDir('hooks_test');
const project = path.join(tmp, 'project');
const preparedProject = path.join(tmp, 'preparedProject');
const ext = process.platform === 'win32' ? 'bat' : 'sh';
const fixtures = path.join(__dirname, '../spec/cordova/fixtures');

const testPlugin = 'com.plugin.withhooks';
const testPluginFixture = path.join(fixtures, 'plugins', testPlugin);
const testPluginInstalledPath = path.join(project, 'plugins', testPlugin);

describe('HooksRunner', function () {
    let hooksRunner, hookOptions;

    // This prepares a project that we will copy and use for all tests
    beforeAll(function () {
        // Copy project fixture
        const projectFixture = path.join(fixtures, 'projWithHooks');
        fs.copySync(projectFixture, preparedProject);

        // Copy sh/bat scripts
        const extDir = path.join(projectFixture, `_${ext}`);
        fs.readdirSync(extDir).forEach(d => {
            fs.copySync(path.join(extDir, d), path.join(preparedProject, d));
        });

        // Ensure scripts are executable
        globby.sync(['hooks/**', '.cordova/hooks/**', 'scripts/**'], {
            cwd: preparedProject, absolute: true
        }).forEach(f => fs.chmodSync(f, 0o755));

        // Add the testing platform and plugin to our project
        fs.copySync(
            path.join(__dirname, '../spec/plugman/projects', testPlatform),
            path.join(preparedProject, 'platforms', testPlatform)
        );
        fs.copySync(
            testPluginFixture,
            path.join(preparedProject, 'plugins', testPlugin)
        );
    });

    beforeEach(function () {
        // Reset our test project
        // We are linking node_modules to improve performance
        process.chdir(__dirname); // Avoid EBUSY on Windows
        fs.removeSync(project);
        fs.copySync(preparedProject, project, {
            filter: p => path.basename(p) !== 'node_modules'
        });
        const platformModules = 'platforms/android/cordova/node_modules';
        fs.symlinkSync(path.join(preparedProject, platformModules),
            path.join(project, platformModules), 'junction');

        // Change into our project directory
        process.chdir(project);
        process.env.PWD = project; // this is used by cordovaUtil.isCordova

        hookOptions = {
            projectRoot: project,
            cordova: cordovaUtil.preProcessOptions()
        };

        hooksRunner = new HooksRunner(project);
    });

    afterAll(function () {
        process.chdir(path.join(__dirname, '..')); // Non e2e tests assume CWD is repo root.
        fs.removeSync(tmp);
    });

    it('Test 001 : should throw if provided directory is not a cordova project', function () {
        expect(_ => new HooksRunner(tmp)).toThrow();
    });

    it('Test 002 : should not throw if provided directory is a cordova project', function () {
        expect(_ => new HooksRunner(project)).not.toThrow();
    });

    describe('fire method', function () {
        const test_event = 'before_build';
        const hooksOrderFile = path.join(project, 'hooks_order.txt');
        let fire;

        beforeEach(function () {
            fs.removeSync(hooksOrderFile);
            fire = spyOn(HooksRunner.prototype, 'fire').and.callThrough();
        });

        // helper methods
        function getActualHooksOrder () {
            const fileContents = fs.readFileSync(hooksOrderFile, 'ascii');
            return fileContents.match(/\d+/g).map(Number);
        }

        function checkHooksOrderFile () {
            expect(hooksOrderFile).toExist();

            const hooksOrder = getActualHooksOrder();
            const sortedHooksOrder = hooksOrder.slice(0).sort((a, b) => a - b);
            expect(hooksOrder).toEqual(sortedHooksOrder);
        }

        function useAppConfig (name) {
            fs.copySync(path.join(project, `config${name}_${ext}.xml`), path.join(project, 'config.xml'));
        }

        function usePluginConfig (name) {
            fs.copySync(path.join(testPluginInstalledPath, `plugin${name}_${ext}.xml`), path.join(testPluginInstalledPath, 'plugin.xml'));
        }

        describe('application hooks', function () {
            it('Test 004 : should execute hook scripts serially', function () {
                return hooksRunner.fire(test_event, hookOptions)
                    .then(checkHooksOrderFile);
            });

            it('Test 005 : should execute hook scripts serially from .cordova/hooks/hook_type and hooks/hook_type directories', function () {
                // using empty platforms list to test only hooks/ directories
                hookOptions.cordova.platforms = [];

                return hooksRunner.fire(test_event, hookOptions)
                    .then(checkHooksOrderFile);
            });

            it('Test 006 : should execute hook scripts serially from config.xml', function () {
                useAppConfig('OnlyNonPlatformScripts');

                return hooksRunner.fire(test_event, hookOptions)
                    .then(checkHooksOrderFile);
            });

            it('Test 007 : should execute hook scripts serially from config.xml including platform scripts', function () {
                useAppConfig('OnePlatform');

                return hooksRunner.fire(test_event, hookOptions)
                    .then(checkHooksOrderFile);
            });

            it('Test 008 : should filter hook scripts from config.xml by platform', function () {
                useAppConfig('TwoPlatforms');
                hookOptions.cordova.platforms = ['android'];

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    checkHooksOrderFile();

                    const baseScriptResults = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    const androidPlatformScriptsResults = [14, 15];
                    const expectedResults = baseScriptResults.concat(androidPlatformScriptsResults);
                    expect(getActualHooksOrder()).toEqual(expectedResults);
                });
            });
        });

        describe('plugin hooks', function () {
            it('Test 011 : should filter hook scripts from plugin.xml by platform', function () {
                // Make scripts executable
                globby.sync('scripts/**', {cwd: testPluginInstalledPath, absolute: true})
                    .forEach(f => fs.chmodSync(f, 0o755));

                usePluginConfig('TwoPlatforms');
                hookOptions.cordova.platforms = ['android'];

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    checkHooksOrderFile();

                    const baseScriptResults = [1, 2, 3, 4, 5, 6, 7, 21, 22];
                    const androidPlatformScriptsResults = [26];
                    const expectedResults = baseScriptResults.concat(androidPlatformScriptsResults);
                    expect(getActualHooksOrder()).toEqual(expectedResults);
                });
            });

            it('Test 012 : should run before_plugin_uninstall, before_plugin_install, after_plugin_install hooks for a plugin being installed with correct opts.plugin context', function () {
                const hooksToTest = [
                    'before_plugin_uninstall',
                    'before_plugin_install',
                    'after_plugin_install'
                ];
                const toPlainObject = o => JSON.parse(JSON.stringify(o));

                const expectedContext = toPlainObject({
                    cordova: {
                        platforms: [ 'android' ],
                        plugins: [testPlugin],
                        version: require('../package').version
                    },
                    plugin: {
                        id: testPlugin,
                        pluginInfo: new PluginInfo(testPluginInstalledPath),
                        platform: 'android',
                        dir: testPluginInstalledPath
                    },
                    projectRoot: project
                });
                // Delete unique ids to allow comparing PluginInfo
                delete expectedContext.plugin.pluginInfo._et;

                return Promise.resolve()
                    .then(_ => cordova.plugin('rm', testPlugin))
                    .then(_ => cordova.plugin('add', testPluginFixture))
                    .then(_ => {
                        fire.calls.all()
                            .filter(call => hooksToTest.indexOf(call.args[0]) !== -1)
                            .forEach(call => {
                                const context = toPlainObject(call.args[1]);

                                expect(context).toBeDefined();
                                expect(context.plugin).toBeDefined();
                                expect(context.plugin.platform).toBe(testPlatform);

                                // Delete unique ids to allow comparing PluginInfo
                                delete context.plugin.pluginInfo._et;

                                expect(context).toEqual(expectedContext);
                            });
                    });
            }, 20 * 1000);
        });

        describe('plugin hooks', function () {
            beforeEach(function () {
                spyOn(superspawn, 'spawn').and.callFake(function (cmd, args) {
                    if (cmd.match(/create\b/)) {
                        // This is a call to the bin/create script, so do the copy ourselves.
                        fs.copySync(path.join(fixtures, 'platforms/android'), path.join(project, 'platforms/android'));
                    } else if (cmd.match(/update\b/)) {
                        fs.writeFileSync(path.join(project, 'platforms', testPlatform, 'updated'), 'I was updated!', 'utf-8');
                    } else if (cmd.match(/version/)) {
                        return '3.6.0';
                    }
                    return Q();
                });
            });

            it('Test 009 : should execute hook scripts serially from plugin.xml', function () {
                usePluginConfig('OnlyNonPlatformScripts');

                return hooksRunner.fire(test_event, hookOptions)
                    .then(checkHooksOrderFile);
            });

            it('Test 010 : should execute hook scripts serially from plugin.xml including platform scripts', function () {
                usePluginConfig('OnePlatform');

                return hooksRunner.fire(test_event, hookOptions)
                    .then(checkHooksOrderFile);
            });

            it('Test 013 : should not execute the designated hook when --nohooks option specifies the exact hook name', function () {
                hookOptions.nohooks = ['before_build'];

                return hooksRunner.fire(test_event, hookOptions).then(function (msg) {
                    expect(msg).toBeDefined();
                    expect(msg).toBe('hook before_build is disabled.');
                });
            });

            it('Test 014 : should not execute a set of matched hooks when --nohooks option specifies the hook pattern.', function () {
                var test_events = ['before_build', 'after_plugin_add', 'before_platform_rm', 'before_prepare'];
                hookOptions.nohooks = ['before*'];

                return Q_chainmap(test_events, e => {
                    return hooksRunner.fire(e, hookOptions).then(msg => {
                        if (e === 'after_plugin_add') {
                            expect(msg).toBeUndefined();
                        } else {
                            expect(msg).toBeDefined();
                            expect(msg).toBe(`hook ${e} is disabled.`);
                        }
                    });
                });
            });

            it('Test 015 : should not execute all hooks when --nohooks option specifies .', function () {
                var test_events = ['before_build', 'after_plugin_add', 'before_platform_rm', 'before_prepare'];
                hookOptions.nohooks = ['.'];

                return Q_chainmap(test_events, e => {
                    return hooksRunner.fire(e, hookOptions).then(msg => {
                        expect(msg).toBeDefined();
                        expect(msg).toBe(`hook ${e} is disabled.`);
                    });
                });
            });
        });

        describe('module-level hooks (event handlers)', function () {
            var handler = jasmine.createSpy().and.returnValue(Q());

            afterEach(function () {
                cordova.removeAllListeners(test_event);
                handler.calls.reset();
            });

            it('Test 016 : should fire handlers using cordova.on', function () {
                cordova.on(test_event, handler);
                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(handler).toHaveBeenCalled();
                });
            });

            it('Test 017 : should pass the project root folder as parameter into the module-level handlers', function () {
                cordova.on(test_event, handler);
                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(handler).toHaveBeenCalledWith(hookOptions);
                });
            });

            it('Test 018 : should be able to stop listening to events using cordova.off', function () {
                cordova.on(test_event, handler);
                cordova.off(test_event, handler);
                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(handler).not.toHaveBeenCalled();
                });
            });

            it('Test 019 : should execute event listeners serially', function () {
                const order = [];
                // Delay 100 ms here to check that h2 is not executed until after
                // the promise returned by h1 is resolved.
                const h1 = _ => Q.delay(100).then(_ => order.push(1));
                const h2 = _ => Q().then(_ => order.push(2));

                cordova.on(test_event, h1);
                cordova.on(test_event, h2);

                return hooksRunner.fire(test_event, hookOptions)
                    .then(_ => expect(order).toEqual([1, 2]));
            });

            it('Test 021 : should pass data object that fire calls into async handlers', function () {
                var asyncHandler = function (opts) {
                    expect(opts).toEqual(hookOptions);
                    return Q();
                };
                cordova.on(test_event, asyncHandler);
                return hooksRunner.fire(test_event, hookOptions);
            });

            it('Test 022 : should pass data object that fire calls into sync handlers', function () {
                var syncHandler = function (opts) {
                    expect(opts).toEqual(hookOptions);
                };
                cordova.on(test_event, syncHandler);
                return hooksRunner.fire(test_event, hookOptions);
            });

            it('Test 023 : should error if any script exits with non-zero code', function () {
                return hooksRunner.fire('fail', hookOptions).then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                });
            });
        });

        it('Test 024 : should not error if the hook is unrecognized', function () {
            return hooksRunner.fire('CLEAN YOUR SHORTS GODDAMNIT LIKE A BIG BOY!', hookOptions);
        });
    });

    describe('extractSheBangInterpreter', () => {
        const rewire = require('rewire');
        const HooksRunner = rewire('../src/hooks/HooksRunner');
        const extractSheBangInterpreter = HooksRunner.__get__('extractSheBangInterpreter');

        it('Test 025 : should not read uninitialized buffer contents', () => {
            spyOn(require('fs'), 'readSync').and.callFake((fd, buf) => {
                buf.write('#!/usr/bin/env XXX\n# foo');
                return 0;
            });
            expect(extractSheBangInterpreter(__filename)).toBeFalsy();
        });
    });
});
