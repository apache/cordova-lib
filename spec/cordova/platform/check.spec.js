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

var Q = require('q');
var shell = require('shelljs');
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
        spyOn(shell, 'rm');
        spyOn(cordova_util, 'listPlatforms');
        spyOn(platform, 'add').and.returnValue(Q());
    });

    it('If no results, platforms cannot be updated', function () {
        platform.add.and.returnValue(Q.reject());
        cordova_util.listPlatforms.and.callThrough();
        return platform_check(hooks_mock, projectRoot).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/No platforms can be updated/));
            expect(superspawn.spawn).toHaveBeenCalledWith('npm', ['--loglevel=silent', '--json', 'outdated', 'cordova-lib'], jasmine.any(Object));
            expect(shell.rm).toHaveBeenCalledWith('-rf', jasmine.any(String));
        });
    });

    it('Should warn if install failed', function () {
        platform.add.and.returnValue(Q.reject());
        cordova_util.listPlatforms.and.returnValue(['ios']);
        return platform_check(hooks_mock, projectRoot).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/current did not install/));
        });
    });

    it('Should warn if version-empty', function () {
        cordova_util.listPlatforms.and.returnValue(['ios']);
        superspawn.spawn.and.returnValue(Q());
        return platform_check(hooks_mock, projectRoot).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/current version script failed to return a version/));
        });
    });

    it('Should warn if version-failed', function () {
        cordova_util.listPlatforms.and.returnValue(['ios']);
        spyOn(superspawn, 'maybeSpawn').and.returnValue(Q('version-failed'));
        spyOn(Q.defer(), 'resolve').and.returnValue('version-failed');
        return platform_check(hooks_mock, projectRoot).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/current version script failed, and/));
        });
    });
});
