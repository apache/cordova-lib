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
/* global fail */

var path = require('path');
var rewire = require('rewire');
var util = require('../../src/cordova/util');
var cordova_config = require('../../src/cordova/config');
var prepare = rewire('../../src/cordova/prepare');
var restore = require('../../src/cordova/restore-util');
var platforms = require('../../src/platforms/platforms');
var HooksRunner = require('../../src/hooks/HooksRunner');
var Q = require('q');
var PlatformJson = require('cordova-common').PlatformJson;
var PluginInfoProvider = require('cordova-common').PluginInfoProvider;

var project_dir = '/some/path';

describe('cordova/prepare', function () {
    var platform_api_prepare_mock;
    var platform_api_add_mock;
    var platform_api_remove_mock;
    beforeEach(function () {
        platform_api_prepare_mock = jasmine.createSpy('prepare').and.returnValue(Q());
        platform_api_add_mock = jasmine.createSpy('add').and.returnValue(Q());
        platform_api_remove_mock = jasmine.createSpy('remove').and.returnValue(Q());
        spyOn(platforms, 'getPlatformApi').and.callFake(function (platform, rootDir) {
            return {
                prepare: platform_api_prepare_mock,
                getPlatformInfo: jasmine.createSpy('getPlatformInfo').and.returnValue({
                    locations: {
                        www: path.join(project_dir, 'platforms', platform, 'www')
                    }
                }),
                removePlugin: platform_api_add_mock,
                addPlugin: platform_api_remove_mock
            };
        });
        spyOn(PlatformJson, 'load');
        spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
        spyOn(util, 'isCordova').and.returnValue(true);
    });

    describe('main method', function () {
        beforeEach(function () {
            spyOn(cordova_config, 'read').and.returnValue({});
            spyOn(restore, 'installPlatformsFromConfigXML').and.returnValue(Q());
            spyOn(restore, 'installPluginsFromConfigXML').and.returnValue(Q());
            spyOn(util, 'cdProjectRoot').and.returnValue(project_dir);
            spyOn(util, 'preProcessOptions').and.callFake(function (options) {
                var platforms = options.platforms || [];
                return {'platforms': platforms};
            });
            spyOn(prepare, 'preparePlatforms').and.returnValue(Q);
        });
        describe('failure', function () {
            it('should invoke util.preProcessOptions as preflight task checker, which, if fails, should trigger promise rejection and only fire the before_prepare hook', function (done) {
                util.preProcessOptions.and.callFake(function () {
                    throw new Error('preProcessOption error');
                });
                prepare({}).then(function () {
                    fail('unexpected failure handler invoked');
                }).fail(function (e) {
                    expect(e.message).toBe('preProcessOption error');
                    expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('before_prepare', jasmine.any(Object));
                }).done(done);
            });
            it('should invoke util.cdProjectRoot as a preflight task checker, which, if fails, should trigger a promise rejection and fire no hooks', function (done) {
                util.cdProjectRoot.and.callFake(function () {
                    throw new Error('cdProjectRoot error');
                });
                prepare({}).then(function () {
                    fail('unexpected failure handler invoked');
                }).fail(function (e) {
                    expect(e.message).toBe('cdProjectRoot error');
                    expect(HooksRunner.prototype.fire).not.toHaveBeenCalledWith();
                }).done(done);
            });
        });

        describe('success', function () {
            it('should fire the before_prepare hook and provide platform and path information as arguments', function (done) {
                prepare({}).then(function () {
                    expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('before_prepare', jasmine.any(Object));
                }).fail(function (e) {
                    fail('unexpected failure handler invoked');
                    console.error(e);
                }).done(done);
            });
            it('should invoke restore module\'s installPlatformsFromConfigXML method', function (done) {
                prepare({}).then(function () {
                    expect(restore.installPlatformsFromConfigXML).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('unexpected failure handler invoked');
                    console.error(e);
                }).done(done);
            });
            it('should retrieve PlatformApi instances for each platform provided', function (done) {
                prepare({'platforms': ['android', 'ios']}).then(function () {
                    expect(platforms.getPlatformApi).toHaveBeenCalledTimes(4);
                    // expect(platforms.getPlatformApi).toHaveBeenCalledWith(['android', path.join('some','path','platforms','android')], ['ios', path.join('some','path','platforms','ios')], ['android'], ['ios']);
                    expect(platforms.getPlatformApi).toHaveBeenCalledWith('android', path.join('/', 'some', 'path', 'platforms', 'android'));
                    expect(platforms.getPlatformApi).toHaveBeenCalledWith('ios', path.join('/', 'some', 'path', 'platforms', 'ios'));
                    expect(platforms.getPlatformApi).toHaveBeenCalledWith('android');
                    expect(platforms.getPlatformApi).toHaveBeenCalledWith('ios');
                }).fail(function (e) {
                    fail('unexpected failure handler invoked');
                    console.error(e);
                }).done(done);
            });
            it('should invoke restore module\'s installPluginsFromConfigXML method', function (done) {
                prepare({platforms: []}).then(function () {
                    expect(restore.installPluginsFromConfigXML).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('unexpected failure handler invoked');
                    console.error(e);
                }).done(done);
            });
            it('should invoke preparePlatforms method, providing the appropriate platforms', function (done) {
                prepare({platforms: ['android']}).then(function () {
                    expect(prepare.preparePlatforms).toHaveBeenCalledWith(['android'], '/some/path', jasmine.any(Object));
                }).fail(function (e) {
                    fail('unexpected failure handler invoked');
                    console.error(e);
                }).done(done);

            });
            it('should fire the after_prepare hook and provide platform and path information as arguments', function (done) {
                prepare({platforms: ['android']}).then(function () {
                    expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('after_prepare', jasmine.any(Object));
                }).fail(function (e) {
                    fail('unexpected failure handler invoked');
                    console.error(e);
                }).done(done);
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
            spyOn(prepare, 'restoreMissingPluginsForPlatform').and.returnValue(Q());
            cfg_parser_revert_mock = prepare.__set__('ConfigParser', cfg_parser_mock);
            platform_munger_save_mock = jasmine.createSpy('platform munger save mock');
            platform_munger_mock.prototype = jasmine.createSpyObj('platform munger prototype mock', ['add_config_changes']);
            platform_munger_mock.prototype.add_config_changes.and.returnValue({
                save_all: platform_munger_save_mock
            });
            platform_munger_revert_mock = prepare.__set__('PlatformMunger', platform_munger_mock);
            spyOn(util, 'projectConfig').and.returnValue(project_dir);
            spyOn(util, 'projectWww').and.returnValue(path.join(project_dir, 'www'));

        });
        afterEach(function () {
            cfg_parser_revert_mock();
            platform_munger_revert_mock();
        });
        it('should call restoreMissingPluginsForPlatform', function (done) {
            prepare.preparePlatforms(['android'], project_dir, {}).then(function () {
                expect(prepare.restoreMissingPluginsForPlatform).toHaveBeenCalled();
            }).fail(function (e) {
                fail('unexpected failure handler invoked');
                console.error(e);
            }).done(done);
        });
        it('should retrieve the platform API via getPlatformApi per platform provided, and invoke the prepare method from that API', function (done) {
            prepare.preparePlatforms(['android'], project_dir, {}).then(function () {
                expect(platforms.getPlatformApi).toHaveBeenCalledWith('android');
                expect(platform_api_prepare_mock).toHaveBeenCalled();
            }).fail(function (e) {
                fail('unexpected failure handler invoked');
                console.error(e);
            }).done(done);
        });
        it('should fire a pre_package hook for the windows', function (done) {
            prepare.preparePlatforms(['windows'], project_dir, {}).then(function () {
                expect(HooksRunner.prototype.fire).toHaveBeenCalledWith('pre_package', jasmine.any(Object));
            }).fail(function (e) {
                fail('unexpected failure handler invoked');
                console.error(e);
            }).done(done);
        });
        // TODO: xit'ed the one below as dynamic requires make it difficult to spy on
        // Can we refactor the relevant code to make it testable?
        xit('should invoke browserify if the browserify option is provided');
        it('should handle config changes by invoking add_config_changes and save_all', function (done) {
            prepare.preparePlatforms(['android'], project_dir, {}).then(function () {
                expect(platform_munger_mock.prototype.add_config_changes).toHaveBeenCalled();
                expect(platform_munger_save_mock).toHaveBeenCalled();
            }).fail(function (e) {
                fail('unexpected failure handler invoked');
                console.error(e);
            }).done(done);
        });
    });

    describe('restoreMissingPluginsForPlatform helper method', function () {
        var is_plugin_installed_mock;
        var is_plugin_provider_get_mock;
        it('should resolve quickly and not invoke getPlatformAPI in the easy case of there being no difference between old and new platform.json', function (done) {
            is_plugin_installed_mock = jasmine.createSpy('is plugin installed mock');
            // mock platform json value below
            PlatformJson.load.and.callFake(function (platformJsonPath, plat) {
                return {
                    isPluginInstalled: is_plugin_installed_mock,
                    root: {
                        installed_plugins: [],
                        dependent_plugins: []
                    }
                };
            });

            prepare.restoreMissingPluginsForPlatform('android', project_dir, {}).then(function () {
                expect(platforms.getPlatformApi).not.toHaveBeenCalled();
            }).fail(function (e) {
                fail('unexpected failure handler invoked');
                console.error(e);
            }).done(done);
        });
        it('should leverage platform API to remove and add any missing plugins identified', function (done) {
            is_plugin_installed_mock = jasmine.createSpy('is plugin installed mock');
            is_plugin_provider_get_mock = jasmine.createSpy('is plugin provider get mock');
            // mock platform json value below
            PlatformJson.load.and.callFake(function (platformJsonPath, plat) {
                // set different installed plugins to simulate missing plugins
                var missingPlugins;
                if (platformJsonPath === '/some/path/platforms/android') {
                    missingPlugins = {'cordova-plugin-device': {}};
                } else {
                    missingPlugins = {'cordova-plugin-camera': {}};
                }
                return {
                    isPluginInstalled: is_plugin_installed_mock,
                    root: {
                        installed_plugins: missingPlugins,
                        dependent_plugins: []
                    }
                };
            });
            spyOn(PluginInfoProvider.prototype, 'get').and.callFake(function () {
                return is_plugin_provider_get_mock;
            });
            prepare.restoreMissingPluginsForPlatform('android', project_dir, {}).then(function () {
                expect(platforms.getPlatformApi).toHaveBeenCalled();
                expect(platform_api_add_mock).toHaveBeenCalled();
                expect(platform_api_remove_mock).toHaveBeenCalled();
                expect(PluginInfoProvider.prototype.get).toHaveBeenCalled();
            }).fail(function (e) {
                fail('unexpected failure handler invoked');
                console.error(e);
            }).done(done);
        });
    });
});
