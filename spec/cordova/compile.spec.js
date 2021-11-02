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
const cordova = require('../../src/cordova/cordova');
const platforms = require('../../src/platforms/platforms');
const HooksRunner = require('../../src/hooks/HooksRunner');
const util = require('../../src/cordova/util');

const supported_platforms = Object.keys(platforms).filter(function (p) { return p !== 'www'; });

describe('compile command', function () {
    let is_cordova;
    let list_platforms;
    let fire;
    let platformApi;
    let getPlatformApi;
    const project_dir = '/some/path';

    beforeEach(function () {
        is_cordova = spyOn(util, 'isCordova').and.returnValue(project_dir);
        spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        list_platforms = spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Promise.resolve());
        platformApi = { build: jasmine.createSpy('build').and.returnValue(Promise.resolve()) };
        getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);
    });
    describe('failure', function () {
        it('Test 001 : should not run inside a Cordova-based project with no added platforms by calling util.listPlatforms', function () {
            list_platforms.and.returnValue([]);
            return expectAsync(
                cordova.compile()
            ).toBeRejectedWithError(
                'No platforms added to this project. Please use `cordova platform add <platform>`.'
            );
        });
        it('Test 002 : should not run outside of a Cordova-based project', function () {
            is_cordova.and.returnValue(false);
            return expectAsync(
                cordova.compile()
            ).toBeRejectedWithError();
        });
    });

    describe('success', function () {
        it('Test 003 : should run inside a Cordova-based project with at least one added platform and shell out to build', function () {
            return cordova.compile(['android', 'ios'])
                .then(function () {
                    expect(getPlatformApi).toHaveBeenCalledWith('android');
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(platformApi.build).toHaveBeenCalled();
                });
        });

        it('Test 004 : should pass down optional parameters', function () {
            return cordova.compile({ platforms: ['blackberry10'], options: { release: true } })
                .then(function () {
                    expect(getPlatformApi).toHaveBeenCalledWith('blackberry10');
                    expect(platformApi.build).toHaveBeenCalledWith({ release: true });
                });
        });
    });

    describe('hooks', function () {
        describe('when platforms are added', function () {
            it('Test 006 : should fire before hooks through the hooker module', function () {
                return cordova.compile(['android', 'ios'])
                    .then(function () {
                        expect(fire.calls.argsFor(0)).toEqual(['before_compile', { verbose: false, platforms: ['android', 'ios'], options: {} }]);
                    });
            });
            it('Test 007 : should fire after hooks through the hooker module', function () {
                return cordova.compile('android')
                    .then(function () {
                        expect(fire.calls.argsFor(1)).toEqual(['after_compile', { verbose: false, platforms: ['android'], options: {} }]);
                    });
            });
        });

        describe('with no platforms added', function () {
            it('Test 008 : should not fire the hooker', async function () {
                list_platforms.and.returnValue([]);

                await expectAsync(
                    cordova.compile()
                ).toBeRejectedWithError(
                    'No platforms added to this project. Please use `cordova platform add <platform>`.'
                );

                expect(fire).not.toHaveBeenCalled();
            });
        });
    });
});
