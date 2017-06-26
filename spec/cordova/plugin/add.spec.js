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
// TODO: remove once eslint lands
/* eslint-env jasmine */
/* globals fail */

var Q = require('q');
var rewire = require('rewire');
var add = rewire('../../src/cordova/plugin/add');
var plugman = require('../../src/plugman/plugman');
var cordova_util = require('../../src/cordova/util');
var path = require('path');
var fs = require('fs');
var config = require('../../src/cordova/config');

describe('cordova/plugin/add', function () {
    var projectRoot = '/some/path';
    var hook_mock;
    var cfg_parser_mock = function () {};
    var cfg_parser_revert_mock;
    var plugin_info_provider_mock = function () {};
    var plugin_info_provider_revert_mock;
    var plugin_info;

    beforeEach(function () {
        hook_mock = jasmine.createSpyObj('hooks runner mock', ['fire']);
        hook_mock.fire.and.returnValue(Q());
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser prototype mock', ['getPlugin', 'removePlugin', 'addPlugin', 'write']);
        cfg_parser_mock.prototype.getPlugin.and.callFake(function (pluginId) {});
        cfg_parser_mock.prototype.removePlugin.and.callFake(function () {});
        cfg_parser_mock.prototype.addPlugin.and.callFake(function () {});
        cfg_parser_mock.prototype.write.and.callFake(function () {});
        cfg_parser_revert_mock = add.__set__('ConfigParser', cfg_parser_mock);
        plugin_info = jasmine.createSpyObj('pluginInfo', ['getPreferences']);
        plugin_info.getPreferences.and.returnValue({});
        plugin_info.dir = 'some\plugin\path';
        plugin_info.id = 'cordova-plugin-device';
        plugin_info.version = '1.0.0';
        plugin_info_provider_mock.prototype = jasmine.createSpyObj('plugin info provider mock', ['get']);
        plugin_info_provider_mock.prototype.get = function (directory) {
            console.log('fake get');
            //id version dir getPreferences() engines engines.cordovaDependencies name versions
            return plugin_info;
        };
        plugin_info_provider_revert_mock = add.__set__('PluginInfoProvider', plugin_info_provider_mock);
        spyOn(fs,'existsSync').and.returnValue(false);
        spyOn(fs,'writeFileSync').and.returnValue(false);
        //requireNoCache is used to require package.json
        spyOn(cordova_util, 'requireNoCache').and.returnValue({});
    });
    afterEach(function () {
        cfg_parser_revert_mock();
        plugin_info_provider_revert_mock();
    });
    describe('main method', function () {

        beforeEach(function () {
            spyOn(add,'determinePluginTarget').and.callFake(function(projRoot, cfg, target, opts) {
                return Q(target);
            });
            spyOn(plugman, 'fetch').and.callFake(function (target, pluginPath, opts) {
                return Q(target);
            });
            spyOn(plugman, 'install').and.returnValue(Q(true));
            spyOn(cordova_util, 'listPlatforms').and.callFake(function () {
                return ['android'];
            });
            spyOn(cordova_util,'findPlugins').and.returnValue({plugins:[]});
            spyOn(config, 'read').and.returnValue({});
        });
        describe('error/warning conditions', function () {
            it('should error out if at least one plugin is not specified', function (done) {
                add(projectRoot, hook_mock, {plugins: []}).then(function () {
                    fail('success handler unexpectedly invoked');
                }).fail(function (e) {
                    expect(e.message).toContain('No plugin specified');
                }).done(done);
            });
            it('should error out if any mandatory plugin variables are not provided', function (done) {
                plugin_info.getPreferences.and.returnValue({'some':undefined});

                add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    fail('success handler unexpectedly invoked');
                }).fail(function (e) {
                    expect(e.message).toContain('Variable(s) missing (use: --variable');
                }).done(done);
            });
        });
        describe('happy path', function () {
            it('should fire the before_plugin_add hook', function (done) {
                add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    expect(hook_mock.fire).toHaveBeenCalledWith('before_plugin_add', jasmine.any(Object)); 
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.log(e);
                }).done(done);
            });
            it('should determine where to fetch a plugin from using determinePluginTarget and invoke plugman.fetch with the resolved target', function (done) {
                add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    expect(add.determinePluginTarget).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), 'cordova-plugin-device', jasmine.any(Object)); 
                    expect(plugman.fetch).toHaveBeenCalledWith('cordova-plugin-device', path.join(projectRoot,'plugins'), jasmine.any(Object));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.log(e);
                }).done(done);
            });
            it('should retrieve any variables for the plugin from config.xml and add them as cli variables only when the variables were not already provided via options', function (done) {
                var cfg_plugin_variables = {'some':'variable'};
                cfg_parser_mock.prototype.getPlugin.and.callFake(function (plugin_id) {
                    return {'variables': cfg_plugin_variables};
                });
                add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    //confirm cli_variables are undefind
                    expect(add.determinePluginTarget.calls.argsFor(0)[3]['variables']).toBeUndefined;
                    expect(plugman.install).toHaveBeenCalled();
                    //check that the plugin variables from config.xml got added to cli_variables
                    expect(plugman.install.calls.argsFor(0)[4]['cli_variables']).toEqual(cfg_plugin_variables);
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.log(e);
                }).done(done);
            });
            it('should invoke plugman.install for each platform added to the project', function (done) {
                add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    expect(plugman.install).toHaveBeenCalledWith('android', jasmine.any(String), jasmine.any(String), jasmine.any(String), jasmine.any(Object));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.log(e);
                }).done(done);
            });
            it('should save plugin variable information to package.json file (if exists)', function (done) {
                var cli_plugin_variables = {'some':'variable'};

                fs.existsSync.and.returnValue(true);

                add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device'], cli_variables: cli_plugin_variables, save:'true'}).then(function () {
                    expect(fs.writeFileSync).toHaveBeenCalledWith(jasmine.any(String), JSON.stringify({'cordova':{'plugins':{'cordova-plugin-device':cli_plugin_variables}}}, null, 2), 'utf8');
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.log(e);
                }).done(done);
            });
            it('should overwrite plugin information in config.xml after a successful installation', function (done) {
                var cfg_plugin_variables = {'some':'variable'};
                var cli_plugin_variables = {'some':'new_variable'};
                cfg_parser_mock.prototype.getPlugin.and.callFake(function (plugin_id) {
                    return {'variables': cfg_plugin_variables};
                });

                add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device'], cli_variables: cli_plugin_variables, save:'true'}).then(function () {
                    //confirm cli_variables got passed through
                    expect(add.determinePluginTarget.calls.argsFor(0)[3]['variables']).toEqual(cli_plugin_variables);
                    //check that the plugin variables from config.xml got added to cli_variables
                    expect(plugman.install.calls.argsFor(0)[4]['cli_variables']).toEqual(cli_plugin_variables);
                    expect(cfg_parser_mock.prototype.removePlugin).toHaveBeenCalledWith('cordova-plugin-device');
                    expect(cfg_parser_mock.prototype.addPlugin).toHaveBeenCalledWith(jasmine.any(Object), cli_plugin_variables);
                    expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.log(e);
                }).done(done);
            });
            //can't test the following due to inline require of preparePlatforms
            xit('should invoke preparePlatforms if plugman.install returned a falsey value', function () {
                plugman.install.and.returnValue(false);
            });
            it('should fire after_plugin_add hook', function (done) {
                add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    expect(hook_mock.fire).toHaveBeenCalledWith('after_plugin_add', jasmine.any(Object)); 
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.log(e);
                }).done(done);
            });
        });
    });
    describe('determinePluginTarget helper method', function () {
        it('should return the target directly if the target is pluginSpec-parseable');
        it('should return the target directly if the target is a URL');
        it('should return the target directly if the target is a directory');
        it('should retrieve plugin version from package.json (if exists)');
        it('should retrieve plugin version from config.xml as a last resort');
        describe('with fetchOptions.save=true, writing out plugin versions retrieved from config files (either config.xml or package.json)', function () {
            it('should write out URL-as-plugin-spec to package.json');
            it('should write out directory-as-plugin-spec to package.json');
        });
        it('should return plugin version retrieved from package.json or config.xml if it is a URL');
        it('should return plugin version retrieved from package.json or config.xml if it is a directory');
        it('should return plugin version retrieved from package.json or config.xml if it has a scope');
        it('should return plugin-id@plugin-version if retrieved from package.json or config.xml ');
        describe('with no version inferred from config files or provided plugin target', function () {
            describe('when searchpath or noregistry flag is provided', function () {
                it('should end up just returning the target passed in');
            });
            describe('when registry/npm is to be used (neither searchpath nor noregistry flag is provided)', function () {
                it('should retrieve plugin info via registry.info');
                it('should feed registry.info plugin information into getFetchVersion');
                it('should return the target as plugin-id@fetched-version');
            });
        });
    });
    // TODO: reorganize these tests once the logic here is understood! -filmaj
    // TODO: rewrite the tests from integration-tests/plugin_fetch.spec.js to here.
    describe('TODO! unit tests to replace integration-tests/plugin_fetch.spec.js', function () {
        describe('getFetchVersion helper method', function () {
            it('should resolve with null if plugin info does not contain engines and engines.cordovaDependencies properties');
            it('should retrieve platform version info via getInstalledPlatformsWithVersions and feed that information into determinePluginVersionToFetch');
        });
        describe('determinePluginVersionToFetch helper method', function () {
            it('should return null if no valid semver versions exist and no upperbound constraints were placed');
        });
        describe('getFailedRequirements helper method', function () {
        });
    });
});
