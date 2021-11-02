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

describe('build command', function () {
    const project_dir = '/some/path';
    let cordovaBuild, cordovaPrepare, cordovaCompile;

    beforeEach(function () {
        spyOn(util, 'isCordova').and.returnValue(project_dir);
        spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        spyOn(util, 'listPlatforms').and.returnValue(Object.keys(platforms));
        spyOn(HooksRunner.prototype, 'fire').and.returnValue(Promise.resolve());

        cordovaBuild = rewire('../../src/cordova/build');
        cordovaPrepare = jasmine.createSpy('cordovaPrepare').and.returnValue(Promise.resolve());
        cordovaCompile = jasmine.createSpy('cordovaCompile').and.returnValue(Promise.resolve());
        cordovaBuild.__set__({ cordovaPrepare, cordovaCompile });
    });
    describe('failure', function () {
        it('Test 001 : should not run inside a project with no platforms', function () {
            util.listPlatforms.and.returnValue([]);
            return expectAsync(
                cordovaBuild()
            ).toBeRejectedWithError(
                'No platforms added to this project. Please use `cordova platform add <platform>`.'
            );
        });

        it('Test 002 : should not run outside of a Cordova-based project', function () {
            util.isCordova.and.returnValue(false);

            return expectAsync(
                cordovaBuild()
            ).toBeRejectedWithError(
                'Current working directory is not a Cordova-based project.'
            );
        });
    });

    describe('success', function () {
        it('Test 003 : should run inside a Cordova-based project with at least one added platform and call both prepare and compile', function () {
            return cordovaBuild(['android', 'ios']).then(function () {
                const opts = Object({ platforms: ['android', 'ios'], verbose: false, options: Object({ }) });
                expect(cordovaPrepare).toHaveBeenCalledWith(opts);
                expect(cordovaCompile).toHaveBeenCalledWith(opts);
            });
        });
        it('Test 004 : should pass down options', function () {
            return cordovaBuild({ platforms: ['android'], options: { release: true } }).then(function () {
                const opts = { platforms: ['android'], options: { release: true }, verbose: false };
                expect(cordovaPrepare).toHaveBeenCalledWith(opts);
                expect(cordovaCompile).toHaveBeenCalledWith(opts);
            });
        });
    });

    describe('hooks', function () {
        describe('when platforms are added', function () {
            it('Test 006 : should fire before hooks through the hooker module', function () {
                return cordovaBuild(['android', 'ios']).then(function () {
                    expect(HooksRunner.prototype.fire.calls.argsFor(0))
                        .toEqual(['before_build', { verbose: false, platforms: ['android', 'ios'], options: {} }]);
                });
            });
            it('Test 007 : should fire after hooks through the hooker module', function () {
                return cordovaBuild('android').then(function () {
                    expect(HooksRunner.prototype.fire.calls.argsFor(1))
                        .toEqual(['after_build', { platforms: ['android'], verbose: false, options: {} }]);
                });
            });
        });

        describe('with no platforms added', function () {
            it('Test 008 : should not fire the hooker', function () {
                util.listPlatforms.and.returnValue([]);

                return expectAsync(
                    cordovaBuild()
                ).toBeRejectedWithError(
                    'No platforms added to this project. Please use `cordova platform add <platform>`.'
                );
            });
        });
    });
});
