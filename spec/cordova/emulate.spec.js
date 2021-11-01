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
const rewire = require('rewire');
const platforms = require('../../src/platforms/platforms');
const HooksRunner = require('../../src/hooks/HooksRunner');
const util = require('../../src/cordova/util');

const supported_platforms = Object.keys(platforms);

describe('emulate command', function () {
    const project_dir = '/some/path';
    let cordovaEmulate, cordovaPrepare, platformApi, getPlatformApi;

    beforeEach(function () {
        spyOn(util, 'isCordova').and.returnValue(project_dir);
        spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        spyOn(HooksRunner.prototype, 'fire').and.returnValue(Promise.resolve());

        cordovaEmulate = rewire('../../src/cordova/emulate');
        cordovaPrepare = jasmine.createSpy('cordovaPrepare').and.returnValue(Promise.resolve());
        cordovaEmulate.__set__({ cordovaPrepare });

        platformApi = {
            run: jasmine.createSpy('run').and.returnValue(Promise.resolve()),
            build: jasmine.createSpy('build').and.returnValue(Promise.resolve())
        };
        getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);
    });
    describe('failure', function () {
        it('Test 001 : should not run inside a Cordova-based project with no added platforms by calling util.listPlatforms', function () {
            util.listPlatforms.and.returnValue([]);
            return expectAsync(
                cordovaEmulate()
            ).toBeRejectedWithError(
                'No platforms added to this project. Please use `cordova platform add <platform>`.'
            );
        });
        it('Test 002 : should not run outside of a Cordova-based project', function () {
            util.isCordova.and.returnValue(false);
            return expectAsync(
                cordovaEmulate()
            ).toBeRejectedWithError();
        });
    });

    describe('success', function () {
        it('Test 003 : should run inside a Cordova-based project with at least one added platform and call prepare and shell out to the emulate script', function () {
            return cordovaEmulate(['android', 'ios'])
                .then(function () {
                    expect(cordovaPrepare).toHaveBeenCalledWith(jasmine.objectContaining({ platforms: ['android', 'ios'] }));
                    expect(getPlatformApi).toHaveBeenCalledWith('android');
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(platformApi.build).toHaveBeenCalled();
                    expect(platformApi.run).toHaveBeenCalled();
                });
        });
        it('Test 004 : should pass down options', function () {
            return cordovaEmulate({ platforms: ['ios'], options: { optionTastic: true } })
                .then(function () {
                    expect(cordovaPrepare).toHaveBeenCalledWith(jasmine.objectContaining({ platforms: ['ios'] }));
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(platformApi.build).toHaveBeenCalledWith({ device: false, emulator: true, optionTastic: true });
                    expect(platformApi.run).toHaveBeenCalledWith({ device: false, emulator: true, optionTastic: true, nobuild: true });
                });
        });

        describe('run parameters should not be altered by intermediate build command', function () {
            beforeEach(function () {
                platformApi.build.and.callFake(opts => {
                    opts.couldBeModified = 'insideBuild';
                    return Promise.resolve();
                });
            });
            it('Test 006 : should leave parameters unchanged', function () {
                const baseOptions = { password: '1q1q', device: false, emulator: true };
                const expectedRunOptions = Object.assign({ nobuild: true }, baseOptions);
                const expectedBuildOptions = Object.assign({ couldBeModified: 'insideBuild' }, baseOptions);
                return cordovaEmulate({ platforms: ['blackberry10'], options: { password: '1q1q' } })
                    .then(function () {
                        expect(cordovaPrepare).toHaveBeenCalledWith({ platforms: ['blackberry10'], options: expectedBuildOptions, verbose: false });
                        expect(platformApi.build).toHaveBeenCalledWith(expectedBuildOptions);
                        expect(platformApi.run).toHaveBeenCalledWith(expectedRunOptions);
                    });
            });
        });

        it('Test 007 : should call platform\'s build method', function () {
            return cordovaEmulate({ platforms: ['blackberry10'] })
                .then(function () {
                    expect(cordovaPrepare).toHaveBeenCalled();
                    expect(platformApi.build).toHaveBeenCalledWith({ device: false, emulator: true });
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({ nobuild: true }));
                });
        });

        it('Test 008 : should not call build if --nobuild option is passed', function () {
            return cordovaEmulate({ platforms: ['blackberry10'], options: { nobuild: true } })
                .then(function () {
                    expect(cordovaPrepare).toHaveBeenCalled();
                    expect(platformApi.build).not.toHaveBeenCalled();
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({ nobuild: true }));
                });
        });
    });

    describe('hooks', function () {
        describe('when platforms are added', function () {
            it('Test 009 : should fire before hooks through the hooker module', function () {
                return cordovaEmulate(['android', 'ios'])
                    .then(function () {
                        expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('before_emulate',
                            jasmine.objectContaining({ verbose: false, platforms: ['android', 'ios'], options: jasmine.any(Object) }));
                    });
            });
            it('Test 010 : should fire after hooks through the hooker module', function () {
                return cordovaEmulate('android')
                    .then(function () {
                        expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('after_emulate',
                            jasmine.objectContaining({ verbose: false, platforms: ['android'], options: jasmine.any(Object) }));
                    });
            });
        });

        describe('with no platforms added', function () {
            it('Test 011 : should not fire the hooker', async function () {
                util.listPlatforms.and.returnValue([]);

                await expectAsync(
                    cordovaEmulate()
                ).toBeRejectedWithError(
                    'No platforms added to this project. Please use `cordova platform add <platform>`.'
                );

                expect(HooksRunner.prototype.fire).not.toHaveBeenCalled();
            });
        });
    });
});
