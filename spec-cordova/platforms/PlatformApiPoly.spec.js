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
var xmlHelpers = require('cordova-common').xmlHelpers;
var ActionStack = require('cordova-common').ActionStack;
var superspawn = require('cordova-common').superspawn;
var PluginInfo = require('cordova-common').PluginInfo;
var ConfigParser = require('cordova-common').ConfigParser;
var knownPlatforms = require('../../src/platforms/platforms');
var PlatformApiPoly = require('../../src/platforms/PlatformApiPoly');

var PLATFORM = 'browser';
var PLATFORM_VERSION = '4.1.0';
var PLATFORM_LIB = '/some/platform/lib';
var CORDOVA_ROOT = path.join(__dirname, '../fixtures/projects/platformApi');
var PLATFORM_ROOT = path.join(CORDOVA_ROOT, 'platforms/browser');
var DUMMY_PLUGIN = path.join(__dirname, '../fixtures/plugins/test');
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

var platformApiPolyPublicMethods = [
    'getPlatformInfo',
    'prepare',
    'addPlugin',
    'removePlugin',
    'updatePlugin',
    'build',
    'run',
    'clean',
    'requirements'
];

describe('PlatformApi polyfill', function () {
    var platformApi;

    beforeEach(function () {
        var originalParseElementtreeSync = xmlHelpers.parseElementtreeSync;
        spyOn(xmlHelpers, 'parseElementtreeSync').and.callFake(function (configPath) {
            return /config\.xml$/.test(configPath) ? new et.ElementTree(et.XML(TEST_XML)) :
                originalParseElementtreeSync(configPath);
        });

        platformApi = new PlatformApiPoly(PLATFORM, PLATFORM_ROOT);
    });

    it('should be constructable', function () {
        var api;
        expect(function(){api = new PlatformApiPoly(PLATFORM, PLATFORM_ROOT);}).not.toThrow();
        expect(api).toEqual(jasmine.any(PlatformApiPoly));
    });

    it('should fail when unknown platform is specified', function () {
        var api;
        expect(function(){api = new PlatformApiPoly('fakePlatform', PLATFORM_ROOT);}).toThrow();
    });

    it('should fail when mandatory argument is not specified', function () {
        var api;
        expect(function(){api = new PlatformApiPoly(PLATFORM);}).toThrow();
        expect(function(){api = new PlatformApiPoly(null, PLATFORM_ROOT);}).toThrow();
    });

    it('should have fields defined', function () {
        expect(platformApi.platform).toBe(PLATFORM);
        expect(platformApi.root).toBe(PLATFORM_ROOT);
    });

    it('should have \'static\' methods defined', function () {
        expect(platformApi.constructor.createPlatform).toEqual(jasmine.any(Function));
        expect(platformApi.constructor.updatePlatform).toEqual(jasmine.any(Function));
    });

    it('should have methods defined', function () {
        platformApiPolyPublicMethods.forEach(function (methodName) {
            expect(platformApi[methodName]).toEqual(jasmine.any(Function));
        });
    });

    describe('methods:', function () {

        var FAKE_PROJECT, FAKE_CONFIG, OPTIONS, getPlatformApi, fail, success;

        beforeEach(function () {
            getPlatformApi = spyOn(knownPlatforms, 'getPlatformApi').and.returnValue(platformApi);

            spyOn(shell, 'cp');
            spyOn(shell, 'rm');
            spyOn(shell, 'mkdir');
            spyOn(fs, 'writeFileSync');

            fail = jasmine.createSpy('fail');
            success = jasmine.createSpy('success');

            FAKE_CONFIG = new ConfigParser('/fake/config.xml');
            FAKE_PROJECT = {locations: {platforms: path.dirname(PLATFORM_ROOT), www: path.join(CORDOVA_ROOT, 'www')}, projectConfig: FAKE_CONFIG};
            OPTIONS = {platformDetails: {libDir: PLATFORM_LIB, platform: PLATFORM, version: PLATFORM_VERSION}};
        });

        describe('static create/updatePlatform methods', function () {
            var spawn;

            beforeEach(function () {
                spawn = spyOn(superspawn, 'spawn').and.returnValue(Q());
            });

            it('should create/update platform through running platforms\' scripts', function (done) {
                Q.all([PlatformApiPoly.createPlatform(PLATFORM_ROOT, FAKE_CONFIG, OPTIONS),
                       PlatformApiPoly.updatePlatform(PLATFORM_ROOT, OPTIONS)])
                .then(function () {
                    expect(spawn).toHaveBeenCalled();
                    expect(spawn.calls.count()).toBe(2);
                }).fail(function (err) {
                    expect(err).not.toBeDefined();
                }).fin(done);
            });

            it('should pass down arguments to platforms\' scripts', function (done) {
                Q.all([PlatformApiPoly.createPlatform(PLATFORM_ROOT, FAKE_CONFIG, OPTIONS),
                       PlatformApiPoly.updatePlatform(PLATFORM_ROOT, OPTIONS)])
                .then(function () {
                    expect(spawn).toHaveBeenCalled();
                    expect(spawn.calls.count()).toBe(2);
                    expect(spawn.calls.argsFor(0)[0]).toBe(path.join(PLATFORM_LIB, 'bin/create'));
                    expect(spawn.calls.argsFor(0)[1]).toContain(PLATFORM_ROOT);
                    expect(spawn.calls.argsFor(1)[0]).toBe(path.join(PLATFORM_LIB, 'bin/update'));
                    expect(spawn.calls.argsFor(1)[1]).toContain(PLATFORM_ROOT);
                }).fail(function (err) {
                    expect(err).not.toBeDefined();
                }).fin(done);
            });

            it('should copy cordova JS sources into created platform', function (done) {
                Q.all([PlatformApiPoly.createPlatform(PLATFORM_ROOT, FAKE_CONFIG, OPTIONS),
                       PlatformApiPoly.updatePlatform(PLATFORM_ROOT, OPTIONS)])
                .then(function () {
                    expect(shell.cp).toHaveBeenCalled();
                    expect(shell.cp.calls.count()).toBe(2);
                }).fail(fail)
                .fin(function () {
                    expect(fail).not.toHaveBeenCalled();
                    done();
                });
            });

            it('should fail immediately if options.platformInfo is not specified', function (done) {
                Q.all([PlatformApiPoly.createPlatform(PLATFORM_ROOT, FAKE_CONFIG),
                       PlatformApiPoly.updatePlatform(PLATFORM_ROOT, FAKE_CONFIG)])
                .then(success)
                .fail(fail)
                .fin(function function_name (argument) {
                    expect(success).not.toHaveBeenCalled();
                    expect(fail).toHaveBeenCalled();
                    expect(spawn).not.toHaveBeenCalled();
                    done();
                });
            });
        });

        describe('prepare method', function () {
            beforeEach(function () {
                spyOn(platformApi._parser, 'update_www');
                spyOn(platformApi._parser, 'update_project').and.returnValue(Q());
            });

            it('should return promise', function (done) {
                var promise = platformApi.prepare(FAKE_PROJECT, OPTIONS);
                expect(Q.isPromise(promise)).toBeTruthy();
                promise.fin(done);
            });

            it('should call parser\'s corresponding methods', function (done) {
                platformApi.prepare(FAKE_PROJECT, OPTIONS)
                .then(function () {
                    [platformApi._parser.update_www, platformApi._parser.update_project]
                    .forEach(function (method) {
                        expect(method).toHaveBeenCalled();
                    });
                })
                .fail(fail)
                .fin(function () {
                    expect(fail).not.toHaveBeenCalled();
                    done();
                });
            });
        });

        describe('pluginAdd method', function () {
            var plugin, actionsProcess;

            beforeEach(function () {
                plugin = new PluginInfo(DUMMY_PLUGIN);
                actionsProcess = spyOn(ActionStack.prototype, 'process').and.callThrough();
            });

            it('should return promise', function (done) {
                var promise = platformApi.addPlugin(plugin);
                expect(Q.isPromise(promise)).toBeTruthy();
                promise.fin(done);
            });

            it('should fail if plugin parameter is not specified', function (done) {
                platformApi.addPlugin()
                .then(success)
                .fail(fail)
                .fin(function () {
                    expect(success).not.toHaveBeenCalled();
                    expect(fail).toHaveBeenCalled();
                    done();
                });
            });

            it('should process all plugin files through action stack', function (done) {
                platformApi.addPlugin(plugin)
                .then(success)
                .fail(fail)
                .fin(function () {
                    expect(actionsProcess).toHaveBeenCalled();
                    expect(success).toHaveBeenCalled();
                    expect(fail).not.toHaveBeenCalled();
                    done();
                });
            });
        });

        describe('platform actions', function () {
            var spawnSpy;

            beforeEach(function () {
                spawnSpy = spyOn(superspawn, 'spawn');
            });

            it('should return promise', function (done) {
                var ops = [
                    platformApi.build(/*opts*/),
                    platformApi.run(/*opts*/),
                    platformApi.clean(/*opts*/),
                    platformApi.requirements()
                ];

                ops.forEach(function (op) {
                    expect(Q.isPromise(op));
                });
                Q.all(ops).fin(done);
            });

            it('should do their job through running platforms\' scripts', function (done) {
                var ops = [
                    platformApi.build(/*opts*/),
                    platformApi.run(/*opts*/),
                    platformApi.clean(/*opts*/)
                ];

                Q.all(ops)
                .then(function () {
                    expect(spawnSpy).toHaveBeenCalled();
                    expect(spawnSpy.calls.count()).toEqual(3);
                }).fin(done);
            });

            it('should convert and pass down options to platforms\' scripts', function (done) {
                var options = {
                    release: true,
                    nobuild: true,
                    device: true,
                    target: 'FakeDevice',
                    archs: ['arm', 'x86'],
                    buildConfig: '/some/path'
                };
                spawnSpy.and.returnValue(Q());
                platformApi.build(options)
                .then(function () {
                    ['--release', '--nobuild', '--device', '--target=' + options.target, '--archs=arm,x86', '--buildConfig='  +options.buildConfig]
                    .forEach(function (arg) {
                        expect(spawnSpy.calls[0].args[1]).toContain(arg);
                    });
                }).fin(done);
            });
        });
    });
});
