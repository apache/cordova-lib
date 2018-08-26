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
var cordova = require('../../src/cordova/cordova');
var platforms = require('../../src/platforms/platforms');
var HooksRunner = require('../../src/hooks/HooksRunner');
var Q = require('q');
var util = require('../../src/cordova/util');

var supported_platforms = Object.keys(platforms).filter(function (p) { return p !== 'www'; });

describe('emulate command', function () {
    var is_cordova;
    var cd_project_root; // eslint-disable-line no-unused-vars
    var list_platforms;
    var fire;
    var project_dir = '/some/path';
    var prepare_spy, platformApi, getPlatformApi;

    beforeEach(function () {
        is_cordova = spyOn(util, 'isCordova').and.returnValue(project_dir);
        cd_project_root = spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        list_platforms = spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
        prepare_spy = spyOn(cordova, 'prepare').and.returnValue(Q());
        platformApi = {
            run: jasmine.createSpy('run').and.returnValue(Q()),
            build: jasmine.createSpy('build').and.returnValue(Q())
        };

        getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);
    });
    describe('failure', function () {
        it('Test 001 : should not run inside a Cordova-based project with no added platforms by calling util.listPlatforms', function () {
            list_platforms.and.returnValue([]);
            return cordova.compile()
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toContain('No platforms added to this project. Please use `cordova platform add <platform>`.');
                });
        });
        it('Test 002 : should not run outside of a Cordova-based project', function () {
            is_cordova.and.returnValue(false);
            return cordova.compile()
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                });
        });
    });

    describe('success', function () {
        it('Test 003 : should run inside a Cordova-based project with at least one added platform and call prepare and shell out to the emulate script', function () {
            return cordova.emulate(['android', 'ios'])
                .then(function (err) { // eslint-disable-line handle-callback-err
                    expect(prepare_spy).toHaveBeenCalledWith(jasmine.objectContaining({platforms: ['android', 'ios']}));
                    expect(getPlatformApi).toHaveBeenCalledWith('android');
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(platformApi.build).toHaveBeenCalled();
                    expect(platformApi.run).toHaveBeenCalled();
                });
        });
        it('Test 004 : should pass down options', function () {
            return cordova.emulate({platforms: ['ios'], options: { optionTastic: true }})
                .then(function (err) { // eslint-disable-line handle-callback-err
                    expect(prepare_spy).toHaveBeenCalledWith(jasmine.objectContaining({platforms: ['ios']}));
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(platformApi.build).toHaveBeenCalledWith({ device: false, emulator: true, optionTastic: true });
                    expect(platformApi.run).toHaveBeenCalledWith({ device: false, emulator: true, optionTastic: true, nobuild: true });
                });
        });
        it('Test 005 : should convert options from old format', function () {
            return cordova.emulate({platforms: ['ios'], options: ['--optionTastic']})
                .then(function () {
                    expect(prepare_spy).toHaveBeenCalledWith(jasmine.objectContaining({platforms: ['ios']}));
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({emulator: true, argv: ['--optionTastic']}));
                });
        });
        describe('run parameters should not be altered by intermediate build command', function () {
            var originalBuildSpy;
            beforeEach(function () {
                originalBuildSpy = platformApi.build;
                platformApi.build = jasmine.createSpy('build').and.callFake(function (opts) {
                    opts.couldBeModified = 'insideBuild';
                    return Q();
                });
            });
            afterEach(function () {
                platformApi.build = originalBuildSpy;
            });
            it('Test 006 : should leave parameters unchanged', function () {
                return cordova.run({platforms: ['blackberry10'], options: {password: '1q1q'}})
                    .then(function () {
                        expect(prepare_spy).toHaveBeenCalledWith({ platforms: [ 'blackberry10' ], options: { password: '1q1q', 'couldBeModified': 'insideBuild' }, verbose: false });
                        expect(platformApi.build).toHaveBeenCalledWith({password: '1q1q', 'couldBeModified': 'insideBuild'});
                        expect(platformApi.run).toHaveBeenCalledWith({password: '1q1q', nobuild: true});
                    });
            });
        });

        it('Test 007 : should call platform\'s build method', function () {
            return cordova.emulate({platforms: ['blackberry10']})
                .then(function () {
                    expect(prepare_spy).toHaveBeenCalled();
                    expect(platformApi.build).toHaveBeenCalledWith({device: false, emulator: true});
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({nobuild: true}));
                });
        });

        it('Test 008 : should not call build if --nobuild option is passed', function () {
            return cordova.emulate({platforms: ['blackberry10'], options: { nobuild: true }})
                .then(function () {
                    expect(prepare_spy).toHaveBeenCalled();
                    expect(platformApi.build).not.toHaveBeenCalled();
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({nobuild: true}));
                });
        });
    });

    describe('hooks', function () {
        describe('when platforms are added', function () {
            it('Test 009 : should fire before hooks through the hooker module', function () {
                return cordova.emulate(['android', 'ios'])
                    .then(function () {
                        expect(fire).toHaveBeenCalledWith('before_emulate',
                            jasmine.objectContaining({verbose: false, platforms: ['android', 'ios'], options: jasmine.any(Object)}));
                    });
            });
            it('Test 010 : should fire after hooks through the hooker module', function () {
                return cordova.emulate('android')
                    .then(function () {
                        expect(fire).toHaveBeenCalledWith('after_emulate',
                            jasmine.objectContaining({verbose: false, platforms: ['android'], options: jasmine.any(Object)}));
                    });
            });
        });

        describe('with no platforms added', function () {
            it('Test 011 : should not fire the hooker', function () {
                list_platforms.and.returnValue([]);
                return Q().then(cordova.emulate).then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toContain('No platforms added to this project. Please use `cordova platform add <platform>`.');
                    expect(fire).not.toHaveBeenCalled();
                });
            });
        });
    });
});
