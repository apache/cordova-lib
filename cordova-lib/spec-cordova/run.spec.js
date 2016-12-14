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
var cordova = require('../src/cordova/cordova'),
    platforms = require('../src/platforms/platforms'),
    HooksRunner = require('../src/hooks/HooksRunner'),
    Q = require('q'),
    util = require('../src/cordova/util');

var supported_platforms = Object.keys(platforms).filter(function(p) { return p != 'www'; });

describe('run command', function() {
    var is_cordova, cd_project_root, list_platforms, fire, platformApi, getPlatformApi;
    var project_dir = '/some/path';
    var prepare_spy;

    beforeEach(function() {
        is_cordova = spyOn(util, 'isCordova').and.returnValue(project_dir);
        cd_project_root = spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        list_platforms = spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
        prepare_spy = spyOn(cordova.raw, 'prepare').and.returnValue(Q());
        platformApi = {
            run: jasmine.createSpy('run').and.returnValue(Q()),
            build: jasmine.createSpy('build').and.returnValue(Q())
        };
        getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);
    });
    describe('failure', function() {
        it('should not run inside a Cordova-based project with no added platforms by calling util.listPlatforms', function(done) {
            list_platforms.and.returnValue([]);
            Q().then(cordova.raw.run).then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(err.message).toEqual('No platforms added to this project. Please use `cordova platform add <platform>`.');
            }).fin(done);
        });
        it('should not run outside of a Cordova-based project', function(done) {
            var msg = 'Dummy message about not being in a cordova dir.';
            cd_project_root.and.throwError(new Error(msg));
            is_cordova.and.returnValue(false);
            Q().then(cordova.raw.run).then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(err.message).toEqual(msg);
            }).fin(done);
        });
    });

    describe('success', function() {
        it('should call prepare before actually run platform ', function(done) {
            cordova.raw.run(['android','ios']).then(function() {
                expect(prepare_spy).toHaveBeenCalledWith({ platforms: [ 'android', 'ios' ], verbose: false, options: [] });
            }, function(err) {
                expect(err).toBeUndefined();
            }).fin(done);
        });
        it('should get PlatformApi instance for each platform and call its\' run method', function(done) {
            cordova.raw.run(['android','ios']).then(function() {
                expect(getPlatformApi).toHaveBeenCalledWith('android');
                expect(getPlatformApi).toHaveBeenCalledWith('ios');
                expect(platformApi.build).toHaveBeenCalled();
                expect(platformApi.run).toHaveBeenCalled();
            }, function(err) {
                expect(err).toBeUndefined();
            }).fin(done);
        });
        it('should pass down parameters', function(done) {
            cordova.raw.run({platforms: ['blackberry10'], options:{password: '1q1q'}}).then(function() {
                expect(prepare_spy).toHaveBeenCalledWith({ platforms: [ 'blackberry10' ], options: { password: '1q1q' }, verbose: false });
                expect(platformApi.build).toHaveBeenCalledWith({password: '1q1q'});
                expect(platformApi.run).toHaveBeenCalledWith({password: '1q1q', nobuild: true});
            }, function(err) {
                expect(err).toBeUndefined();
            }).fin(done);
        });
        it('should convert parameters from old format and warn user about this', function (done) {
            function warnSpy(message) {
                expect(message).toMatch('The format of cordova.raw.* methods "options" argument was changed');
            }

            cordova.on('warn', warnSpy);
            cordova.raw.run({platforms: ['blackberry10'], options:['--password=1q1q']}).then(function() {
                expect(prepare_spy).toHaveBeenCalledWith({ platforms: [ 'blackberry10' ],
                    options: jasmine.objectContaining({argv:['--password=1q1q']}), verbose: false });
                expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({argv:['--password=1q1q']}));
            }, function(err) {
                expect(err).toBeUndefined();
            })
            .fin(function () {
                cordova.off('warn', warnSpy);
                done();
            });
        });

        it('should call platform\'s build method', function (done) {
            cordova.raw.run({platforms: ['blackberry10']})
            .then(function() {
                expect(prepare_spy).toHaveBeenCalled();
                expect(platformApi.build).toHaveBeenCalledWith({});
                expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({nobuild: true}));
            }, function(err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
        });

        it('should not call build if --nobuild option is passed', function (done) {
            cordova.raw.run({platforms: ['blackberry10'], options: { nobuild: true }})
            .then(function() {
                expect(prepare_spy).toHaveBeenCalled();
                expect(platformApi.build).not.toHaveBeenCalled();
                expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({nobuild: true}));
            }, function(err) {
                expect(err).toBeUndefined();
            })
            .fin(done);
        });

        describe('run parameters should not be altered by intermediate build command', function() {
            var originalBuildSpy;
            beforeEach(function() {
                originalBuildSpy = platformApi.build;
                platformApi.build = jasmine.createSpy('build').and.callFake(function(opts) {
                    opts.couldBeModified = 'insideBuild';
                    return Q();
                });
            });
            afterEach(function() {
                platformApi.build = originalBuildSpy;
            });
            it('should leave parameters unchanged', function(done) {
                cordova.raw.run({platforms: ['blackberry10'], options:{password: '1q1q'}}).then(function() {
                    expect(prepare_spy).toHaveBeenCalledWith({ platforms: [ 'blackberry10' ], options: { password: '1q1q', 'couldBeModified': 'insideBuild' }, verbose: false });
                    expect(platformApi.build).toHaveBeenCalledWith({password: '1q1q', 'couldBeModified': 'insideBuild'});
                    expect(platformApi.run).toHaveBeenCalledWith({password: '1q1q', nobuild: true});
                }, function(err) {
                    expect(err).toBeUndefined();
                }).fin(done);
            });
        });
    });

    describe('hooks', function() {
        describe('when platforms are added', function() {
            it('should fire before hooks through the hooker module', function(done) {
                cordova.raw.run(['android', 'ios']).then(function() {
                    expect(fire).toHaveBeenCalledWith('before_run', {verbose: false, platforms:['android', 'ios'], options: []});
                }, function(err) {
                    expect(err).toBeUndefined();
                }).fin(done);
            });
            it('should fire after hooks through the hooker module', function(done) {
                cordova.raw.run('android').then(function() {
                     expect(fire).toHaveBeenCalledWith('after_run', {verbose: false, platforms:['android'], options: []});
                }, function(err) {
                    expect(err).toBeUndefined();
                }).fin(done);
            });
        });

        describe('with no platforms added', function() {
            it('should not fire the hooker', function(done) {
                list_platforms.and.returnValue([]);
                Q().then(cordova.raw.run).then(function() {
                    expect('this call').toBe('fail');
                }, function(err) {
                    expect(fire).not.toHaveBeenCalled();
                    expect(err.message).toEqual('No platforms added to this project. Please use `cordova platform add <platform>`.');
                }).fin(done);
            });
        });
    });
});
