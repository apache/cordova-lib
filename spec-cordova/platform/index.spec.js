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
/* eslint-env jasmine */

var rewire = require('rewire');
var platform = rewire('../../src/cordova/platform'),
    cordova_util = require('../../src/cordova/util'),
    prepare = require('../../src/cordova/prepare'),
    cordova = require('../../src/cordova/cordova'),
    platformMetadata = require('../../src/cordova/platform_metadata'),
    platforms = require('../../src/platforms/platforms'),
    lazy_load = require('../../src/cordova/lazy_load'),
    Q = require('q');
var config_xml_path = '../spec-cordova/fixtures/config.xml';
var pinnedAndroidVer = platforms.android.version;

describe('cordova/platform', function () {
    var hooksRunnerRevert;
    beforeEach(function() {
        hooksRunnerRevert = platform.__set__('HooksRunner', function() {});
        spyOn(cordova_util, 'cdProjectRoot').and.returnValue('somepath');
    });

    afterEach(function() {
        hooksRunnerRevert();
    });

    describe('main module function', function () {
        describe('error/warning conditions', function () {
            // TODO: what about other commands? update? save?
            it('should require at least one platform for add and remove commands');
        });
        describe('happy path (success conditions)', function () {
            it('should default to the list command if no command is provided');
            it('should be able to handle an array of platform targets, or a single platform target string');
            it('should direct `add` commands to the `add` method/module');
            it('should direct `remove` + `rm` commands to the `remove` method/module');
            it('should direct `update` + `up` commands to the `update` method/module');
            it('should direct `check` commands to the `check` method/module');
            it('should direct all other commands to the `list` method/module');
        });
    });

    xdescribe('old platform tests, please see how to fold these into new tests', function () {
        it('should successfuly call platform add function', function(done) {
            spyOn(platform, 'add').and.returnValue(true);
            return platform('add', ['android'], {})
            .then(function() {
                expect(platform.add.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('should successfuly call platform remove function', function(done) {
            spyOn(platform, 'remove').and.returnValue(true);
            return platform('remove', ['android'], {})
            .then(function() {
                expect(platform.remove.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('should successfuly call platform update function', function(done) {
            spyOn(platform, 'update').and.returnValue(true);
            return platform('update', ['android'], {})
            .then(function() {
                expect(platform.update.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('should successfuly call platform check function', function(done) {
            spyOn(platform, 'check').and.returnValue(true);
            return platform('check', ['android'], {})
            .then(function() {
                expect(platform.check.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('should successfuly call platform save function', function(done) {
            spyOn(platform, 'save').and.returnValue(true);
            return platform('save', ['android'], {})
            .then(function() {
                expect(platform.save.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('should successfuly call platform list function', function(done) {
            spyOn(platform, 'list').and.returnValue(true);
            return platform('list', ['android'], {})
            .then(function() {
                expect(platform.list.calls.count()).toEqual(1);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            }).fin(done);
        });

        it('should successfuly throw an error if targets is undefined', function(done) {
            return platform('add', undefined, {})
            .then(false)
            .fail(function(e) {
                expect(e).toBeDefined();
                expect(e.message).toContain('You need to qualify `add` or `remove` with one or more platforms!');
            }).fin(done);
        });
    });
});

