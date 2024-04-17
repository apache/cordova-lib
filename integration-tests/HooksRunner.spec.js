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

const fs = require('node:fs');
const path = require('node:path');
const timers = require('node:timers/promises');
const et = require('elementtree');

const HooksRunner = require('../src/hooks/HooksRunner');
const cordova = require('../src/cordova/cordova');
const { tmpDir } = require('../spec/helpers');
const { PluginInfo, ConfigParser } = require('cordova-common');

const ext = process.platform === 'win32' ? 'bat' : 'sh';
const fixtures = path.join(__dirname, '../spec/cordova/fixtures');

describe('HooksRunner', function () {
    let tmp, project, hooksRunner;

    // This prepares a project that we will copy and use for all tests
    beforeEach(() => {
        tmp = tmpDir('hooks_test');
        project = path.join(tmp, 'project');

        // Copy base project fixture
        fs.cpSync(path.join(fixtures, 'basePkgJson'), project, { recursive: true });

        // Copy project hooks
        const hooksDir = path.join(fixtures, 'projectHooks');
        fs.cpSync(hooksDir, path.join(project, 'scripts'), { recursive: true });

        // Change into our project directory
        process.chdir(project);
        process.env.PWD = project; // this is used by cordovaUtil.isCordova

        hooksRunner = new HooksRunner(project);
    });

    afterEach(() => {
        process.chdir(path.join(__dirname, '..')); // Non e2e tests assume CWD is repo root.
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('Test 001 : should throw if provided directory is not a cordova project', function () {
        expect(_ => new HooksRunner(tmp)).toThrow();
    });

    it('Test 002 : should not throw if provided directory is a cordova project', function () {
        expect(_ => new HooksRunner(project)).not.toThrow();
    });

    describe('fire method', function () {
        const test_event = 'before_build';
        let hooksOrderFile;

        beforeEach(function () {
            hooksOrderFile = path.join(project, 'hooks_order.txt');
            fs.rmSync(hooksOrderFile, { recursive: true, force: true });
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

        function addHooks (hooksXml, doc) {
            const hooks = et.parse(hooksXml);
            for (const el of hooks.getroot().findall('./*')) {
                doc.getroot().append(el);
            }
        }

        describe('application hooks', function () {
            const BASE_HOOKS = `
                <widget xmlns="http://www.w3.org/ns/widgets">
                    <hook type="before_build" src="scripts/appBeforeBuild1.${ext}" />
                    <hook type="before_build" src="scripts/appBeforeBuild02.js" />
                </widget>
            `;
            const WINDOWS_HOOKS = `
                <widget xmlns="http://www.w3.org/ns/widgets">
                    <platform name="windows">
                        <hook type="before_build" src="scripts/windows/appWindowsBeforeBuild.${ext}" />
                        <hook type="before_build" src="scripts/windows/appWindowsBeforeBuild.js" />
                    </platform>
                </widget>
            `;
            const ANDROID_HOOKS = `
                <widget xmlns="http://www.w3.org/ns/widgets">
                    <platform name="android">
                        <hook type="before_build" src="scripts/android/appAndroidBeforeBuild.${ext}" />
                        <hook type="before_build" src="scripts/android/appAndroidBeforeBuild.js" />
                    </platform>
                </widget>
            `;

            function addHooksToConfig (hooksXml) {
                const config = new ConfigParser(path.join(project, 'config.xml'));
                addHooks(hooksXml, config.doc);
                config.write();
            }

            it('Test 006 : should execute hook scripts serially from config.xml', function () {
                addHooksToConfig(BASE_HOOKS);

                return hooksRunner.fire(test_event)
                    .then(checkHooksOrderFile);
            });

            it('Test 007 : should execute hook scripts serially from config.xml including platform scripts', function () {
                addHooksToConfig(BASE_HOOKS);
                addHooksToConfig(WINDOWS_HOOKS);

                return hooksRunner.fire(test_event)
                    .then(checkHooksOrderFile);
            });

            it('Test 008 : should filter hook scripts from config.xml by platform', function () {
                addHooksToConfig(BASE_HOOKS);
                addHooksToConfig(WINDOWS_HOOKS);
                addHooksToConfig(ANDROID_HOOKS);
                const hookOptions = { cordova: { platforms: ['android'] } };

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    checkHooksOrderFile();

                    const baseScriptResults = [8, 9];
                    const androidPlatformScriptsResults = [14, 15];
                    const expectedResults = baseScriptResults.concat(androidPlatformScriptsResults);
                    expect(getActualHooksOrder()).toEqual(expectedResults);
                });
            });

            it('Test 023 : should error if any hook fails', function () {
                const FAIL_HOOK = `
                    <widget xmlns="http://www.w3.org/ns/widgets">
                        <hook type="fail" src="scripts/fail.js" />
                    </widget>
                `;
                addHooksToConfig(FAIL_HOOK);

                return expectAsync(
                    hooksRunner.fire('fail')
                ).toBeRejectedWithError();
            });

            it('Test 024 : should not error if the hook is unrecognized', function () {
                return hooksRunner.fire('CLEAN YOUR SHORTS GODDAMNIT LIKE A BIG BOY!');
            });
        });

        describe('plugin hooks', function () {
            const PLUGIN_BASE_HOOKS = `
                <widget xmlns="http://www.w3.org/ns/widgets">
                    <hook type="before_build" src="scripts/beforeBuild.js" />
                    <hook type="before_build" src="scripts/beforeBuild.${ext}" />
                </widget>
            `;
            const PLUGIN_WINDOWS_HOOKS = `
                <widget xmlns="http://www.w3.org/ns/widgets">
                    <platform name="windows">
                        <hook type="before_build" src="scripts/windows/windowsBeforeBuild.js" />
                    </platform>
                </widget>
            `;
            const PLUGIN_ANDROID_HOOKS = `
                <widget xmlns="http://www.w3.org/ns/widgets">
                    <platform name="android">
                        <hook type="before_build" src="scripts/android/androidBeforeBuild.js" />
                    </platform>
                </widget>
            `;
            const testPlugin = 'com.plugin.withhooks';
            const testPluginFixture = path.join(fixtures, 'plugins', testPlugin);
            let testPluginInstalledPath;

            beforeEach(() => {
                // Add the test plugin to our project
                testPluginInstalledPath = path.join(project, 'plugins', testPlugin);
                fs.cpSync(testPluginFixture, testPluginInstalledPath, { recursive: true });
            });

            function addHooksToPlugin (hooksXml) {
                const config = new PluginInfo(testPluginInstalledPath);
                addHooks(hooksXml, config._et);

                const configPath = path.join(testPluginInstalledPath, 'plugin.xml');
                fs.writeFileSync(configPath, config._et.write({ indent: 4 }));
            }

            it('Test 009 : should execute hook scripts serially from plugin.xml', function () {
                addHooksToPlugin(PLUGIN_BASE_HOOKS);

                return hooksRunner.fire(test_event)
                    .then(checkHooksOrderFile);
            });

            it('Test 010 : should execute hook scripts serially from plugin.xml including platform scripts', function () {
                addHooksToPlugin(PLUGIN_BASE_HOOKS);
                addHooksToPlugin(PLUGIN_WINDOWS_HOOKS);

                return hooksRunner.fire(test_event)
                    .then(checkHooksOrderFile);
            });

            it('Test 011 : should filter hook scripts from plugin.xml by platform', function () {
                addHooksToPlugin(PLUGIN_BASE_HOOKS);
                addHooksToPlugin(PLUGIN_WINDOWS_HOOKS);
                addHooksToPlugin(PLUGIN_ANDROID_HOOKS);
                const hookOptions = { cordova: { platforms: ['android'] } };

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    checkHooksOrderFile();

                    const baseScriptResults = [21, 22];
                    const androidPlatformScriptsResults = [26];
                    const expectedResults = baseScriptResults.concat(androidPlatformScriptsResults);
                    expect(getActualHooksOrder()).toEqual(expectedResults);
                });
            });
        });

        describe('nohooks option', () => {
            it('Test 013 : should not execute the designated hook when --nohooks option specifies the exact hook name', async () => {
                const hookOptions = { nohooks: [test_event] };

                expect(await hooksRunner.fire(test_event, hookOptions))
                    .toBe('hook before_build is disabled.');
            });

            it('Test 014 : should not execute matched hooks when --nohooks option specifies a hook pattern', async () => {
                const hookOptions = { nohooks: ['ba'] };

                for (const e of ['foo', 'bar', 'baz']) {
                    expect(await hooksRunner.fire(e, hookOptions))
                        .toBe(e === 'foo' ? undefined : `hook ${e} is disabled.`);
                }
            });

            it('Test 015 : should not execute any hooks when --nohooks option specifies .', async () => {
                const hookOptions = { nohooks: ['.'] };

                for (const e of ['foo', 'bar', 'baz']) {
                    expect(await hooksRunner.fire(e, hookOptions))
                        .toBe(`hook ${e} is disabled.`);
                }
            });
        });

        describe('module-level hooks (event handlers)', function () {
            let handler;

            beforeEach(() => {
                handler = jasmine.createSpy('testHandler').and.resolveTo();
                cordova.on(test_event, handler);
            });

            afterEach(function () {
                cordova.removeAllListeners(test_event);
            });

            it('Test 016 : should fire handlers that were attached using cordova.on', function () {
                return hooksRunner.fire(test_event).then(function () {
                    expect(handler).toHaveBeenCalled();
                });
            });

            it('Test 017 : should pass the project root folder as parameter into the module-level handlers', function () {
                return hooksRunner.fire(test_event).then(function () {
                    expect(handler).toHaveBeenCalledWith(jasmine.objectContaining({
                        projectRoot: project
                    }));
                });
            });

            it('Test 018 : should be able to stop listening to events using cordova.off', function () {
                cordova.off(test_event, handler);
                return hooksRunner.fire(test_event).then(function () {
                    expect(handler).not.toHaveBeenCalled();
                });
            });

            it('Test 019 : should execute async event listeners serially', function () {
                const order = [];
                // Delay 100 ms here to check that h2 is not executed until after
                // the promise returned by h1 is resolved.
                const h1 = _ => timers.setTimeout(100).then(_ => order.push(1));
                const h2 = _ => Promise.resolve().then(_ => order.push(2));

                cordova.on(test_event, h1);
                cordova.on(test_event, h2);

                return hooksRunner.fire(test_event)
                    .then(_ => expect(order).toEqual([1, 2]));
            });

            it('Test 021 : should pass options passed to fire into handlers', async () => {
                const hookOptions = { test: 'funky' };
                await hooksRunner.fire(test_event, hookOptions);
                expect(handler).toHaveBeenCalledWith(hookOptions);
            });
        });
    });
});
