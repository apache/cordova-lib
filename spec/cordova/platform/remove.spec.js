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
var Q = require('q');
var events = require('cordova-common').events;
var rewire = require('rewire');
var platform_remove = rewire('../../../src/cordova/platform/remove');
var platform_metadata = require('../../../src/cordova/platform_metadata');
var cordova_util = require('../../../src/cordova/util');
var promiseutil = require('../../../src/util/promise-util');
var fail;

describe('cordova/platform/remove', function () {
    var projectRoot = '/some/path';
    var cfg_parser_mock = function () {};
    var cfg_parser_revert_mock;
    var hooks_mock;
    var package_json_mock;
    package_json_mock = jasmine.createSpyObj('package json mock', ['cordova', 'dependencies']);
    package_json_mock.dependencies = {};
    package_json_mock.cordova = {};

    var hooksRunnerRevert;

    beforeEach(function () {
        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Q());
        hooksRunnerRevert = platform_remove.__set__('HooksRunner', function () {});
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser mock', ['write', 'removeEngine']);
        cfg_parser_revert_mock = platform_remove.__set__('ConfigParser', cfg_parser_mock);
        spyOn(fs, 'existsSync').and.returnValue(false);
        spyOn(fs, 'writeFileSync');
        spyOn(cordova_util, 'removePlatformPluginsJson');
        spyOn(events, 'emit');
        spyOn(cordova_util, 'requireNoCache').and.returnValue({});
    });
    afterEach(function () {
        cfg_parser_revert_mock();
        hooksRunnerRevert();
    });
    describe('error/warning conditions', function () {
        it('should require specifying at least one platform', function (done) {
            platform_remove('remove', hooks_mock).then(function () {
                fail('remove success handler unexpectedly invoked');
            }).fail(function (e) {
                expect(e.message).toContain('No platform(s) specified.');
            }).done(done);
        });
    });
    describe('happy path (success conditions)', function () {
        it('should fire the before_platform_* hook', function () {
            platform_remove(hooks_mock, projectRoot, ['atari'], {save: true});
            expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_rm', jasmine.any(Object));
        });

        it('should remove <platform>.json file from plugins directory', function (done) {
            platform_remove(hooks_mock, projectRoot, ['atari'], {save: true})
                .then(function () {
                    expect(cordova_util.removePlatformPluginsJson).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
        });

        it('should remove from config.xml and platforms.json', function (done) {
            platform_remove(hooks_mock, projectRoot, ['atari'], {save: true})
                .then(function () {
                    expect(cordova_util.removePlatformPluginsJson).toHaveBeenCalled();
                    expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
                    expect(events.emit).toHaveBeenCalledWith('log', jasmine.stringMatching(/Removing platform atari from config.xml file/));
                    expect(events.emit).toHaveBeenCalledWith('verbose', jasmine.stringMatching(/Removing platform atari from platforms.json file/));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
        });

        it('should remove from package.json', function (done) {
            package_json_mock.cordova = {'platforms': ['atari']};
            cordova_util.requireNoCache.and.returnValue(package_json_mock);
            spyOn(fs, 'readFileSync').and.returnValue('file');
            fs.existsSync.and.callFake(function (filePath) {
                if (path.basename(filePath) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });
            platform_remove(hooks_mock, projectRoot, ['atari'], {save: true})
                .then(function () {
                    expect(fs.writeFileSync).toHaveBeenCalled();
                    expect(events.emit).toHaveBeenCalledWith('log', jasmine.stringMatching(/Removing atari from cordova.platforms array in package.json/));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
        });

        it('should only remove from platforms.json', function (done) {
            spyOn(platform_metadata, 'remove').and.callThrough();
            package_json_mock.cordova = {'platforms': ['atari']};
            cordova_util.requireNoCache.and.returnValue(package_json_mock);
            fs.existsSync.and.callFake(function (filePath) {
                if (path.basename(filePath) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });
            platform_remove(hooks_mock, projectRoot, ['atari'], {save: false})
                .then(function () {
                    expect(fs.writeFileSync).not.toHaveBeenCalled();
                    expect(cfg_parser_mock.prototype.write).not.toHaveBeenCalled();
                    expect(platform_metadata.remove).toHaveBeenCalled();
                    expect(events.emit).toHaveBeenCalledWith('verbose', jasmine.stringMatching(/Removing platform atari from platforms.json file/));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
        });

        it('fetch should be called', function (done) {
            spyOn(promiseutil, 'Q_chainmap').and.returnValue(true);
            platform_remove(hooks_mock, projectRoot, ['atari'], {fetch: true})
                .then(function () {
                    expect(promiseutil.Q_chainmap).toHaveBeenCalled();
                    expect(hooks_mock.fire).toHaveBeenCalledWith('after_platform_rm', Object({ fetch: true }));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
        });

        it('should file the after_platform_* hook', function (done) {
            platform_remove(hooks_mock, projectRoot, ['atari'], {save: true})
                .then(function (result) {
                    expect(hooks_mock.fire).toHaveBeenCalledWith('after_platform_rm', Object({ save: true }));
                }).fail(function (err) {
                    fail('unexpected failure handler invoked!');
                    console.error(err);
                }).done(done);
        });
    });
});
