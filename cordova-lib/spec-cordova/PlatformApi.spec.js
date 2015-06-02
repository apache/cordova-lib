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
var fs = require('fs');
var et = require('elementtree');
var path = require('path');
var shell = require('shelljs');
var rewire = require('rewire');

var PLATFORM = 'windows';
// var CORDOVA_ROOT = '/some/path';
var CORDOVA_ROOT = path.join(__dirname, 'fixtures', 'platformApi');
var PLATFORM_ROOT = path.join(CORDOVA_ROOT, 'platforms', PLATFORM);

var util = require('../src/cordova/util');
var superspawn = require('../src/cordova/superspawn');
var xmlHelpers = require('../src/util/xml-helpers');
var Parser = require('../src/cordova/metadata/parser');
var knownPlatforms = require('../src/platforms/platformsConfig.json');
var basePlatformApi = rewire('../src/platforms/PlatformApi');
var BasePlatformApi = basePlatformApi.__get__('BasePlatformApi');
var BasePluginHandler = require('../src/plugman/platforms/PluginHandler');
var MockPlatformApi = require(path.join(PLATFORM_ROOT, 'cordova', 'Api'));
var MockPluginHandler = MockPlatformApi.PluginHandler;

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

describe('getPlatformApi method', function () {
    var isCordova, origPlatformRoot, origCordovaRoot;

    beforeEach(function () {
        origCordovaRoot = CORDOVA_ROOT;
        CORDOVA_ROOT = '/some/path';
        origPlatformRoot = PLATFORM_ROOT;
        PLATFORM_ROOT = path.join(CORDOVA_ROOT, 'platforms', PLATFORM);
        // need to reset cache after each test to avoid strange issues
        basePlatformApi.__set__('cachedProjects', {});
        isCordova = spyOn(util, 'isCordova').andReturn(CORDOVA_ROOT);
    });

    afterEach(function () {
        CORDOVA_ROOT = origCordovaRoot;
        PLATFORM_ROOT = origPlatformRoot;
    });

    it('should return BasePlatformApi instance', function () {
        var platformApi = basePlatformApi.getPlatformApi(PLATFORM, PLATFORM_ROOT);
        expect(platformApi instanceof BasePlatformApi).toBeTruthy();
        expect(platformApi.platform).toBe(PLATFORM);
        expect(platformApi.root).toBe(PLATFORM_ROOT);
    });

    it('should cache BasePlatformApi instance for further calls', function () {
        var platformApi = basePlatformApi.getPlatformApi(PLATFORM, PLATFORM_ROOT);
        expect(platformApi.fakeProperty).not.toBeDefined();
        platformApi.fakeProperty = 'fakeValue';
        expect(basePlatformApi.getPlatformApi(PLATFORM, PLATFORM_ROOT).fakeProperty).toBe('fakeValue');
    });

    it('should get implementation for BasePlatformApi instance from platform', function () {

        PLATFORM_ROOT = origPlatformRoot;
        CORDOVA_ROOT = origCordovaRoot;

        var platformApi = basePlatformApi.getPlatformApi(PLATFORM, PLATFORM_ROOT);
        expect(platformApi).toEqual(jasmine.any(MockPlatformApi));
    });

    it('should succeed if called inside of cordova project w/out platformRoot param', function () {
        var platformApi = basePlatformApi.getPlatformApi(PLATFORM);
        expect(platformApi instanceof BasePlatformApi).toBeTruthy();
        expect(platformApi.platform).toBe(PLATFORM);
        expect(platformApi.root).toBe(PLATFORM_ROOT);
    });

    it('should throw if called outside of cordova project w/out platformRoot param', function () {
        isCordova.andReturn(false);
        expect(function () { basePlatformApi.getPlatformApi(PLATFORM); }).toThrow();
    });

    it('should throw for unknown platform', function () {
        expect(function () { basePlatformApi.getPlatformApi('invalid_platform'); }).toThrow();
    });
});

