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
const { CordovaError } = require('cordova-common');

describe('hooks/Context', () => {
    let Context;

    beforeEach(() => {
        Context = rewire('../../src/hooks/Context');
    });

    describe('cordova', () => {
        let context;

        beforeEach(() => {
            spyOn(Context.prototype, 'requireCordovaModule');
            context = new Context();
        });

        it('is only loaded when accessed', () => {
            expect(context.requireCordovaModule).not.toHaveBeenCalled();
        });

        it('is set to require("cordova-lib").cordova', () => {
            const cordova = Symbol('cordova');
            context.requireCordovaModule.and.returnValue({ cordova });

            expect(context.cordova).toBe(cordova);
            expect(context.requireCordovaModule).toHaveBeenCalledWith('cordova-lib');
        });
    });

    describe('requireCordovaModule', () => {
        let requireCordovaModule;

        beforeEach(() => {
            requireCordovaModule = Context.prototype.requireCordovaModule;
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

            it('correctly handles module names that start with "cordova-lib"', () => {
                requireCordovaModule('cordova-libre');
                expect(requireSpy).toHaveBeenCalledWith('cordova-libre');
            });

            it('throws if non-cordova module is requested', () => {
                const expectErrorOnRequire = m =>
                    expect(() => requireCordovaModule(m))
                        .toThrowError(CordovaError, /non-cordova module/);

                expectErrorOnRequire('q');
                expectErrorOnRequire('.');
                expectErrorOnRequire('..');
                expectErrorOnRequire('./asd');
                expectErrorOnRequire('../qwe');
                expectErrorOnRequire('/foo');
            });
        });

    });
});
