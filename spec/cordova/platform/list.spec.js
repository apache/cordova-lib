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

var events = require('cordova-common').events;
var Q = require('q');
var platform_list = require('../../../src/cordova/platform/list');
var cordova_util = require('../../../src/cordova/util');
var fail;

describe('cordova/platform/list', function () {
    var hooks_mock;
    var projectRoot = '/some/path';

    beforeEach(function () {
        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Q());
        spyOn(cordova_util, 'getInstalledPlatformsWithVersions').and.callThrough();
        spyOn(events, 'emit');
        spyOn(cordova_util, 'requireNoCache').and.returnValue({});
    });

    it('should fire the before_platform_ls hook', function () {
        platform_list(hooks_mock, projectRoot, {save: true});
        expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_ls', Object({ save: true }));
    });

    it('should fire the after_platform_ls hook', function (done) {
        platform_list(hooks_mock, projectRoot, {save: true})
            .then(function (result) {
                expect(hooks_mock.fire).toHaveBeenCalledWith('after_platform_ls', Object({ save: true }));
            }).fail(function (err) {
                fail('unexpected failure handler invoked!');
                console.error(err);
            }).done(done);
    });

    it('should print results of available platforms', function (done) {
        platform_list(hooks_mock, projectRoot, {save: true})
            .then(function (result) {
                expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/Installed platforms:/));
            }).fail(function (err) {
                fail('unexpected failure handler invoked!');
                console.error(err);
            }).done(done);
    });

    it('should return platform list', function (done) {
        var platformList = ['android', 'ios'];
        expect(platform_list.addDeprecatedInformationToPlatforms(platformList).toString()).toBe('android,ios');
        done();
    });
});
