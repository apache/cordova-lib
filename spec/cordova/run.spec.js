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
var util = require('../../src/cordova/util');

var supported_platforms = Object.keys(platforms).filter(function (p) { return p !== 'www'; });

describe('run command', function () {
    var is_cordova, cd_project_root, list_platforms, fire, platformApi, getPlatformApi;
    var project_dir = '/some/path';
    var prepare_spy;

    beforeEach(function () {
        is_cordova = spyOn(util, 'isCordova').and.returnValue(project_dir);
        cd_project_root = spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        list_platforms = spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Promise.resolve());
        prepare_spy = spyOn(cordova, 'prepare').and.returnValue(Promise.resolve());
        platformApi = {
            run: jasmine.createSpy('run').and.returnValue(Promise.resolve()),
            build: jasmine.createSpy('build').and.returnValue(Promise.resolve())
        };
        getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);
    });
    describe('failure', function () {
        it('Test 001 : should not run inside a Cordova-based project with no added platforms by calling util.listPlatforms', function () {
            list_platforms.and.returnValue([]);
            return Promise.resolve().then(cordova.run)
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toEqual('No platforms added to this project. Please use `cordova platform add <platform>`.');
                });
        });
        it('Test 002 : should not run outside of a Cordova-based project', function () {
            var msg = 'Dummy message about not being in a cordova dir.';
            cd_project_root.and.throwError(new Error(msg));
            is_cordova.and.returnValue(false);
            return Promise.resolve().then(cordova.run)
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toEqual(msg);
                });
        });
    });

    describe('success', function () {
        it('Test 003 : should call prepare before actually run platform ', function () {
            return cordova.run(['android', 'ios']).then(function () {
                expect(prepare_spy.calls.argsFor(0)).toEqual([ { platforms: [ 'android', 'ios' ], verbose: false, options: {} } ]);
            });
        });
        it('Test 004 : should get PlatformApi instance for each platform and call its\' run method', function () {
            return cordova.run(['android', 'ios']).then(function () {
                expect(getPlatformApi).toHaveBeenCalledWith('android');
                expect(getPlatformApi).toHaveBeenCalledWith('ios');
                expect(platformApi.build).toHaveBeenCalled();
                expect(platformApi.run).toHaveBeenCalled();
            });
        });
        it('Test 005 : should pass down parameters', function () {
            return cordova.run({platforms: ['blackberry10'], options: {password: '1q1q'}}).then(function () {
                expect(prepare_spy).toHaveBeenCalledWith({ platforms: [ 'blackberry10' ], options: { password: '1q1q' }, verbose: false });
                expect(platformApi.build).toHaveBeenCalledWith({password: '1q1q'});
                expect(platformApi.run).toHaveBeenCalledWith({password: '1q1q', nobuild: true});
            });
        });

        it('Test 007 : should call platform\'s build method', function () {
            return cordova.run({platforms: ['blackberry10']})
                .then(function () {
                    expect(prepare_spy).toHaveBeenCalled();
                    expect(platformApi.build).toHaveBeenCalledWith({});
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({nobuild: true}));
                });
        });

        it('Test 008 : should not call build if --nobuild option is passed', function () {
            return cordova.run({platforms: ['blackberry10'], options: { nobuild: true }})
                .then(function () {
                    expect(prepare_spy).toHaveBeenCalled();
                    expect(platformApi.build).not.toHaveBeenCalled();
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({nobuild: true}));
                });
        });

        describe('run parameters should not be altered by intermediate build command', function () {
            var originalBuildSpy;
            beforeEach(function () {
                originalBuildSpy = platformApi.build;
                platformApi.build = jasmine.createSpy('build').and.callFake(function (opts) {
                    opts.couldBeModified = 'insideBuild';
                    return Promise.resolve();
                });
            });
            afterEach(function () {
                platformApi.build = originalBuildSpy;
            });
            it('Test 009 : should leave parameters unchanged', function () {
                return cordova.run({platforms: ['blackberry10'], options: {password: '1q1q'}}).then(function () {
                    expect(prepare_spy).toHaveBeenCalledWith({ platforms: [ 'blackberry10' ], options: { password: '1q1q', 'couldBeModified': 'insideBuild' }, verbose: false });
                    expect(platformApi.build).toHaveBeenCalledWith({password: '1q1q', 'couldBeModified': 'insideBuild'});
                    expect(platformApi.run).toHaveBeenCalledWith({password: '1q1q', nobuild: true});
                });
            });
        });
    });

    describe('hooks', function () {
        describe('when platforms are added', function () {
            it('Test 010 : should fire before hooks through the hooker module', function () {
                return cordova.run(['android', 'ios']).then(function () {
                    expect(fire.calls.argsFor(0)).toEqual([ 'before_run', { platforms: [ 'android', 'ios' ], verbose: false, options: {} } ]);
                });
            });
            it('Test 011 : should fire after hooks through the hooker module', function () {
                return cordova.run('android').then(function () {
                    expect(fire.calls.argsFor(2)).toEqual([ 'after_run', { platforms: [ 'android' ], verbose: false, options: {} } ]);
                });
            });
        });

        describe('with no platforms added', function () {
            it('Test 012 : should not fire the hooker', function () {
                list_platforms.and.returnValue([]);
                return Promise.resolve().then(cordova.run)
                    .then(function () {
                        fail('Expected promise to be rejected');
                    }, function (err) {
                        expect(err).toEqual(jasmine.any(Error));
                        expect(fire).not.toHaveBeenCalled();
                        expect(err.message).toEqual('No platforms added to this project. Please use `cordova platform add <platform>`.');
                    });
            });
        });
    });
});
