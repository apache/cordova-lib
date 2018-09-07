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
var rewire = require('rewire');
var add = rewire('../../../src/cordova/plugin/add');
var plugman = require('../../../src/plugman/plugman');
var cordova_util = require('../../../src/cordova/util');
var path = require('path');
var fs = require('fs-extra');
var config = require('../../../src/cordova/config');
var events = require('cordova-common').events;
var plugin_util = require('../../../src/cordova/plugin/util');

describe('cordova/plugin/add', function () {
    var projectRoot = '/some/path';
    var hook_mock;
    var Cfg_parser_mock = function () {};
    var cfg_parser_revert_mock;
    var plugin_info_provider_mock = function () {};
    var plugin_info_provider_revert_mock;
    var plugin_info;
    var package_json_mock;

    beforeEach(function () {
        hook_mock = jasmine.createSpyObj('hooks runner mock', ['fire']);
        hook_mock.fire.and.returnValue(Q());
        Cfg_parser_mock.prototype = jasmine.createSpyObj('config parser prototype mock', ['getPlugin', 'removePlugin', 'addPlugin', 'write']);
        cfg_parser_revert_mock = add.__set__('ConfigParser', Cfg_parser_mock);
        plugin_info = jasmine.createSpyObj('pluginInfo', ['getPreferences']);
        plugin_info.getPreferences.and.returnValue({});
        plugin_info.dir = 'some\\plugin\\path';
        plugin_info.id = 'cordova-plugin-device';
        plugin_info.version = '1.0.0';
        plugin_info_provider_mock.prototype = jasmine.createSpyObj('plugin info provider mock', ['get']);
        plugin_info_provider_mock.prototype.get = function (directory) {
            // id version dir getPreferences() engines engines.cordovaDependencies name versions
            return plugin_info;
        };
        plugin_info_provider_revert_mock = add.__set__('PluginInfoProvider', plugin_info_provider_mock);
        spyOn(fs, 'existsSync').and.returnValue(false);
        spyOn(fs, 'writeFileSync');
        package_json_mock = jasmine.createSpyObj('package json mock', ['cordova', 'dependencies', 'devDependencies']);
        package_json_mock.cordova = {};
        package_json_mock.dependencies = {};
        package_json_mock.devDependencies = {};
        // requireNoCache is used to require package.json
        spyOn(cordova_util, 'requireNoCache').and.returnValue(package_json_mock);
        spyOn(events, 'emit');
        spyOn(plugin_util, 'info').and.returnValue(Q());
        spyOn(add, 'getFetchVersion').and.returnValue(Q());
        spyOn(plugin_util, 'saveToConfigXmlOn').and.returnValue(true);
    });
    afterEach(function () {
        cfg_parser_revert_mock();
        plugin_info_provider_revert_mock();
    });
    describe('main method', function () {

        beforeEach(function () {
            spyOn(add, 'determinePluginTarget').and.callFake(function (projRoot, cfg, target, opts) {
                return Q(target);
            });
            spyOn(plugman, 'fetch').and.callFake(function (target, pluginPath, opts) {
                return Q(target);
            });
            spyOn(plugman, 'install').and.returnValue(Q(true));
            spyOn(cordova_util, 'listPlatforms').and.callFake(function () {
                return ['android'];
            });
            spyOn(cordova_util, 'findPlugins').and.returnValue({plugins: []});
            spyOn(config, 'read').and.returnValue({});
        });
        describe('error/warning conditions', function () {
            it('should error out if at least one plugin is not specified', function () {
                return add(projectRoot, hook_mock, {plugins: []}).then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toContain('No plugin specified');
                });
            });
            it('should error out if any mandatory plugin variables are not provided', function () {
                plugin_info.getPreferences.and.returnValue({'some': undefined});

                return add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                    expect(err.message).toContain('Variable(s) missing (use: --variable');
                });
            });
        });
        describe('happy path', function () {
            it('should fire the before_plugin_add hook', function () {
                return add(projectRoot, hook_mock, {plugins: ['https://github.com/apache/cordova-plugin-device'], save: true}).then(function () {
                    expect(hook_mock.fire).toHaveBeenCalledWith('before_plugin_add', jasmine.any(Object));
                });
            });
            it('should determine where to fetch a plugin from using determinePluginTarget and invoke plugman.fetch with the resolved target', function () {
                return add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    expect(add.determinePluginTarget).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), 'cordova-plugin-device', jasmine.any(Object));
                    expect(plugman.fetch).toHaveBeenCalledWith('cordova-plugin-device', path.join(projectRoot, 'plugins'), jasmine.any(Object));
                });
            });
            it('should retrieve any variables for the plugin from config.xml and add them as cli variables only when the variables were not already provided via options', function () {
                var cfg_plugin_variables = {'some': 'variable'};
                Cfg_parser_mock.prototype.getPlugin.and.callFake(function (plugin_id) {
                    return {'variables': cfg_plugin_variables};
                });
                return add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    // confirm cli_variables are undefind
                    expect(add.determinePluginTarget).toHaveBeenCalledWith(jasmine.anything(), jasmine.anything(), jasmine.anything(), jasmine.objectContaining({'variables': undefined}));
                    expect(plugman.install).toHaveBeenCalled();
                    // check that the plugin variables from config.xml got added to cli_variables
                    expect(plugman.install).toHaveBeenCalledWith(jasmine.anything(), jasmine.anything(), jasmine.anything(), jasmine.anything(), jasmine.objectContaining({'cli_variables': cfg_plugin_variables}));
                });
            });
            it('should invoke plugman.install for each platform added to the project', function () {
                return add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    expect(plugman.install).toHaveBeenCalledWith('android', jasmine.any(String), jasmine.any(String), jasmine.any(String), jasmine.any(Object));
                });
            });
            it('should save plugin variable information to package.json file (if exists)', function () {
                var cli_plugin_variables = {'some': 'variable'};

                fs.existsSync.and.callFake(function (file_path) {
                    if (path.basename(file_path) === 'package.json') {
                        return true;
                    } else {
                        return false;
                    }
                });

                spyOn(fs, 'readFileSync').and.returnValue('file');
                return add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device'], cli_variables: cli_plugin_variables, save: 'true'}).then(function () {
                    expect(fs.writeFileSync).toHaveBeenCalledWith(jasmine.any(String), JSON.stringify({'cordova': {'plugins': {'cordova-plugin-device': cli_plugin_variables}}, 'dependencies': {}, 'devDependencies': {}}, null, 2), 'utf8');
                });
            });
            it('should overwrite plugin information in config.xml after a successful installation', function () {
                var cfg_plugin_variables = {'some': 'variable'};
                var cli_plugin_variables = {'some': 'new_variable'};
                Cfg_parser_mock.prototype.getPlugin.and.callFake(function (plugin_id) {
                    return {'variables': cfg_plugin_variables};
                });

                return add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device'], cli_variables: cli_plugin_variables, save: 'true'}).then(function () {
                    // confirm cli_variables got passed through
                    expect(add.determinePluginTarget).toHaveBeenCalledWith(jasmine.anything(), jasmine.anything(), jasmine.anything(), jasmine.objectContaining({'variables': cli_plugin_variables}));
                    // check that the plugin variables from config.xml got added to cli_variables
                    expect(plugman.install).toHaveBeenCalledWith(jasmine.anything(), jasmine.anything(), jasmine.anything(), jasmine.anything(), jasmine.objectContaining({'cli_variables': cli_plugin_variables}));
                    expect(Cfg_parser_mock.prototype.removePlugin).toHaveBeenCalledWith('cordova-plugin-device');
                    expect(Cfg_parser_mock.prototype.addPlugin).toHaveBeenCalledWith(jasmine.any(Object), cli_plugin_variables);
                    expect(Cfg_parser_mock.prototype.write).toHaveBeenCalled();
                });
            });
            // can't test the following due to inline require of preparePlatforms
            xit('should invoke preparePlatforms if plugman.install returned a falsey value', function () {
                plugman.install.and.returnValue(false);
            });
            it('should fire after_plugin_add hook', function () {
                return add(projectRoot, hook_mock, {plugins: ['cordova-plugin-device']}).then(function () {
                    expect(hook_mock.fire).toHaveBeenCalledWith('after_plugin_add', jasmine.any(Object));
                });
            });
        });
    });
    describe('determinePluginTarget helper method', function () {
        beforeEach(function () {
            spyOn(cordova_util, 'isDirectory').and.returnValue(false);
            spyOn(add, 'getVersionFromConfigFile').and.returnValue(undefined);
            package_json_mock.dependencies['cordova-plugin-device'] = undefined;
        });
        afterEach(function () {
        });
        it('should return the target directly if the target is pluginSpec-parseable', function () {
            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device@1.0.0', {}).then(function (target) {
                expect(target).toEqual('cordova-plugin-device@1.0.0');
            });
        });
        it('should return the target directly if the target is a URL', function () {
            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'https://github.com/apache/cordova-plugin-device.git', {}).then(function (target) {
                expect(target).toEqual('https://github.com/apache/cordova-plugin-device.git');
            });
        });
        it('should return the target directly if the target is a directory', function () {
            cordova_util.isDirectory.and.returnValue(true);
            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, '../some/dir/cordova-plugin-device', {}).then(function (target) {
                expect(target).toEqual('../some/dir/cordova-plugin-device');
            });
        });
        it('should retrieve plugin version from package.json (if exists)', function () {
            fs.existsSync.and.callFake(function (file_path) {
                if (path.basename(file_path) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });

            package_json_mock.dependencies['cordova-plugin-device'] = '^1.0.0';

            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {}).then(function (target) {
                expect(target).toEqual('cordova-plugin-device@^1.0.0');
            });
        });
        it('should retrieve plugin version from package.json devDependencies (if exists)', function () {
            fs.existsSync.and.callFake(function (file_path) {
                if (path.basename(file_path) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });

            package_json_mock.devDependencies['cordova-plugin-device'] = '^1.0.0';

            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {}).then(function (target) {
                expect(target).toEqual('cordova-plugin-device@^1.0.0');
            });
        });
        it('should retrieve plugin version from config.xml as a last resort', function () {
            add.getVersionFromConfigFile.and.returnValue('~1.0.0');
            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {}).then(function (target) {
                expect(add.getVersionFromConfigFile).toHaveBeenCalled();
                expect(target).toEqual('cordova-plugin-device@~1.0.0');
            });
        });
        it('should return plugin version retrieved from package.json or config.xml if it is a URL', function () {
            fs.existsSync.and.callFake(function (file_path) {
                if (path.basename(file_path) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });

            package_json_mock.dependencies['cordova-plugin-device'] = 'https://github.com/apache/cordova-plugin-device.git';

            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {}).then(function (target) {
                expect(target).toEqual('https://github.com/apache/cordova-plugin-device.git');
            });
        });
        it('should return plugin version retrieved from package.json or config.xml if it is a directory', function () {
            fs.existsSync.and.callFake(function (file_path) {
                if (path.basename(file_path) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });
            cordova_util.isDirectory.and.callFake(function (dir) {
                if (dir === '../some/dir/cordova-plugin-device') {
                    return true;
                }
                return false;
            });
            package_json_mock.dependencies['cordova-plugin-device'] = '../some/dir/cordova-plugin-device';

            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {}).then(function (target) {
                expect(target).toEqual('../some/dir/cordova-plugin-device');
            });
        });
        it('should return plugin version retrieved from package.json or config.xml if it has a scope', function () {
            fs.existsSync.and.callFake(function (file_path) {
                if (path.basename(file_path) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });

            package_json_mock.dependencies['@cordova/cordova-plugin-device'] = '^1.0.0';

            return add.determinePluginTarget(projectRoot, Cfg_parser_mock, '@cordova/cordova-plugin-device', {}).then(function (target) {
                expect(target).toEqual('@cordova/cordova-plugin-device@^1.0.0');
            });
        });
        describe('with no version inferred from config files or provided plugin target', function () {
            describe('when searchpath or noregistry flag is provided', function () {
                it('should end up just returning the target passed in case of searchpath', function () {
                    return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {'searchpath': 'some/path'})
                        .then(function (target) {
                            expect(target).toEqual('cordova-plugin-device');
                            expect(events.emit).toHaveBeenCalledWith('verbose', 'Not checking npm info for cordova-plugin-device because searchpath or noregistry flag was given');
                        });
                });
                it('should end up just returning the target passed in case of noregistry', function () {
                    return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {'noregistry': true})
                        .then(function (target) {
                            expect(target).toEqual('cordova-plugin-device');
                            expect(events.emit).toHaveBeenCalledWith('verbose', 'Not checking npm info for cordova-plugin-device because searchpath or noregistry flag was given');
                        });
                });
            });
            describe('when registry/npm is to be used (neither searchpath nor noregistry flag is provided)', function () {
                it('should retrieve plugin info via registry.info', function () {
                    return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {})
                        .then(function (target) {
                            expect(plugin_util.info).toHaveBeenCalledWith(['cordova-plugin-device']);
                            expect(events.emit).toHaveBeenCalledWith('verbose', 'Attempting to use npm info for cordova-plugin-device to choose a compatible release');
                            expect(target).toEqual('cordova-plugin-device');
                        });
                });
                it('should feed registry.info plugin information into getFetchVersion', function () {
                    plugin_util.info.and.returnValue(Q({'plugin': 'info'}));
                    return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {})
                        .then(function (target) {
                            expect(plugin_util.info).toHaveBeenCalled();
                            expect(add.getFetchVersion).toHaveBeenCalledWith(jasmine.anything(), {'plugin': 'info'}, jasmine.anything());
                            expect(target).toEqual('cordova-plugin-device');
                            expect(events.emit).toHaveBeenCalledWith('verbose', 'Attempting to use npm info for cordova-plugin-device to choose a compatible release');
                        });
                });
                it('should return the target as plugin-id@fetched-version', function () {
                    add.getFetchVersion.and.returnValue(Q('1.0.0'));
                    return add.determinePluginTarget(projectRoot, Cfg_parser_mock, 'cordova-plugin-device', {})
                        .then(function (target) {
                            expect(plugin_util.info).toHaveBeenCalled();
                            expect(add.getFetchVersion).toHaveBeenCalled();
                            expect(target).toEqual('cordova-plugin-device@1.0.0');
                            expect(events.emit).toHaveBeenCalledWith('verbose', 'Attempting to use npm info for cordova-plugin-device to choose a compatible release');
                        });
                });
            });
        });
    });
    describe('parseSource helper method', function () {
        it('should return target when url is passed', function () {
            expect(add.parseSource('https://github.com/apache/cordova-plugin-device', {})).toEqual('https://github.com/apache/cordova-plugin-device');
        });
        it('should return target when local path is passed', function () {
            fs.existsSync.and.returnValue(true);
            expect(add.parseSource('../cordova-plugin-device', {})).toEqual('../cordova-plugin-device');
        });
        it('should return null when target is not url or local path', function () {
            expect(add.parseSource('cordova-plugin-device', {})).toEqual(null);
        });
    });
    describe('getVersionFromConfigFile helper method', function () {
        it('should return spec', function () {
            var fakePlugin = {};
            fakePlugin.name = '';
            fakePlugin.spec = '1.0.0';
            fakePlugin.variables = {};

            Cfg_parser_mock.prototype.getPlugin.and.returnValue(fakePlugin);
            var new_cfg = new Cfg_parser_mock();
            expect(add.getVersionFromConfigFile('cordova-plugin-device', new_cfg)).toEqual('1.0.0');
        });
    });

    // TODO: reorganize these tests once the logic here is understood! -filmaj
    // TODO: rewrite the tests from integration-tests/plugin_fetch.spec.js to here.
    describe('unit tests to replace integration-tests/plugin_fetch.spec.js', function () {
        describe('getFetchVersion helper method', function () {
            var pluginInfo;

            beforeEach(function () {
                add.getFetchVersion.and.callThrough();
                pluginInfo = {};
                spyOn(plugin_util, 'getInstalledPlugins').and.returnValue([]);
                spyOn(cordova_util, 'getInstalledPlatformsWithVersions').and.returnValue(Q({}));
                spyOn(add, 'determinePluginVersionToFetch');
            });
            it('should resolve with null if plugin info does not contain engines and engines.cordovaDependencies properties', function () {
                return add.getFetchVersion(projectRoot, pluginInfo, '7.0.0')
                    .then(function (value) {
                        expect(value).toBe(null);
                    });
            });
            it('should retrieve installed plugins and installed platforms version and feed that information into determinePluginVersionToFetch', function () {
                plugin_util.getInstalledPlugins.and.returnValue([{'id': 'cordova-plugin-camera', 'version': '2.0.0'}]);
                cordova_util.getInstalledPlatformsWithVersions.and.returnValue(Q({'android': '6.0.0'}));
                pluginInfo.engines = {};
                pluginInfo.engines.cordovaDependencies = {'^1.0.0': {'cordova': '>7.0.0'}};
                return add.getFetchVersion(projectRoot, pluginInfo, '7.0.0')
                    .then(function () {
                        expect(plugin_util.getInstalledPlugins).toHaveBeenCalledWith(projectRoot);
                        expect(cordova_util.getInstalledPlatformsWithVersions).toHaveBeenCalledWith(projectRoot);
                        expect(add.determinePluginVersionToFetch).toHaveBeenCalledWith(pluginInfo, {'cordova-plugin-camera': '2.0.0'}, {'android': '6.0.0'}, '7.0.0');
                    });
            });
        });
        // TODO More work to be done here to replace plugin_fetch.spec.js
        describe('determinePluginVersionToFetch helper method', function () {
            var pluginInfo;
            beforeEach(function () {
                pluginInfo = {};
                pluginInfo.name = 'cordova-plugin-device';
                pluginInfo.versions = ['0.1.0', '1.0.0', '1.5.0', '2.0.0'];
                spyOn(add, 'getFailedRequirements').and.returnValue([]);
                spyOn(add, 'findVersion').and.returnValue(null);
                spyOn(add, 'listUnmetRequirements');
            });
            it('should return null if no valid semver versions exist and no upperbound constraints were placed', function () {
                pluginInfo.engines = {};
                pluginInfo.engines.cordovaDependencies = {'^1.0.0': {'cordova': '<7.0.0'}};
                expect(add.determinePluginVersionToFetch(pluginInfo, {}, {}, '7.0.0')).toBe(null);
                expect(events.emit).toHaveBeenCalledWith('verbose', jasmine.stringMatching(/Ignoring invalid version/));
            });
            it('should return null and fetching latest version of plugin', function () {
                add.getFailedRequirements.and.returnValue(['2.0.0']);
                pluginInfo.engines = {};
                pluginInfo.engines.cordovaDependencies = {'1.0.0': {'cordova': '<7.0.0'}, '<3.0.0': {'cordova': '>=7.0.0'}};
                expect(add.determinePluginVersionToFetch(pluginInfo, {}, {}, '7.0.0')).toBe(null);
                expect(events.emit).toHaveBeenCalledWith('warn', jasmine.stringMatching(/Current project does not satisfy/));
            });
            it('should return highest version of plugin available based on constraints', function () {
                pluginInfo.engines = {};
                pluginInfo.engines.cordovaDependencies = {'1.0.0': {'cordova': '<7.0.0'}, '<3.0.0': {'cordova': '>=7.0.0'}};
                expect(add.determinePluginVersionToFetch(pluginInfo, {}, {}, '7.0.0')).toEqual('2.0.0');
            });
        });
        describe('getFailedRequirements helper method', function () {
            it('should remove prerelease version', function () {
                var semver = require('semver');
                spyOn(semver, 'prerelease').and.returnValue('7.0.1');
                spyOn(semver, 'inc').and.callThrough();
                expect(add.getFailedRequirements({'cordova': '>=7.0.0'}, {}, {}, '7.0.0').length).toBe(0);
                expect(semver.inc).toHaveBeenCalledWith('7.0.0', 'patch');
            });
            it('should return an empty array if no failed requirements', function () {
                expect(add.getFailedRequirements({'cordova': '>=7.0.0'}, {}, {}, '7.0.0').length).toBe(0);
            });
            it('should return an empty array if invalid dependency constraint', function () {
                expect(add.getFailedRequirements({1: 'wrong'}, {}, {}, '7.0.0').length).toBe(0);
                expect(events.emit).toHaveBeenCalledWith('verbose', jasmine.stringMatching(/Ignoring invalid plugin dependency constraint/));
            });
            it('should return an array with failed plugin requirements ', function () {
                expect(add.getFailedRequirements({'cordova-plugin-camera': '>1.0.0'}, {'cordova-plugin-camera': '1.0.0'}, {}, '7.0.0')).toEqual([{ dependency: 'cordova-plugin-camera', installed: '1.0.0', required: '>1.0.0' }]);
            });
            it('should return an array with failed cordova requirements ', function () {
                expect(add.getFailedRequirements({'cordova': '>=7.0.0'}, {}, {}, '6.5.0')).toEqual([{ dependency: 'cordova', installed: '6.5.0', required: '>=7.0.0' }]);
            });
            it('should return an array with failed platform requirements ', function () {
                expect(add.getFailedRequirements({'cordova-android': '>=6.0.0'}, {}, {'android': '5.5.0'}, '7.0.0')).toEqual([{ dependency: 'cordova-android', installed: '5.5.0', required: '>=6.0.0' }]);
            });
        });
        describe('listUnmetRequirements helper method', function () {
            it('should emit warnings for failed requirements', function () {
                add.listUnmetRequirements('cordova-plugin-device', [{ dependency: 'cordova', installed: '6.5.0', required: '>=7.0.0' }]);
                expect(events.emit).toHaveBeenCalledWith('warn', 'Unmet project requirements for latest version of cordova-plugin-device:');
                expect(events.emit).toHaveBeenCalledWith('warn', '    cordova (6.5.0 in project, >=7.0.0 required)');
            });
        });
        describe('findVersion helper method', function () {
            it('should return null if version is not in array', function () {
                expect(add.findVersion(['0.0.1', '1.0.0', '2.0.0'], '0.0.0')).toEqual(null);
            });
            it('should return the version if it is in the array', function () {
                expect(add.findVersion(['0.0.1', '1.0.0', '2.0.0'], '1.0.0')).toEqual('1.0.0');
            });
        });
    });
});
