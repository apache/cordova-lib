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

const rewire = require('rewire');
const remove = rewire('../../../src/cordova/plugin/remove');
const cordova_util = require('../../../src/cordova/util');
const metadata = require('../../../src/plugman/util/metadata');
const events = require('cordova-common').events;
const plugman = require('../../../src/plugman/plugman');
const fs = require('fs-extra');
const plugin_util = require('../../../src/cordova/plugin/util');

describe('cordova/plugin/remove', function () {
    const projectRoot = '/some/path';
    let hook_mock;
    const cfg_parser_mock = function () {};
    let package_json_mock;
    const plugin_info_provider_mock = function () {};
    const plugin_info = jasmine.createSpyObj('package json mock', ['cordova', 'dependencies']);
    package_json_mock.dependencies = {};
    package_json_mock.cordova = {};
    package_json_mock.cordova.plugins = {};
    beforeEach(function () {
        spyOn(events, 'emit');
        spyOn(fs, 'writeFileSync');
        spyOn(fs, 'existsSync');
        spyOn(remove, 'validatePluginId');
        spyOn(cordova_util, 'listPlatforms').and.returnValue(['ios', 'android']);
        spyOn(plugman.uninstall, 'uninstallPlatform').and.returnValue(Promise.resolve());
        spyOn(plugman.uninstall, 'uninstallPlugin').and.returnValue(Promise.resolve());
        hook_mock = jasmine.createSpyObj('hooks runner mock', ['fire']);
        hook_mock.fire.and.returnValue(Promise.resolve());
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser mock', ['write', 'getPlugin', 'removePlugin']);
        remove.__set__('ConfigParser', cfg_parser_mock);
        plugin_info_provider_mock.prototype = jasmine.createSpyObj('plugin info provider mock', ['get', 'getPreferences']);
        plugin_info_provider_mock.prototype.get = function (directory) {
            // id version dir getPreferences() engines engines.cordovaDependencies name versions
            return plugin_info;
        };
        remove.__set__({
            PluginInfoProvider: plugin_info_provider_mock,
            preparePlatforms: jasmine.createSpy('preparePlatforms')
        });
    });

    describe('error/warning conditions', function () {
        it('should require that a plugin be provided', function () {
            return expectAsync(
                remove(projectRoot, null)
            ).toBeRejectedWithError(/No plugin specified/);
        });

        it('should require that a provided plugin be installed in the current project', function () {
            const opts = { plugins: [undefined] };
            return expectAsync(
                remove(projectRoot, 'plugin', hook_mock, opts)
            ).toBeRejectedWithError(/is not present in the project/);
        });
    });
    describe('happy path', function () {
        it('should fire the before_plugin_rm hook', function () {
            const opts = { important: 'options', plugins: [] };
            return remove(projectRoot, 'cordova-plugin-splashscreen', hook_mock, opts).then(function () {
                expect(hook_mock.fire).toHaveBeenCalledWith('before_plugin_rm', opts);
            });
        });

        it('should call plugman.uninstall.uninstallPlatform for each platform installed in the project and for each provided plugin', function () {
            spyOn(plugin_util, 'mergeVariables');
            remove.validatePluginId.and.returnValue('cordova-plugin-splashscreen');
            const opts = { important: 'options', plugins: ['cordova-plugin-splashscreen'] };
            return remove(projectRoot, 'cordova-plugin-splashscreen', hook_mock, opts).then(function () {
                expect(plugman.uninstall.uninstallPlatform).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('verbose', jasmine.stringMatching('plugman.uninstall on plugin "cordova-plugin-splashscreen" for platform "ios"'));
                expect(events.emit).toHaveBeenCalledWith('verbose', jasmine.stringMatching('plugman.uninstall on plugin "cordova-plugin-splashscreen" for platform "android"'));
            });
        });

        it('should trigger a prepare if plugman.uninstall.uninstallPlatform returned something falsy', function () {
            spyOn(plugin_util, 'mergeVariables');
            remove.validatePluginId.and.returnValue('cordova-plugin-splashscreen');
            plugman.uninstall.uninstallPlatform.and.returnValue(Promise.resolve(false));
            const opts = { important: 'options', plugins: ['cordova-plugin-splashscreen'] };
            return remove(projectRoot, 'cordova-plugin-splashscreen', hook_mock, opts).then(function () {
                expect(plugman.uninstall.uninstallPlatform).toHaveBeenCalled();
            });
        });

        it('should call plugman.uninstall.uninstallPlugin once plugin has been uninstalled for each platform', function () {
            spyOn(plugin_util, 'mergeVariables');
            remove.validatePluginId.and.returnValue('cordova-plugin-splashscreen');
            const opts = { important: 'options', plugins: ['cordova-plugin-splashscreen'] };
            return remove(projectRoot, 'cordova-plugin-splashscreen', hook_mock, opts).then(function () {
                expect(plugman.uninstall.uninstallPlugin).toHaveBeenCalled();
            });
        });

        it('should call uninstallPlugin in order and only finish once all plugins are done', function () {
            const plugins = ['cordova-plugin-ice-cream', 'cordova-plugin-hot-steam'];

            // We delay the uninstall of the first plugin to give the second
            // one the chance to finish early if Promises are handled wrong.
            const observedOrder = [];
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            plugman.uninstall.uninstallPlugin.and.callFake(target => {
                return delay(target.endsWith('cream') ? 100 : 0)
                    .then(_ => observedOrder.push(target));
            });

            spyOn(plugin_util, 'mergeVariables');
            remove.validatePluginId.and.returnValues(...plugins);

            return remove(projectRoot, plugins, hook_mock, { plugins })
                .then(_ => expect(observedOrder).toEqual(plugins));
        });

        describe('when save option is provided or autosave config is on', function () {
            let opts;

            beforeEach(function () {
                spyOn(plugin_util, 'mergeVariables');
                spyOn(cordova_util, 'projectConfig').and.returnValue('config.xml');
                spyOn(cordova_util, 'findPlugins').and.returnValue([]);
                spyOn(metadata, 'remove_fetch_metadata').and.returnValue(true);
                fs.existsSync.and.returnValue(true);
                remove.validatePluginId.and.returnValue('cordova-plugin-splashscreen');

                opts = {
                    save: true,
                    important: 'options',
                    plugins: ['cordova-plugin-splashscreen']
                };
            });

            it('should remove provided plugins from config.xml', function () {
                spyOn(cordova_util, 'requireNoCache').and.returnValue(true);
                cfg_parser_mock.prototype.getPlugin.and.returnValue({});
                return remove(projectRoot, 'cordova-plugin-splashscreen', hook_mock, opts).then(function () {
                    expect(cfg_parser_mock.prototype.removePlugin).toHaveBeenCalled();
                    expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
                    expect(events.emit).toHaveBeenCalledWith('log', jasmine.stringMatching('Removing plugin cordova-plugin-splashscreen from config.xml file'));
                });
            });

            it('should remove provided plugins from package.json (if exists)', function () {
                spyOn(fs, 'readFileSync').and.returnValue('file');
                spyOn(cordova_util, 'requireNoCache').and.returnValue(package_json_mock);
                return remove(projectRoot, 'cordova-plugin-splashscreen', hook_mock, opts).then(function () {
                    expect(fs.writeFileSync).toHaveBeenCalled();
                    expect(events.emit).toHaveBeenCalledWith('log', jasmine.stringMatching('Removing cordova-plugin-splashscreen from package.json'));
                });
            });
        });

        it('should remove fetch metadata from fetch.json', function () {
            plugin_info_provider_mock.prototype.getPreferences.and.returnValue(true);
            spyOn(plugin_util, 'mergeVariables');
            spyOn(metadata, 'remove_fetch_metadata').and.callThrough();
            remove.validatePluginId.and.returnValue('cordova-plugin-splashscreen');
            const opts = { important: 'options', plugins: ['cordova-plugin-splashscreen'] };
            return remove(projectRoot, 'cordova-plugin-splashscreen', hook_mock, opts).then(function () {
                expect(metadata.remove_fetch_metadata).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('verbose', jasmine.stringMatching('Removing plugin cordova-plugin-splashscreen from fetch.json'));
            });
        });

        it('should fire the after_plugin_rm hook', function () {
            const opts = { important: 'options', plugins: [] };
            return remove(projectRoot, 'cordova-plugin-splashscreen', hook_mock, opts).then(function () {
                expect(hook_mock.fire).toHaveBeenCalledWith('after_plugin_rm', opts);
            });
        });
    });
});
