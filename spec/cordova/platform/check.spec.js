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

var fs = require('fs-extra');
var events = require('cordova-common').events;
var superspawn = require('cordova-common').superspawn;
var rewire = require('rewire');
var platform_check = rewire('../../../src/cordova/platform/check');
var platform = require('../../../src/cordova/platform');
var cordova_util = require('../../../src/cordova/util');

describe('cordova/platform/check', function () {
    var projectRoot = '/some/path';
    var hooks_mock;

    beforeEach(function () {
        spyOn(events, 'emit');
        spyOn(superspawn, 'spawn').and.callThrough();
        spyOn(fs, 'removeSync');
        spyOn(cordova_util, 'listPlatforms').and.returnValue(['ios']);
        spyOn(platform, 'add').and.returnValue(Promise.resolve());
    });

    it('If no results, platforms cannot be updated', function () {
        platform.add.and.returnValue(Promise.reject());
        cordova_util.listPlatforms.and.callThrough();
        return platform_check(hooks_mock, projectRoot).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/No platforms can be updated/));
            expect(superspawn.spawn).toHaveBeenCalledWith('npm', ['--loglevel=silent', '--json', 'outdated', 'cordova-lib'], jasmine.any(Object));
            expect(fs.removeSync).toHaveBeenCalledWith(jasmine.any(String));
        });
    });

    it('Should warn if install failed', function () {
        platform.add.and.returnValue(Promise.reject());
        return platform_check(hooks_mock, projectRoot).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/current did not install/));
        });
    });

    it('Should warn if version-empty', function () {
        superspawn.spawn.and.returnValue(Promise.resolve());
        return platform_check(hooks_mock, projectRoot).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/current version script failed to return a version/));
        });
    });

    it('Should warn if version-failed', function () {
        spyOn(superspawn, 'maybeSpawn').and.returnValue(Promise.resolve('version-failed'));
        return platform_check(hooks_mock, projectRoot).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/current version script failed, and/));
        });
    });
});
