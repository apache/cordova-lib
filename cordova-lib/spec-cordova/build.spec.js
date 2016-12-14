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

describe('build command', function() {
    var is_cordova, cd_project_root, list_platforms, fire;
    var project_dir = '/some/path';
    var prepare_spy, compile_spy;

    beforeEach(function() {
        is_cordova = spyOn(util, 'isCordova').and.returnValue(project_dir);
        cd_project_root = spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        list_platforms = spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
        prepare_spy = spyOn(cordova.raw, 'prepare').and.returnValue(Q());
        compile_spy = spyOn(cordova.raw, 'compile').and.returnValue(Q());
    });
    describe('failure', function() {
        it('should not run inside a project with no platforms', function(done) {
            list_platforms.and.returnValue([]);
            cordova.raw.build()
            .then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(err.message).toEqual(
                    'No platforms added to this project. Please use `cordova platform add <platform>`.'
                );
            }).fin(done);
        });

        it('should not run outside of a Cordova-based project', function(done) {
            is_cordova.and.returnValue(false);

            cordova.raw.build()
            .then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(err.message).toEqual(
                    'Current working directory is not a Cordova-based project.'
                );
            }).fin(done);
        });
    });

    describe('success', function() {
        it('should run inside a Cordova-based project with at least one added platform and call both prepare and compile', function(done) {
            cordova.raw.build(['android','ios']).then(function() {
                var opts = Object({ platforms: [ 'android', 'ios' ], verbose: false, options: Object({  }) })
                expect(prepare_spy).toHaveBeenCalledWith(opts);
                expect(compile_spy).toHaveBeenCalledWith(opts);
                done();
            });
        });
        it('should pass down options', function(done) {
            cordova.raw.build({platforms: ['android'], options: {release: true}}).then(function() {
                var opts = {platforms: ['android'], options: {release: true}, verbose: false};
                expect(prepare_spy).toHaveBeenCalledWith(opts);
                expect(compile_spy).toHaveBeenCalledWith(opts);
                done();
            });
        });

        it('should convert options from old format and warn user about this', function (done) {
            function warnSpy(message) {
                expect(message).toMatch('The format of cordova.raw.* methods "options" argument was changed');
            }

            cordova.on('warn', warnSpy);
            cordova.raw.build({platforms:['android'], options:['--release', '--cdvBuildOpt=opt']}).then(function () {
                var opts = {platforms: ['android'], options: jasmine.objectContaining({release: true, argv: ['--cdvBuildOpt=opt']}), verbose: false};
                expect(prepare_spy).toHaveBeenCalledWith(opts);
                expect(compile_spy).toHaveBeenCalledWith(opts);
                cordova.off('warn', warnSpy);
                done();
            });
        });
    });

    describe('hooks', function() {
        describe('when platforms are added', function() {
            it('should fire before hooks through the hooker module', function(done) {
                cordova.raw.build(['android', 'ios']).then(function() {
                    expect(fire).toHaveBeenCalledWith('before_build', {verbose: false, platforms:['android', 'ios'], options: []});
                    done();
                });
            });
            it('should fire after hooks through the hooker module', function(done) {
                cordova.raw.build('android').then(function() {
                     expect(fire).toHaveBeenCalledWith('after_build', {verbose: false, platforms:['android'], options: []});
                     done();
                });
            });
        });

        describe('with no platforms added', function() {
            it('should not fire the hooker', function(done) {
                list_platforms.and.returnValue([]);
                Q().then(cordova.raw.build).then(function() {
                    expect('this call').toBe('fail');
                }, function(err) {
                    expect(err.message).toEqual(
                        'No platforms added to this project. Please use `cordova platform add <platform>`.'
                    );
                }).fin(done);
            });
        });
    });
});
