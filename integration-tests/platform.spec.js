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

const { tmpDir: getTmpDir, testPlatform, setDefaultTimeout } = require('../spec/helpers');
const { listPlatforms } = require('../src/cordova/util');
const cordova = require('../src/cordova/cordova');
const plugman = require('../src/plugman/plugman');

const fixturesDir = path.join(__dirname, '..', 'spec', 'cordova', 'fixtures');
const pluginFixturesDir = path.join(fixturesDir, 'plugins');

describe('cordova/platform end-to-end', () => {
    const TIMEOUT = 240 * 1000;
    setDefaultTimeout(TIMEOUT);

    let tmpDir, project, pluginsDir, platformsDir, nodeModulesDir, testPlatformDir;

    beforeEach(() => {
        tmpDir = getTmpDir('cordova-platform-e2e-test');
        project = path.join(tmpDir, 'project');
        pluginsDir = path.join(project, 'plugins');
        platformsDir = path.join(project, 'platforms');
        nodeModulesDir = path.join(project, 'node_modules');
        testPlatformDir = path.join(platformsDir, testPlatform);

        fs.copySync(path.join(fixturesDir, 'basePkgJson'), project);
        process.chdir(project);
    });

    afterEach(() => {
        process.chdir(__dirname); // Needed to rm the dir on Windows.
        fs.removeSync(tmpDir);
    });

    function installedPlatforms () {
        return listPlatforms(project);
    }

    it('Test 001 : should successfully run', () => {
        // Check there are no platforms yet.
        expect(installedPlatforms()).toEqual([]);

        return Promise.resolve()
            .then(() => {
                // Add the testing platform.
                return cordova.platform('add', [testPlatform]);
            })
            .then(() => {
                // Check the platform add was successful.
                expect(testPlatformDir).toExist();
                expect(path.join(testPlatformDir, 'cordova')).toExist();
                expect(installedPlatforms()).toEqual([testPlatform]);
            })
            .then(() => {
                // Spy on Api.updatePlatform since it always rejects otherwise
                const Api = require(path.join(nodeModulesDir, 'cordova-android'));
                spyOn(Api, 'updatePlatform').and.returnValue(Promise.resolve());
                spyOn(require('../src/cordova/util'), 'getPlatformApiFunction').and.returnValue(Api);

                return cordova.platform('update', [testPlatform]).then(_ => Api);
            })
            .then(Api => {
                expect(Api.updatePlatform).toHaveBeenCalled();
                // Platform should still be in platform ls.
                expect(installedPlatforms()).toEqual([testPlatform]);
            })
            .then(() => {
                // And now remove it.
                return cordova.platform('rm', [testPlatform]);
            })
            .then(() => {
                // It should be gone.
                expect(testPlatformDir).not.toExist();
                expect(installedPlatforms()).toEqual([]);
            });

    });

    it('Test 002 : should install plugins correctly while adding platform', () => {
        spyOn(plugman, 'install').and.callThrough();
        const prepare = require('../src/cordova/prepare');
        const prepareSpy = jasmine.createSpy('prepare', prepare).and.callThrough();
        Object.assign(prepareSpy, prepare);

        // This is all just to get the prepareSpy to be used by `platform.add`
        const platform = rewire('../src/cordova/platform');
        const addHelper = rewire('../src/cordova/platform/addHelper');
        const requireFake = jasmine.createSpy('require', addHelper.__get__('require')).and.callThrough();
        requireFake.withArgs('../prepare').and.returnValue(prepareSpy);
        addHelper.__set__({ require: requireFake });
        platform.__set__({ addHelper });

        return Promise.resolve()
            .then(() => {
                return cordova.plugin('add', path.join(pluginFixturesDir, 'test'));
            })
            .then(() => {
                return platform('add', [testPlatform]);
            })
            .then(() => {
                // Check the platform add was successful.
                expect(testPlatformDir).toExist();
                // Check that plugin files exists in www dir
                expect(path.join(testPlatformDir, 'platform_www/test.js')).toExist();
                // should call prepare after plugins were installed into platform
                expect(plugman.install).toHaveBeenCalledBefore(prepareSpy);
            });
    });

    it('Test 007 : should add and remove platform from node_modules directory', () => {
        return Promise.resolve()
            .then(() => {
                return cordova.platform('add', 'browser', { 'save': true });
            })
            .then(() => {
                expect(path.join(nodeModulesDir, 'cordova-browser')).toExist();
                expect(path.join(platformsDir, 'browser')).toExist();
                return cordova.platform('add', 'android');
            })
            .then(() => {
                expect(path.join(nodeModulesDir, 'cordova-browser')).toExist();
                expect(path.join(platformsDir, 'android')).toExist();
                return cordova.platform('rm', 'browser');
            })
            .then(() => {
                expect(path.join(nodeModulesDir, 'cordova-browser')).not.toExist();
                expect(path.join(platformsDir, 'browser')).not.toExist();
                return cordova.platform('rm', 'android');
            })
            .then(() => {
                expect(path.join(nodeModulesDir, 'cordova-android')).not.toExist();
                expect(path.join(platformsDir, 'android')).not.toExist();
            });
    });

    it('Test 008 : should remove dependency when removing parent plugin', () => {
        return Promise.resolve()
            .then(() => {
                return cordova.platform('add', testPlatform);
            })
            .then(() => {
                return cordova.plugin('add', 'cordova-plugin-media', { save: true });
            })
            .then(() => {
                expect(path.join(pluginsDir, 'cordova-plugin-media')).toExist();
                expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
                expect(path.join(nodeModulesDir, 'cordova-plugin-media')).toExist();
                expect(path.join(nodeModulesDir, 'cordova-plugin-file')).toExist();
                return cordova.plugin('rm', 'cordova-plugin-media', { save: true });
            })
            .then(() => {
                expect(path.join(pluginsDir, 'cordova-plugin-media')).not.toExist();
                expect(path.join(pluginsDir, 'cordova-plugin-file')).not.toExist();
                expect(path.join(nodeModulesDir, 'cordova-plugin-media')).not.toExist();
                expect(path.join(nodeModulesDir, 'cordova-plugin-file')).not.toExist();
            });
    });

    it('Test 009 : should add and remove 3rd party platforms', () => {
        return Promise.resolve()
            .then(() => {
                // add cordova-android instead of android
                return cordova.platform('add', 'cordova-android');
            })
            .then(() => {
                // 3rd party platform from npm
                return cordova.platform('add', 'cordova-platform-test');
            })
            .then(() => {
                expect(path.join(platformsDir, 'android')).toExist();
                expect(path.join(platformsDir, 'cordova-platform-test')).toExist();
                expect(installedPlatforms()).toEqual(jasmine.arrayWithExactContents([
                    'android', 'cordova-platform-test'
                ]));
            });
    });
});
