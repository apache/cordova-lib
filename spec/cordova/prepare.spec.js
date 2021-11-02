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
const rewire = require('rewire');
const util = require('../../src/cordova/util');
const prepare = rewire('../../src/cordova/prepare');
const restore = require('../../src/cordova/restore-util');
const platforms = require('../../src/platforms/platforms');
const HooksRunner = require('../../src/hooks/HooksRunner');
const PlatformJson = require('cordova-common').PlatformJson;

const project_dir = '/some/path';

describe('cordova/prepare', function () {
    let platform_api_prepare_mock;
    let platform_api_add_mock;
    let platform_api_remove_mock;
    beforeEach(function () {
        platform_api_prepare_mock = jasmine.createSpy('prepare').and.returnValue(Promise.resolve());
        platform_api_add_mock = jasmine.createSpy('add').and.returnValue(Promise.resolve());
        platform_api_remove_mock = jasmine.createSpy('remove').and.returnValue(Promise.resolve());
        spyOn(platforms, 'getPlatformApi').and.callFake(function (platform, rootDir) {
            return {
                prepare: platform_api_prepare_mock,
                getPlatformInfo: jasmine.createSpy('getPlatformInfo').and.returnValue({
                    locations: {
                        www: path.join(project_dir, 'platforms', platform, 'www')
                    }
                }),
                removePlugin: platform_api_add_mock,
                addPlugin: platform_api_remove_mock
            };
        });
        spyOn(PlatformJson, 'load');
        spyOn(HooksRunner.prototype, 'fire').and.returnValue(Promise.resolve());
        spyOn(util, 'isCordova').and.returnValue(true);
    });

    describe('main method', function () {
        beforeEach(function () {
            spyOn(restore, 'installPlatformsFromConfigXML').and.returnValue(Promise.resolve());
            spyOn(restore, 'installPluginsFromConfigXML').and.returnValue(Promise.resolve());
            spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
            spyOn(util, 'preProcessOptions').and.callFake(function (options) {
                const platforms = options.platforms || [];
                return { platforms: platforms };
            });
            spyOn(prepare, 'preparePlatforms').and.returnValue(Promise.resolve());
        });
        describe('failure', function () {
            it('should invoke util.preProcessOptions as preflight task checker, which, if fails, should trigger promise rejection and only fire the before_prepare hook', async function () {
                util.preProcessOptions.and.callFake(function () {
                    throw new Error('preProcessOption error');
                });

                await expectAsync(
                    prepare({})
                ).toBeRejectedWithError('preProcessOption error');

                expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('before_prepare', jasmine.any(Object));
            });
            it('should invoke util.cdProjectRoot as a preflight task checker, which, if fails, should trigger a promise rejection and fire no hooks', async function () {
                util.cdProjectRoot.and.callFake(function () {
                    throw new Error('cdProjectRoot error');
                });

                await expectAsync(
                    prepare({})
                ).toBeRejectedWithError('cdProjectRoot error');

                expect(HooksRunner.prototype.fire).not.toHaveBeenCalled();
            });
        });

        describe('success', function () {
            it('should fire the before_prepare hook and provide platform and path information as arguments', function () {
                return prepare({}).then(function () {
                    expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('before_prepare', jasmine.any(Object));
                });
            });
            it('should invoke restore module\'s installPlatformsFromConfigXML method', function () {
                return prepare({}).then(function () {
                    expect(restore.installPlatformsFromConfigXML).toHaveBeenCalled();
                });
            });
            it('should retrieve PlatformApi instances for each platform provided', function () {
                return prepare({ platforms: ['android', 'ios'] }).then(function () {
                    expect(platforms.getPlatformApi).toHaveBeenCalledTimes(4);
                    // expect(platforms.getPlatformApi).toHaveBeenCalledWith(['android', path.join('some','path','platforms','android')], ['ios', path.join('some','path','platforms','ios')], ['android'], ['ios']);
                    expect(platforms.getPlatformApi).toHaveBeenCalledWith('android', path.join('/', 'some', 'path', 'platforms', 'android'));
                    expect(platforms.getPlatformApi).toHaveBeenCalledWith('ios', path.join('/', 'some', 'path', 'platforms', 'ios'));
                    expect(platforms.getPlatformApi).toHaveBeenCalledWith('android');
                    expect(platforms.getPlatformApi).toHaveBeenCalledWith('ios');
                });
            });
            it('should invoke restore module\'s installPluginsFromConfigXML method', function () {
                return prepare({ platforms: [] }).then(function () {
                    expect(restore.installPluginsFromConfigXML).toHaveBeenCalled();
                });
            });
            it('should invoke preparePlatforms method, providing the appropriate platforms', function () {
                return prepare({ platforms: ['android'] }).then(function () {
                    expect(prepare.preparePlatforms).toHaveBeenCalledWith(['android'], '/some/path', jasmine.any(Object));
                });
            });
            it('should fire the after_prepare hook and provide platform and path information as arguments', function () {
                return prepare({ platforms: ['android'] }).then(function () {
                    expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('after_prepare', jasmine.any(Object));
                });
            });
        });
    });
});