describe('BasePlatformApi class', function () {
    var isCordova, platformApi;
    var origCordovaRoot, origPlatformRoot;

    beforeEach(function () {
        origCordovaRoot = CORDOVA_ROOT;
        CORDOVA_ROOT = '/some/path';
        origPlatformRoot = PLATFORM_ROOT;
        PLATFORM_ROOT = path.join(CORDOVA_ROOT, 'platforms', PLATFORM);

        // need to reset cache after each test to avoid strange issues
        basePlatformApi.__set__('cachedProjects', {});
        isCordova = spyOn(util, 'isCordova').andReturn(CORDOVA_ROOT);
        platformApi = basePlatformApi.getPlatformApi(PLATFORM);
    });

    afterEach(function () {
        CORDOVA_ROOT = origCordovaRoot;
        PLATFORM_ROOT = origPlatformRoot;
    });

    it('should have fields defined', function () {
        expect(platformApi.platform).toBe(PLATFORM);
        expect(platformApi.root).toBe(PLATFORM_ROOT);
    });

    describe('\'parser\' property', function () {
        var origParserFile;
        beforeEach(function () {
            origParserFile = knownPlatforms[PLATFORM].parser_file;
            knownPlatforms[PLATFORM].parser_file = '../../spec-cordova/fixtures/templates/fakePlatformParser';
        });

        afterEach(function () {
            knownPlatforms[PLATFORM].parser_file = origParserFile;
        });

        it('should have \'parser\' property', function () {
            expect(platformApi.parser).toEqual(jasmine.any(Parser));
        });

        it('should cache \'parser\' property', function () {
            expect(platformApi.parser.fakeProperty).not.toBeDefined();
            platformApi.parser.fakeProperty = 'fakeValue';
            expect(platformApi.parser.fakeProperty).toBe('fakeValue');
        });
    });

    it('should have methods defined', function () {
        ['getPluginHandler', 'getInstaller', 'getUninstaller',
         'getConfigXml', 'getWwwDir', 'getCordovaJsSrc',
         'updateWww', 'updateConfig', 'updateProject',
         'build', 'run', 'requirements'].forEach(function (methodName) {
            expect(platformApi[methodName]).toEqual(jasmine.any(Function));
        });
    });

    describe('methods:', function () {
        var origParserFile;
        beforeEach(function () {
            origParserFile = knownPlatforms[PLATFORM].parser_file;
            // knownPlatforms[PLATFORM].parser_file = undefined;
            knownPlatforms[PLATFORM].parser_file = path.join('../fixtures/templates/fakePlatformParser');
        });

        afterEach(function () {
            knownPlatforms[PLATFORM].parser_file = origParserFile;
        });

        describe('getPluginHandler method', function () {

            it('should return PluginHandler instance', function () {
                var handler = platformApi.getPluginHandler();
                expect(handler).toEqual(jasmine.any(BasePluginHandler));
            });

            it('should return cached PluginHandler instance for further calls', function () {
                var handler = platformApi.getPluginHandler();
                expect(handler.fakeProperty).not.toBeDefined();
                handler.fakeProperty = 'fakeValue';
                expect(platformApi.getPluginHandler().fakeProperty).toBe('fakeValue');
            });

            it('should get implementation for PluginHandler instance from platform', function () {
                platformApi = basePlatformApi.getPlatformApi(PLATFORM, origPlatformRoot);
                var handler = platformApi.getPluginHandler();
                expect(handler instanceof MockPluginHandler).toBeTruthy();
            });
        });

        describe('getInstaller/getUninstaller methods', function () {
            it('should return installer/uninstaller functions', function () {
                expect(platformApi.getInstaller()).toEqual(jasmine.any(Function));
                expect(platformApi.getUninstaller()).toEqual(jasmine.any(Function));
            });

            it('installer/uninstaller functions should call corresponding pluginHandler methods', function () {
                var pluginHandler = platformApi.getPluginHandler();
                var fakeInstall = jasmine.createSpy('install');
                pluginHandler['source-file'] = { install: fakeInstall, uninstall: fakeInstall };
                platformApi.getInstaller('source-file')();
                platformApi.getUninstaller('source-file')();
                expect(fakeInstall).toHaveBeenCalled();
                expect(fakeInstall.callCount).toBe(2);
            });
        });

        describe('get* methods', function () {
            it('should return default values if platform implementation isn\'t provided', function () {
                delete platformApi.parser;
                expect(platformApi.getConfigXml()).toMatch(/config\.xml$/);
                expect(platformApi.getWwwDir()).toMatch(/www$/);
                expect(platformApi.getCordovaJsSrc('somedir')).toBeDefined();
            });

            it('should borrow implementation from parser property', function () {
                delete platformApi.parser;
                platformApi.parser = {
                    config_xml: jasmine.createSpy('config_xml'),
                    www_dir: jasmine.createSpy('www_dir'),
                    cordovajs_src_path: jasmine.createSpy('cordova_js_src')
                };

                platformApi.getConfigXml();
                platformApi.getWwwDir();
                platformApi.getCordovaJsSrc('somedir');
                expect(platformApi.parser.config_xml).toHaveBeenCalled();
                expect(platformApi.parser.www_dir).toHaveBeenCalled();
                expect(platformApi.parser.cordovajs_src_path).toHaveBeenCalled();
            });
        });

        describe('update* methods', function () {
            beforeEach(function () {
                spyOn(shell, 'cp');
                spyOn(shell, 'rm');
                spyOn(shell, 'mkdir');
                spyOn(fs, 'writeFileSync');
                spyOn(util, 'mergeXml');
                spyOn(xmlHelpers, 'parseElementtreeSync').andCallFake(function() {
                    return new et.ElementTree(et.XML(TEST_XML));
                });
            });

            it('should return promise', function (done) {
                var ops = [platformApi.updateConfig(), platformApi.updateWww(), platformApi.updateProject()];
                ops.forEach(function (op) {
                    expect(Q.isPromise(op));
                });
                Q.all(ops).fin(done);
            });

            it('should borrow implementation from parser property', function (done) {
                delete platformApi.parser;
                platformApi.parser = {
                    update_www: jasmine.createSpy('update_www'),
                    update_project: jasmine.createSpy('update_project')
                };

                var ops = [platformApi.updateConfig(), platformApi.updateWww(), platformApi.updateProject()];
                Q.all(ops).then(function () {
                    expect(platformApi.parser.update_www).toHaveBeenCalled();
                    expect(platformApi.parser.update_project).toHaveBeenCalled();
                }).fin(done);
            });

            it('updateConfig should merge project config.xml to platform\'s one', function (done) {
                platformApi.updateConfig()
                .then(function () {
                    expect(util.mergeXml).toHaveBeenCalled();
                    done();
                });
            });

            it('updateConfig should use provided config source instead of default one', function (done) {
                var fakeSource = '/some/config.xml';
                platformApi.updateConfig(fakeSource)
                .then(function () {
                    expect(xmlHelpers.parseElementtreeSync).toHaveBeenCalledWith(fakeSource);
                    done();
                });
            });
        });

        describe('platform actions', function () {
            beforeEach(function () {
                spyOn(superspawn, 'spawn');
                spyOn(util, 'listPlatforms').andReturn([PLATFORM]);
            });

            it('should return promise', function (done) {
                var opts = util.preProcessOptions();
                var ops = [platformApi.build(opts), platformApi.run(opts), /*platformApi.requirements()*/];
                ops.forEach(function (op) {
                    expect(Q.isPromise(op));
                });
                Q.all(ops).fin(done);
            });
        });
    });
});
