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

var path = require('path');
var fs = require('fs');
var rewire = require('rewire');
var cordova_util = require('../../../src/cordova/util');
var platform_getPlatformDetails = rewire('../../../src/cordova/platform/getPlatformDetailsFromDir');
var events = require('cordova-common').events;

describe('cordova/platform/getPlatformDetailsFromDir', function () {
    var package_json_mock;
    package_json_mock = jasmine.createSpyObj('package json mock', ['cordova', 'dependencies']);
    package_json_mock.name = 'io.cordova.hellocordova';
    package_json_mock.version = '1.0.0';

    beforeEach(function () {
        spyOn(fs, 'existsSync');
        spyOn(cordova_util, 'requireNoCache');
        spyOn(events, 'emit');
    });

    it('should throw if no config.xml or pkgJson', function () {
        return platform_getPlatformDetails('dir', ['ios'])
            .then(function () {
                fail('Expected promise to be rejected');
            }, function (reason) {
                expect(reason).toMatch(/does not seem to contain a valid package.json or a valid Cordova platform/);
            });
    });

    it('should throw if no platform is provided', function () {
        cordova_util.requireNoCache.and.returnValue({});
        return platform_getPlatformDetails('dir')
            .then(function () {
                fail('Expected promise to be rejected');
            }, function (reason) {
                expect(reason).toMatch(/does not seem to contain a Cordova platform:/);
            });
    });

    it('should return a promise with platform and version', function () {
        fs.existsSync.and.callFake(function (filePath) {
            if (path.basename(filePath) === 'package.json') {
                return true;
            } else {
                return false;
            }
        });
        cordova_util.requireNoCache.and.returnValue(package_json_mock);
        return platform_getPlatformDetails('dir', ['cordova-android'])
            .then(function (result) {
                expect(result.platform).toBe('io.cordova.hellocordova');
                expect(result.version).toBe('1.0.0');
            });
    });

    it('should remove the cordova- prefix from the platform name for known platforms', function () {
        expect(platform_getPlatformDetails.platformFromName('cordova-ios')).toBe('ios');
        expect(events.emit).toHaveBeenCalledWith('verbose', jasmine.stringMatching(/Removing "cordova-" prefix/));
    });
});
