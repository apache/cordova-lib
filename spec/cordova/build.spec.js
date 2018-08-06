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

var supported_platforms = Object.keys(platforms);

describe('build command', function () {
    var is_cordova;
    var cd_project_root; // eslint-disable-line no-unused-vars
    var list_platforms;
    var fire;
    var project_dir = '/some/path';
    var prepare_spy, compile_spy;

    beforeEach(function () {
        is_cordova = spyOn(util, 'isCordova').and.returnValue(project_dir);
        cd_project_root = spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        list_platforms = spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
        prepare_spy = spyOn(cordova, 'prepare').and.returnValue(Q());
        compile_spy = spyOn(cordova, 'compile').and.returnValue(Q());
    });
    describe('failure', function () {
        it('Test 001 : should not run inside a project with no platforms', function () {
            list_platforms.and.returnValue([]);
            return cordova.build()
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toEqual(
                        'No platforms added to this project. Please use `cordova platform add <platform>`.'
                    );
                });
        });

        it('Test 002 : should not run outside of a Cordova-based project', function () {
            is_cordova.and.returnValue(false);

            return cordova.build()
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toEqual(
                        'Current working directory is not a Cordova-based project.'
                    );
                });
        });
    });

    describe('success', function () {
        it('Test 003 : should run inside a Cordova-based project with at least one added platform and call both prepare and compile', function () {
            return cordova.build(['android', 'ios']).then(function () {
                var opts = Object({ platforms: [ 'android', 'ios' ], verbose: false, options: Object({ }) });
                expect(prepare_spy).toHaveBeenCalledWith(opts);
                expect(compile_spy).toHaveBeenCalledWith(opts);
            });
        });
        it('Test 004 : should pass down options', function () {
            return cordova.build({platforms: ['android'], options: {release: true}}).then(function () {
                var opts = {platforms: ['android'], options: {release: true}, verbose: false};
                expect(prepare_spy).toHaveBeenCalledWith(opts);
                expect(compile_spy).toHaveBeenCalledWith(opts);
            });
        });

        it('Test 005 : should convert options from old format and warn user about this', function () {
            function warnSpy (message) {
                expect(message).toMatch('The format of cordova.* methods "options" argument was changed');
            }

            cordova.on('warn', warnSpy);
            return cordova.build({platforms: ['android'], options: ['--release', '--cdvBuildOpt=opt']}).then(function () {
                var opts = {platforms: ['android'], options: jasmine.objectContaining({release: true, argv: ['--cdvBuildOpt=opt']}), verbose: false};
                expect(prepare_spy).toHaveBeenCalledWith(opts);
                expect(compile_spy).toHaveBeenCalledWith(opts);
                cordova.off('warn', warnSpy);
            });
        });
    });

    describe('hooks', function () {
        describe('when platforms are added', function () {
            it('Test 006 : should fire before hooks through the hooker module', function () {
                return cordova.build(['android', 'ios']).then(function () {
                    expect(fire.calls.argsFor(0)).toEqual(['before_build', {verbose: false, platforms: ['android', 'ios'], options: {}}]);
                });
            });
            it('Test 007 : should fire after hooks through the hooker module', function () {
                return cordova.build('android').then(function () {
                    expect(fire.calls.argsFor(1)).toEqual([ 'after_build', { platforms: [ 'android' ], verbose: false, options: {} } ]);
                });
            });
        });

        describe('with no platforms added', function () {
            it('Test 008 : should not fire the hooker', function () {
                list_platforms.and.returnValue([]);
                return Q().then(cordova.build).then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toEqual(
                        'No platforms added to this project. Please use `cordova platform add <platform>`.'
                    );
                });
            });
        });
    });
});
