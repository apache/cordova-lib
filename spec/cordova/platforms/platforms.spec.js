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

var fs = require('fs');
var os = require('os');
var path = require('path');
var rewire = require('rewire');
var shell = require('shelljs');
var events = require('cordova-common').events;

var util = require('../../../src/cordova/util');
var platforms = rewire('../../../src/platforms/platforms');

var CORDOVA_ROOT = path.join(__dirname, '../fixtures/projects/platformApi');
var PLATFORM_WITH_API = path.join(CORDOVA_ROOT, 'platforms/windows');
var PLATFORM_SYMLINK = path.join(os.tmpdir(), 'cordova_windows_symlink');
var PlatformApiPoly = require('../../../src/platforms/PlatformApiPoly');

var browserParser = require('../../../src/cordova/metadata/browser_parser.js');

shell.ln('-sf', PLATFORM_WITH_API, PLATFORM_SYMLINK);

describe('getPlatformApi method', function () {
    var isCordova;

    beforeEach(function () {
        // reset api cache after each spec
        platforms.__set__('cachedApis', {});
        isCordova = spyOn(util, 'isCordova').and.returnValue(CORDOVA_ROOT);
    });

    it('should return PlatformApi class defined by platform', function () {
        spyOn(events, 'emit').and.returnValue(true);
        spyOn(util, 'convertToRealPathSafe').and.callThrough();
        spyOn(util, 'requireNoCache').and.callThrough();
        var platformApi = platforms.getPlatformApi('windows', PLATFORM_WITH_API);
        expect(platformApi).toBeDefined();
        expect(platformApi.platform).toEqual('windows');
        expect(events.emit.calls.count()).toEqual(1);
        expect(events.emit.calls.argsFor(0)[1]).toEqual('PlatformApi successfully found for platform windows');
        expect(util.convertToRealPathSafe.calls.count()).toEqual(1);
        expect(util.isCordova.calls.count()).toEqual(0);
        expect(util.requireNoCache.calls.count()).toEqual(1);
        expect(util.requireNoCache.calls.argsFor(0)[0]).toEqual(path.join(CORDOVA_ROOT, 'platforms/windows/cordova/Api.js'));
    });

    it('should return PlatformApi polyfill if PlatformApi is not defined by platform', function () {
        spyOn(browserParser, 'dirExists').and.returnValue(true);
        spyOn(fs, 'existsSync').and.callFake(function (somePath) {
            if (somePath === 'PLATFORM_WOUT_API') {
                return true;
            }
            return false;
        });
        spyOn(events, 'emit').and.returnValue(true);
        spyOn(util, 'convertToRealPathSafe').and.returnValue('PLATFORM_WOUT_API');
        spyOn(util, 'requireNoCache').and.callThrough();
        var platformApi = platforms.getPlatformApi('browser', 'PLATFORM_WOUT_API');
        expect(platformApi).toEqual(jasmine.any(PlatformApiPoly));
        expect(util.convertToRealPathSafe.calls.count()).toEqual(1);
        expect(events.emit.calls.count()).toEqual(1);
        expect(events.emit.calls.argsFor(0)[1]).toEqual('Failed to require PlatformApi instance for platform "browser". Using polyfill instead.');
        expect(util.isCordova.calls.count()).toEqual(0);
        expect(util.requireNoCache.calls.count()).toEqual(0);
    });

    it('should throw error if using deprecated platform', function () {
        try {
            platforms.getPlatformApi('android', path.join(CORDOVA_ROOT, 'platforms/android'));
        } catch (error) {
            expect(error.toString()).toContain('platform does not have Api.js');
        }
    });

    it('should cache PlatformApi instance for further calls', function () {
        var platformApi = platforms.getPlatformApi('windows', PLATFORM_WITH_API);
        expect(platformApi.fakeProperty).not.toBeDefined();
        platformApi.fakeProperty = 'fakeValue';
        expect(platforms.getPlatformApi('windows', PLATFORM_WITH_API).fakeProperty).toBe('fakeValue');
    });

    it('should resolve symlinks before creating an instance', function () {
        var platformApi = platforms.getPlatformApi('windows', PLATFORM_SYMLINK);
        expect(platforms.getPlatformApi('windows', PLATFORM_WITH_API)).toBe(platformApi);
    });

    it('should return cached instance by symlink to project root', function () {
        platforms.getPlatformApi('windows', PLATFORM_WITH_API).fakeProperty = 'fakeValue';
        expect(platforms.getPlatformApi('windows', PLATFORM_SYMLINK).fakeProperty).toBe('fakeValue');
    });

    it('should succeed if called inside of cordova project w/out platformRoot param', function () {
        var platformApi = platforms.getPlatformApi('windows');
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
});
