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

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const rewire = require('rewire');
const events = require('cordova-common').events;

const util = require('../../../src/cordova/util');
const platforms = rewire('../../../src/platforms/platforms');

const CORDOVA_ROOT = path.join(__dirname, '../fixtures/projects/platformApi');
const PLATFORM_WITH_API = path.join(CORDOVA_ROOT, 'platforms/windows');
const PLATFORM_SYMLINK = path.join(os.tmpdir(), 'cordova_windows_symlink');

describe('platforms/platforms', () => {
    it('should have getPlatformApi function as a property', function () {
        expect(platforms.getPlatformApi).toBeDefined();
        expect(typeof platforms.getPlatformApi).toBe('function');
    });

    it('should have all and only the supported platforms', function () {
        expect(Object.keys(platforms)).toEqual(jasmine.arrayWithExactContents([
            'android', 'browser', 'ios', 'osx', 'windows', 'electron'
        ]));
    });

    describe('getPlatformApi method', function () {
        let isCordova;

        beforeEach(function () {
            // reset api cache after each spec
            platforms.__set__('cachedApis', {});
            isCordova = spyOn(util, 'isCordova').and.returnValue(CORDOVA_ROOT);

            fs.removeSync(PLATFORM_SYMLINK);
            fs.ensureSymlinkSync(PLATFORM_WITH_API, PLATFORM_SYMLINK);
        });

        it('should return PlatformApi class defined by platform', function () {
            spyOn(events, 'emit').and.returnValue(true);
            spyOn(util, 'convertToRealPathSafe').and.callThrough();
            spyOn(util, 'requireNoCache').and.callThrough();
            const platformApi = platforms.getPlatformApi('windows', PLATFORM_WITH_API);
            expect(platformApi).toBeDefined();
            expect(platformApi.platform).toEqual('windows');
            expect(events.emit.calls.count()).toEqual(1);
            expect(events.emit.calls.argsFor(0)[1]).toMatch('Loaded API for windows project');
            expect(util.convertToRealPathSafe.calls.count()).toEqual(1);
            expect(util.isCordova.calls.count()).toEqual(0);
            expect(util.requireNoCache.calls.count()).toEqual(1);
            expect(util.requireNoCache.calls.argsFor(0)[0]).toEqual(path.join(CORDOVA_ROOT, 'platforms/windows/cordova/Api.js'));
        });

        it('should cache PlatformApi instance for further calls', function () {
            const platformApi = platforms.getPlatformApi('windows', PLATFORM_WITH_API);
            expect(platformApi.fakeProperty).not.toBeDefined();
            platformApi.fakeProperty = 'fakeValue';
            expect(platforms.getPlatformApi('windows', PLATFORM_WITH_API).fakeProperty).toBe('fakeValue');
        });

        it('should resolve symlinks before creating an instance', function () {
            const platformApi = platforms.getPlatformApi('windows', PLATFORM_SYMLINK);
            expect(platforms.getPlatformApi('windows', PLATFORM_WITH_API)).toBe(platformApi);
        });

        it('should return cached instance by symlink to project root', function () {
            platforms.getPlatformApi('windows', PLATFORM_WITH_API).fakeProperty = 'fakeValue';
            expect(platforms.getPlatformApi('windows', PLATFORM_SYMLINK).fakeProperty).toBe('fakeValue');
        });

        it('should succeed if called inside of cordova project w/out platformRoot param', function () {
            const platformApi = platforms.getPlatformApi('windows');
            expect(platformApi).toBeDefined();
            expect(platformApi.platform).toEqual('windows');
        });

        it('should throw if called outside of cordova project w/out platformRoot param', function () {
            isCordova.and.returnValue(false);
            expect(function () { platforms.getPlatformApi('windows'); }).toThrow();
        });

        it('should throw for unknown platform', function () {
            expect(function () { platforms.getPlatformApi('invalid_platform'); }).toThrow();
        });

        it('should throw for nonsense www platform', function () {
            expect(function () { platforms.getPlatformApi('www'); }).toThrow();
        });
    });
});
