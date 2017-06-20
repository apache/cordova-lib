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

var path = require('path');
var rewire = require('rewire');
var util = require('../src/cordova/util');
var cordova_config = require('../src/cordova/config');
var prepare = rewire('../src/cordova/prepare');
var restore = require('../src/cordova/restore-util');
var platforms = require('../src/platforms/platforms');
var HooksRunner = require('../src/hooks/HooksRunner');
var Q = require('q');
var PlatformJson = require('cordova-common').PlatformJson;

var project_dir = '/some/path';

describe('cordova/prepare', function () {
    var platform_api_prepare_mock;
    beforeEach(function () {
        platform_api_prepare_mock = jasmine.createSpy('prepare').and.returnValue(Q());
        spyOn(platforms, 'getPlatformApi').and.callFake(function (platform, rootDir) {
            return {
                prepare: platform_api_prepare_mock,
                getPlatformInfo: jasmine.createSpy('getPlatformInfo').and.returnValue({
                    locations: {
                        www: path.join(project_dir, 'platforms', platform, 'www')
                    }
                })
            };
        });
        spyOn(PlatformJson, 'load');
    });

    describe('main method', function () {
        beforeEach(function () {
            spyOn(cordova_config, 'read').and.returnValue({});
            spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
            spyOn(restore, 'installPlatformsFromConfigXML').and.returnValue(Q());
            spyOn(restore, 'installPluginsFromConfigXML').and.returnValue(Q());
            spyOn(util, 'isCordova').and.returnValue(true);
            spyOn(prepare, 'preparePlatforms').and.returnValue(Q);
        });
        describe('failure', function () {
            it('should invoke util.preProcessOptions as preflight task checker, which, if fails, should trigger promise rejection and only fire the before_prepare hook', function(done) {
                spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
                spyOn(util, 'preProcessOptions').and.throwError();
                prepare({}).fail(function(err) {
                    expect(err).toBeDefined();
                    expect(HooksRunner.prototype.fire.calls.count()).toBe(1);
                    expect(HooksRunner.prototype.fire.calls.argsFor(0)[0]).toEqual('before_prepare');
                    done();
                });
            });
            it('should invoke util.cdProjectRoot as a preflight task checker, which, if fails, should trigger a promise rejection and fire no hooks', function(done) {
                spyOn(util, 'cdProjectRoot').and.throwError();
                prepare({}).fail(function(err) {
                    expect(err).toBeDefined();
                    expect(HooksRunner.prototype.fire.calls.any()).toBe(false);
                    done();
                });
            });
        });

        describe('success', function () {
            beforeEach(function () {
                spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
                spyOn(util, 'preProcessOptions').and.callFake(function(options) {
                    let platforms = options.platforms || []
                    return {'platforms':platforms}
                });
            });
            it('should fire the before_prepare hook and provide platform and path information as arguments', function(done) {
                prepare({}).then(function() {
                    expect(HooksRunner.prototype.fire.calls.argsFor(0)[0]).toEqual('before_prepare');
                    done();
                })
            });
            it('should invoke restore module\'s installPlatformsFromConfigXML method', function(done) {
                prepare({}).then(function() {
                    expect(restore.installPlatformsFromConfigXML).toHaveBeenCalled();
                    done();
                }).fail(function(err){
                    console.log(err);
                    expect(err).toBeUndefined();
                    done();
                });
            });
            it('should retrieve PlatformApi instances for each platform provided', function(done) {
                prepare({'platforms':['android', 'ios']}).then(function() {
                    expect(platforms.getPlatformApi.calls.count()).toBe(4);
                    expect(platforms.getPlatformApi.calls.argsFor(0)[0]).toBe('android');
                    expect(platforms.getPlatformApi.calls.argsFor(0)[1]).toBe('/some/path/platforms/android');
                    expect(platforms.getPlatformApi.calls.argsFor(1)[0]).toBe('ios');
                    expect(platforms.getPlatformApi.calls.argsFor(1)[1]).toBe('/some/path/platforms/ios');
                    expect(platforms.getPlatformApi.calls.argsFor(2)[0]).toBe('android');
                    expect(platforms.getPlatformApi.calls.argsFor(3)[0]).toBe('ios');

                    done();
                }).fail(function(err){
                    console.log(err);
                    expect(err).toBeUndefined();
                    done();
                });
            });
            it('should invoke restore module\'s installPluginsFromConfigXML method', function(done) {
                prepare({platforms:[]}).then(function() {
                    //expect(true).toHaveBeenCalled();
                    done();
                });
            });
            it('should invoke preparePlatforms method, providing the appropriate platforms');
            it('should fire the after_prepare hook and provide platform and path information as arguments', function(done) {
                prepare({}).then(function() {
                    expect(HooksRunner.prototype.fire.calls.argsFor(1)[0]).toEqual('after_prepare');
                    expect(HooksRunner.prototype.fire.calls.argsFor(1)[1]).toEqual({ 'platforms': [], 'paths': [], 'searchpath': undefined });
                    done();
                });
            });
        });
    });

    describe('preparePlatforms helper method', function () {
        var cfg_parser_mock = function () {};
        var cfg_parser_revert_mock;
        var platform_munger_mock = function () {};
        var platform_munger_revert_mock;
        var platform_munger_save_mock;
        beforeEach(function () {
            cfg_parser_mock.prototype = jasmine.createSpyObj('config parser prototype mock', []);
            cfg_parser_revert_mock = prepare.__set__('ConfigParser', cfg_parser_mock);
            platform_munger_save_mock = jasmine.createSpy('platform munger save mock');
            platform_munger_mock.protytpe = jasmine.createSpyObj('platform munger prototype mock', ['add_config_changes']);
            platform_munger_mock.prototype.add_config_changes.and.returnValue({
                save_all: platform_munger_save_mock
            });
            platform_munger_revert_mock = prepare.__set__('PlatformMunger', platform_munger_mock);
            spyOn(util, 'projectConfig').and.returnValue(project_dir);
            spyOn(util, 'projectWww').and.returnValue(path.join(project_dir, 'www'));
            spyOn(prepare, 'restoreMissingPluginsForPlatform').and.returnValue(Q());
        });
        afterEach(function () {
            cfg_parser_revert_mock();
            platform_munger_revert_mock();
        });
        it('should call restoreMissingPluginsForPlatform');
        it('should retrieve the platform API via getPlatformApi per platform provided, and invoke the prepare method from that API');
        it('should fire a pre_package hook for the windows platform when the platform API is not an instance of PlatformApiPoly');
        // TODO: xit'ed the one below as dynamic requires make it difficult to spy on
        // Can we refactor the relevant code to make it testable?
        xit('should invoke browserify if the browserify option is provided');
        it('should handle config changes by invoking add_config_changes and save_all');
    });

    describe('restoreMissingPluginsForPlatform helper method', function () {
        var is_plugin_installed_mock;
        beforeEach(function () {
            is_plugin_installed_mock = jasmine.createSpy('is plugin installed mock');
            // mock platform json value below
            PlatformJson.load.and.returnValue({
                isPluginInstalled: is_plugin_installed_mock,
                root: {
                    installed_plugins: [],
                    dependent_plugins: []
                }
            });
        });
        it('should resolve quickly if there is no difference between "old" and "new" platform.json');
        it('should leverage platform API to remove and add any missing plugins identified');
    });
});
