/*!
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
const events = require('cordova-common').events;

describe('hooks/Context', () => {
    let Context;

    beforeEach(() => {
        Context = rewire('../../src/hooks/Context');
    });

    describe('requireCordovaModule', () => {
        let warnSpy, requireCordovaModule;

        beforeEach(() => {
            requireCordovaModule = Context.prototype.requireCordovaModule;
            warnSpy = jasmine.createSpy('warnSpy');
            events.on('warn', warnSpy);
        });

        afterEach(() => {
            events.removeListener('warn', warnSpy);
        });

        it('correctly resolves cordova-* dependencies', () => {
            const cordovaCommon = require('cordova-common');
            expect(requireCordovaModule('cordova-common')).toBe(cordovaCommon);
        });

        it('correctly resolves inner modules of cordova-* dependencies', () => {
            const MODULE = 'cordova-common/src/events';
            expect(requireCordovaModule(MODULE)).toBe(require(MODULE));
        });

        it('correctly resolves cordova-lib', () => {
            const cordovaLib = require('../..');
            expect(requireCordovaModule('cordova-lib')).toBe(cordovaLib);
        });

        it('correctly resolves inner modules of cordova-lib', () => {
            const platforms = require('../../src/platforms/platforms');
            expect(requireCordovaModule('cordova-lib/src/platforms/platforms')).toBe(platforms);
        });

        it('correctly resolves inner modules of cordova-lib', () => {
            const platforms = require('../../src/platforms/platforms');
            expect(requireCordovaModule('cordova-lib/src/platforms/platforms')).toBe(platforms);
        });

        describe('with stubbed require', () => {
            let requireSpy;

            beforeEach(() => {
                requireSpy = jasmine.createSpy('require');
                Context.__set__({ require: requireSpy });
            });

            it('maps some old paths to their new equivalent', () => {
                const ConfigParser = Symbol('ConfigParser');
                const xmlHelpers = Symbol('xmlHelpers');
                requireSpy.and.returnValue({ ConfigParser, xmlHelpers });

                expect(requireCordovaModule('cordova-lib/src/configparser/ConfigParser')).toBe(ConfigParser);
                expect(requireCordovaModule('cordova-lib/src/util/xml-helpers')).toBe(xmlHelpers);
                expect(requireSpy.calls.allArgs()).toEqual([
                    ['cordova-common'], ['cordova-common']
                ]);
            });

            it('correctly handles module names that start with "cordova-lib"', () => {
                requireCordovaModule('cordova-libre');
                expect(requireSpy).toHaveBeenCalledWith('cordova-libre');
            });

            it('emits a warning if non-cordova module is requested', () => {
                requireCordovaModule('q');

                expect(requireSpy).toHaveBeenCalledWith('q');
                expect(warnSpy).toHaveBeenCalledTimes(1);

                const message = warnSpy.calls.argsFor(0)[0];
                expect(message).toContain('requireCordovaModule');
                expect(message).toContain('non-cordova module');
                expect(message).toContain('deprecated');
                expect(message).toContain('"q"');
            });
        });

    });
});
