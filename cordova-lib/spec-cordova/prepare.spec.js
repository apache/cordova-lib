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

var shell = require('shelljs'),
    PlatformJson = require('cordova-common').PlatformJson,
    path = require('path'),
    util = require('../src/cordova/util'),
    prepare = require('../src/cordova/prepare'),
    lazy_load = require('../src/cordova/lazy_load'),
    ConfigParser = require('cordova-common').ConfigParser,
    platforms = require('../src/platforms/platforms'),
    HooksRunner = require('../src/hooks/HooksRunner'),
    xmlHelpers = require('cordova-common').xmlHelpers,
    et = require('elementtree'),
    Q = require('q');

var project_dir = '/some/path';
var supported_platforms = Object.keys(platforms).filter(function(p) { return p != 'www'; });
var supported_platforms_paths = supported_platforms.map(function(p) { return path.join(project_dir, 'platforms', p, 'www'); });

var TEST_XML = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<widget xmlns     = "http://www.w3.org/ns/widgets"\n' +
    '        xmlns:cdv = "http://cordova.apache.org/ns/1.0"\n' +
    '        id        = "io.cordova.hellocordova"\n' +
    '        version   = "0.0.1">\n' +
    '    <name>Hello Cordova</name>\n' +
    '    <description>\n' +
    '        A sample Apache Cordova application that responds to the deviceready event.\n' +
    '    </description>\n' +
    '    <author href="http://cordova.io" email="dev@cordova.apache.org">\n' +
    '        Apache Cordova Team\n' +
    '    </author>\n' +
    '    <content src="index.html" />\n' +
    '    <access origin="*" />\n' +
    '    <preference name="fullscreen" value="true" />\n' +
    '    <preference name="webviewbounce" value="true" />\n' +
    '</widget>\n';

describe('prepare command', function() {
    var is_cordova,
        cd_project_root,
        list_platforms,
        fire,
        parsers = {},
        find_plugins,
        cp,
        mkdir,
        load, platformApi, getPlatformApi;

    beforeEach(function () {
        getPlatformApi = spyOn(platforms, 'getPlatformApi').and.callFake(function (platform, rootDir) {
            return {
                prepare: jasmine.createSpy('prepare').and.returnValue(Q()),
                getPlatformInfo: jasmine.createSpy('getPlatformInfo').and.returnValue({
                    locations: {
                        www: path.join(project_dir, 'platforms', platform, 'www')
                    }
                }),
            };
        });
        is_cordova = spyOn(util, 'isCordova').and.returnValue(project_dir);
        cd_project_root = spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
        list_platforms = spyOn(util, 'listPlatforms').and.returnValue(supported_platforms);
        fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());

        find_plugins = spyOn(util, 'findPlugins').and.returnValue([]);
        spyOn(PlatformJson, 'load').and.returnValue(new PlatformJson(null, null, {}));
        spyOn(PlatformJson.prototype, 'save');
        load = spyOn(lazy_load, 'based_on_config').and.returnValue(Q());
        cp = spyOn(shell, 'cp').and.returnValue(true);
        mkdir = spyOn(shell, 'mkdir');
        spyOn(ConfigParser.prototype, 'write');
        spyOn(xmlHelpers, 'parseElementtreeSync').and.callFake(function() {
            return new et.ElementTree(et.XML(TEST_XML));
        });
    });

    describe('failure', function() {
        it('should not run outside of a cordova-based project by calling util.isCordova', function(done) {
            is_cordova.and.returnValue(false);
            cd_project_root.and.callThrough();  // undo spy here because prepare depends on cdprojectRoot for isCordova check
            prepare().then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect('' + err).toContain('Current working directory is not a Cordova-based project.');
            }).fin(done);
        });
        it('should not run inside a cordova-based project with no platforms', function(done) {
            list_platforms.and.returnValue([]);
            prepare().then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect('' + err).toContain('No platforms added to this project. Please use `cordova platform add <platform>`.');
            }).fin(done);
        });
    });

    describe('success', function() {
        it('should run inside a Cordova-based project by calling util.isCordova', function(done) {
            prepare().then(function() {
                expect(is_cordova).toHaveBeenCalled();
            }, function(err) {
                expect(err).toBeUndefined();
            }).fin(done);
        });
        it('should get PlatformApi instance for each platform and invoke its\' run method', function(done) {
            prepare().then(function() {
                supported_platforms.forEach(function(p) {
                    expect(parsers[p]).toHaveBeenCalled();
                    expect(getPlatformApi).toHaveBeenCalledWith(p);
                });
                expect(platformApi.run).toHaveBeenCalled();
            }, function(err) {
                expect(err).toBeUndefined();
            }).fin(done);
        });
    });

    describe('hooks', function() {
        describe('when platforms are added', function() {
            it('should fire before hooks through the hooker module, and pass in platforms and paths as data object', function(done) {
                prepare().then(function() {
                    expect(fire).toHaveBeenCalledWith('before_prepare', {verbose: false, platforms:supported_platforms, options: [], save: false, fetch: false, paths:supported_platforms_paths});
                }, function(err) {
                    expect(err).toBeUndefined();
                }).fin(done);
            });
            it('should fire after hooks through the hooker module, and pass in platforms and paths as data object', function(done) {
                prepare('android').then(function() {
                    expect(fire).toHaveBeenCalledWith('after_prepare', {verbose: false, platforms:['android'], options: [], paths:[path.join(project_dir, 'platforms', 'android', 'www')]});
                }, function(err) {
                    expect(err).toBeUndefined('Exception while running `prepare android`:\n' + err.stack);
                }).fin(done);
            });
        });

        describe('with no platforms added', function() {
            beforeEach(function() {
                list_platforms.and.returnValue([]);
            });
            it('should not fire the hooker', function(done) {
                Q().then(prepare).then(function() {
                    expect('this call').toBe('fail');
                }, function(err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(fire).not.toHaveBeenCalledWith('before_prepare');
                    expect(fire).not.toHaveBeenCalledWith('after_prepare');
                }).fin(done);
            });
        });
    });
});