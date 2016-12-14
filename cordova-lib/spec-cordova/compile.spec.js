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
    util = require('../src/cordova/util'),
    Q = require('q');

var supported_platforms = Object.keys(platforms).filter(function(p) { return p != 'www'; });


describe('compile command', function() {
    var is_cordova, list_platforms, fire, cd_project_root, fail, platformApi, getPlatformApi;
    var project_dir = '/some/path';

    beforeEach(function() {
        is_cordova = spyOn(util, 'isCordova').and.returnValue(project_dir);
        cd_project_root = spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        list_platforms= spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
        platformApi = { build: jasmine.createSpy('build').and.returnValue(Q())};
        getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);
        fail = function (err) { expect(err.stack).not.toBeDefined(); };
    });
    describe('failure', function() {
        it('should not run inside a Cordova-based project with no added platforms by calling util.listPlatforms', function(done) {
            list_platforms.and.returnValue([]);
            var success = jasmine.createSpy('success');
            cordova.raw.compile()
            .then(success, function(result) {
                expect(result instanceof Error).toBe(true);
                expect('' + result).toContain('No platforms added to this project. Please use `cordova platform add <platform>`.');
            })
            .fin(function() {
                expect(success).not.toHaveBeenCalled();
                done();
            });
        });
        it('should not run outside of a Cordova-based project', function(done) {
            is_cordova.and.returnValue(false);
            var success = jasmine.createSpy('success');
            cordova.raw.compile()
            .then(success, function(result) {
                expect(result instanceof Error).toBe(true);
            })
            .fin(function() {
                expect(success).not.toHaveBeenCalled();
                done();
            });
        });
    });

    describe('success', function() {
        it('should run inside a Cordova-based project with at least one added platform and shell out to build', function(done) {
            cordova.raw.compile(['android','ios']).then(function() {
                expect(getPlatformApi).toHaveBeenCalledWith('android');
                expect(getPlatformApi).toHaveBeenCalledWith('ios');
                expect(platformApi.build).toHaveBeenCalled();
            })
            .fail(fail)
            .fin(done);
        });

        it('should pass down optional parameters', function (done) {
            cordova.raw.compile({platforms:['blackberry10'], options:{release: true}}).then(function () {
                expect(getPlatformApi).toHaveBeenCalledWith('blackberry10');
                expect(platformApi.build).toHaveBeenCalledWith({release: true});
            })
            .fail(fail)
            .fin(done);
        });

        it('should convert options from old format and warn user about this', function (done) {
            function warnSpy(message) {
                expect(message).toMatch('The format of cordova.raw.* methods "options" argument was changed');
            }

            cordova.on('warn', warnSpy);
            cordova.raw.compile({platforms:['blackberry10'], options:['--release']}).then(function () {
                expect(getPlatformApi).toHaveBeenCalledWith('blackberry10');
                expect(platformApi.build).toHaveBeenCalledWith({release: true, argv: []});
            })
            .fail(fail)
            .fin(function () {
                cordova.off('warn', warnSpy);
                done();
            });
        });
    });

    describe('hooks', function() {
        describe('when platforms are added', function() {
            it('should fire before hooks through the hooker module', function(done) {
                cordova.raw.compile(['android', 'ios']).then(function() {
                    expect(fire).toHaveBeenCalledWith('before_compile', {verbose: false, platforms:['android', 'ios'], options: []});
                    done();
                })
                .fail(fail)
                .fin(done);
            });
            it('should fire after hooks through the hooker module', function(done) {
                cordova.raw.compile('android').then(function() {
                     expect(fire).toHaveBeenCalledWith('after_compile', {verbose: false, platforms:['android'], options: []});
                     done();
                })
                .fail(fail)
                .fin(done);
            });
        });

        describe('with no platforms added', function() {
            it('should not fire the hooker', function(done) {
                list_platforms.and.returnValue([]);
                Q().then(cordova.raw.compile).then(function() {
                    expect('this call').toBe('fail');
                }, function(err) {
                    expect(fire).not.toHaveBeenCalled();
                    expect(err.message).toContain(
                        'No platforms added to this project. Please use `cordova platform add <platform>`.'
                    );
                }).fin(done);
            });
        });
    });
});
