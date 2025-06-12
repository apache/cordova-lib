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
const { events } = require('cordova-common');
const platforms = require('../../src/platforms/platforms');
const HooksRunner = require('../../src/hooks/HooksRunner');
const util = require('../../src/cordova/util');

const supported_platforms = Object.keys(platforms).filter(function (p) { return p !== 'www'; });

describe('run command', function () {
    const project_dir = '/some/path';
    let cordovaRun, cordovaPrepare, platformApi, getPlatformApi, targets;

    beforeEach(function () {
        spyOn(util, 'isCordova').and.returnValue(project_dir);
        spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        spyOn(HooksRunner.prototype, 'fire').and.returnValue(Promise.resolve());
        spyOn(events, 'emit');

        cordovaRun = rewire('../../src/cordova/run');
        cordovaPrepare = jasmine.createSpy('cordovaPrepare').and.returnValue(Promise.resolve());
        targets = jasmine.createSpy('targets').and.returnValue(Promise.resolve());
        cordovaRun.__set__({ cordovaPrepare, targets });

        platformApi = {
            run: jasmine.createSpy('run').and.returnValue(Promise.resolve()),
            build: jasmine.createSpy('build').and.returnValue(Promise.resolve()),
            listTargets: jasmine.createSpy('listTargets').and.returnValue(Promise.resolve())
        };
        getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);
    });
    describe('failure', function () {
        it('Test 001 : should not run inside a Cordova-based project with no added platforms by calling util.listPlatforms', function () {
            util.listPlatforms.and.returnValue([]);
            return expectAsync(
                cordovaRun()
            ).toBeRejectedWithError(
                'No platforms added to this project. Please use `cordova platform add <platform>`.'
            );
        });
        it('Test 002 : should not run outside of a Cordova-based project', function () {
            const msg = 'Dummy message about not being in a cordova dir.';
            util.cdProjectRoot.and.throwError(new Error(msg));
            util.isCordova.and.returnValue(false);
            return expectAsync(
                cordovaRun()
            ).toBeRejectedWithError(msg);
        });
    });

    describe('list', function () {
        it('should warn if platforms are not specified', function () {
            const result = cordovaRun({ platforms: [], options: { list: true } });

            expect(result).toBeFalsy();
            expect(events.emit).toHaveBeenCalledWith('warn', 'A platform must be provided when using the "--list" flag.');
        });

        it('should try to use the Platform API to list emulator targets', function () {
            return cordovaRun({ platforms: ['ios'], options: { list: true } })
                .then(function () {
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(platformApi.listTargets).toHaveBeenCalledWith(jasmine.objectContaining({ options: jasmine.objectContaining({ list: true }) }));
                });
        });

        it('should pass options down', function () {
            return cordovaRun({ platforms: ['ios'], options: { list: true, device: true } })
                .then(function () {
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(platformApi.listTargets).toHaveBeenCalledWith(jasmine.objectContaining({ options: jasmine.objectContaining({ device: true }) }));
                });
        });

        it('should fall back to the pre-Platform API targets', function () {
            delete platformApi.listTargets;

            return cordovaRun({ platforms: ['ios'], options: { list: true } })
                .then(function () {
                    expect(getPlatformApi).toHaveBeenCalledWith('ios');
                    expect(targets).toHaveBeenCalledWith(jasmine.objectContaining({ options: jasmine.objectContaining({ list: true }) }));

                    expect(events.emit).toHaveBeenCalledWith('warn', 'Please update to the latest platform release to ensure uninterrupted fetching of target lists.');
                });
        });
    });

    describe('success', function () {
        it('Test 003 : should call prepare before actually run platform ', function () {
            return cordovaRun(['android', 'ios']).then(function () {
                expect(cordovaPrepare.calls.argsFor(0)).toEqual([{ platforms: ['android', 'ios'], verbose: false, options: {} }]);
            });
        });
        it('Test 004 : should get PlatformApi instance for each platform and call its\' run method', function () {
            return cordovaRun(['android', 'ios']).then(function () {
                expect(getPlatformApi).toHaveBeenCalledWith('android');
                expect(getPlatformApi).toHaveBeenCalledWith('ios');
                expect(platformApi.build).toHaveBeenCalled();
                expect(platformApi.run).toHaveBeenCalled();
            });
        });
        it('Test 005 : should pass down parameters', function () {
            return cordovaRun({ platforms: ['blackberry10'], options: { password: '1q1q' } }).then(function () {
                expect(cordovaPrepare).toHaveBeenCalledWith({ platforms: ['blackberry10'], options: { password: '1q1q' }, verbose: false });
                expect(platformApi.build).toHaveBeenCalledWith({ password: '1q1q' });
                expect(platformApi.run).toHaveBeenCalledWith({ password: '1q1q', nobuild: true });
            });
        });

        it('Test 006 : should skip preparing if --noprepare is passed', function () {
            return cordovaRun({ platforms: ['blackberry10'], options: { noprepare: true } }).then(function () {
                expect(cordovaPrepare).not.toHaveBeenCalledWith(jasmine.objectContaining({ platforms: ['blackberry10'] }));
                expect(platformApi.build).toHaveBeenCalledWith({ noprepare: true });
                expect(platformApi.run).toHaveBeenCalledWith({ noprepare: true, nobuild: true });
            });
        });

        it('Test 007 : should call platform\'s build method', function () {
            return cordovaRun({ platforms: ['blackberry10'] })
                .then(function () {
                    expect(cordovaPrepare).toHaveBeenCalled();
                    expect(platformApi.build).toHaveBeenCalledWith({});
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({ nobuild: true }));
                });
        });

        it('Test 008 : should not call build if --nobuild option is passed', function () {
            return cordovaRun({ platforms: ['blackberry10'], options: { nobuild: true } })
                .then(function () {
                    expect(cordovaPrepare).toHaveBeenCalled();
                    expect(platformApi.build).not.toHaveBeenCalled();
                    expect(platformApi.run).toHaveBeenCalledWith(jasmine.objectContaining({ nobuild: true }));
                });
        });

        describe('run parameters should not be altered by intermediate build command', function () {
            beforeEach(function () {
                platformApi.build.and.callFake(opts => {
                    opts.couldBeModified = 'insideBuild';
                    return Promise.resolve();
                });
            });
            it('Test 009 : should leave parameters unchanged', function () {
                return cordovaRun({ platforms: ['blackberry10'], options: { password: '1q1q' } }).then(function () {
                    expect(cordovaPrepare).toHaveBeenCalledWith({ platforms: ['blackberry10'], options: { password: '1q1q', couldBeModified: 'insideBuild' }, verbose: false });
                    expect(platformApi.build).toHaveBeenCalledWith({ password: '1q1q', couldBeModified: 'insideBuild' });
                    expect(platformApi.run).toHaveBeenCalledWith({ password: '1q1q', nobuild: true });
                });
            });
        });
    });

    describe('hooks', function () {
        describe('when platforms are added', function () {
            it('Test 010 : should fire before hooks through the hooker module', function () {
                return cordovaRun(['android', 'ios']).then(function () {
                    expect(HooksRunner.prototype.fire.calls.argsFor(0))
                        .toEqual(['before_run', { platforms: ['android', 'ios'], verbose: false, options: {} }]);
                });
            });
            it('Test 011 : should fire after hooks through the hooker module', function () {
                return cordovaRun('android').then(function () {
                    expect(HooksRunner.prototype.fire.calls.argsFor(2))
                        .toEqual(['after_run', { platforms: ['android'], verbose: false, options: {} }]);
                });
            });
        });

        describe('with no platforms added', function () {
            it('Test 012 : should not fire the hooker', async function () {
                util.listPlatforms.and.returnValue([]);

                await expectAsync(
                    cordovaRun()
                ).toBeRejectedWithError(
                    'No platforms added to this project. Please use `cordova platform add <platform>`.'
                );

                expect(HooksRunner.prototype.fire).not.toHaveBeenCalled();
            });
        });
    });
});
