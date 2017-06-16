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

<<<<<<< HEAD
=======
var path = require('path');
var fs = require('fs');
var Q = require('q');
var shell = require('shelljs');
var events = require('cordova-common').events;
var rewire = require('rewire');
var platform_addHelper = rewire('../../src/cordova/platform/addHelper');
var prepare = require('../../src/cordova/prepare');
var platform_metadata = require('../../src/cordova/platform_metadata');
var cordova_util = require('../../src/cordova/util');
var cordova_config = require('../../src/cordova/config');

>>>>>>> Filling out more addHelper specs.
describe('cordova/platform/addHelper', function () {
    var projectRoot = '/some/path';
    var cfg_parser_mock = function () {};
    var cfg_parser_revert;
    var hooks_mock;
    var platform_api_mock;
    beforeEach(function () {
        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Q());
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser mock', ['write', 'removeEngine', 'addEngine']);
        cfg_parser_revert = platform_addHelper.__set__('ConfigParser', cfg_parser_mock);
        spyOn(shell, 'mkdir');
        spyOn(fs, 'existsSync').and.returnValue(false);
        spyOn(fs, 'writeFileSync');
        spyOn(cordova_util, 'projectConfig').and.returnValue(path.join(projectRoot, 'config.xml'));
        spyOn(cordova_util, 'isDirectory').and.returnValue(false);
        spyOn(cordova_util, 'isUrl').and.returnValue(false);
        spyOn(cordova_util, 'hostSupports').and.returnValue(true);
        spyOn(cordova_util, 'removePlatformPluginsJson');
        spyOn(cordova_config, 'read').and.returnValue({});
        // Fake platform details we will use for our mocks
        spyOn(platform_addHelper, 'downloadPlatform').and.returnValue(Q({
            'platform': 'atari'
        }));
        spyOn(platform_addHelper, 'getVersionFromConfigFile').and.returnValue(false);
        spyOn(platform_addHelper, 'installPluginsForNewPlatform').and.returnValue(Q());
        platform_api_mock = jasmine.createSpyObj('platform api mock', ['createPlatform', 'updatePlatform']);
        platform_api_mock.createPlatform.and.returnValue(Q());
        platform_api_mock.updatePlatform.and.returnValue(Q());
        spyOn(cordova_util, 'getPlatformApiFunction').and.returnValue(platform_api_mock);
        spyOn(prepare, 'preparePlatforms').and.returnValue(Q());
        spyOn(platform_metadata, 'save');
    });
    afterEach(function () {
        cfg_parser_revert();
    });
    describe('error/warning conditions', function () {
        it('should require specifying at least one platform', function (done) {
            platform_addHelper('add', hooks_mock).then(function () {
                fail('addHelper success handler unexpectedly invoked');
            }).fail(function (e) {
                expect(e.message).toContain('No platform specified.');
            }).done(done);
        });
        it('should log if host OS does not support the specified platform', function () {
            cordova_util.hostSupports.and.returnValue(false);
            spyOn(events, 'emit');
            platform_addHelper('add', hooks_mock, projectRoot, ['atari']);
            expect(events.emit.calls.mostRecent().args[1]).toContain('can not be built on this OS');
        });
    });
    describe('happy path (success conditions)', function () {
        it('should fire the before_platform_* hook', function () {
            platform_addHelper('add', hooks_mock, projectRoot, ['atari']);
            expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_add', jasmine.any(Object));
        });
        it('should warn about using deprecated platforms', function (done) {
            spyOn(events, 'emit');
            platform_addHelper('add', hooks_mock, projectRoot, ['ubuntu', 'blackberry10']);
            process.nextTick(function () {
                expect(events.emit).toHaveBeenCalledWith(jasmine.stringMatching(/has been deprecated/));
                done();
            });
        });
        describe('platform spec inference', function () {
            // TODO: test these by checking how platform_adDHelper.downloadPlatform was called.
            it('should assign directories-specified-as-platforms to the final spec we persist');
            it('should assign URLs-specified-as-platforms to the final spec we persist');
            it('should attempt to retrieve from package.json if exists in project');
            it('should attempt to retrieve from config.xml if exists and package.json does not');
            it('should fall back to using pinned version if both package.json and config.xml do not specify it');
            it('should invoke fetch if provided as an option and spec is a directory');
        });
        describe('platform api invocation', function () {
            // TODO: test these by checking how platform_api_mock.create/updatePlatform is called
            it('should check if platform was already added when adding');
            it('should check if platform was already added when updating');
        });
        /*
         * second "leg" (`then`) of the promise:
         * - checks for already-added or not-added platform requirements. TODO: couldnt we move this up to before downloading, to the initial error/warning checks?
         * - invokes platform api createPlatform or updatePlatform
         * - if not restoring, runs a `prepare`
         * - if just added, installsPluginsForNewPlatform (TODO for fil: familiarize yourself why not just a regular "install plugin for platform" - why the 'newPlatform' API?)
         * - if not restoring, run a prepare. TODO: didnt we just do this? we just installed plugins, so maybe its needed, but couldnt we just run a single prepare after possibly installing plugins?
         * third `then`:
         * - save particular platform version installed to platform metadata.
         * - if autosaving or opts.save is provided, write platform to config.xml
         * fourth `then`:
         * - save added platform to package.json if exists.
         * fifth `then`:
         * - fire after_platform_add/update hook
         */
    });
});
