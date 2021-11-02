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
const plugin_util = rewire('../../../src/cordova/plugin/util');
const fs = require('fs-extra');
const events = require('cordova-common').events;

describe('cordova/plugin/util', function () {
    const plugin_info_mock = function () {};
    const cfg_parser_mock = function () {};
    beforeEach(function () {
        spyOn(fs, 'removeSync');
        spyOn(events, 'emit');
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser protytpe mock', ['getPlugin']);
        plugin_util.__set__('ConfigParser', cfg_parser_mock);
        plugin_info_mock.prototype = jasmine.createSpyObj('plugin info provider prototype mock', ['getAllWithinSearchPath', 'getPreferences']);
        plugin_util.__set__('PluginInfoProvider', plugin_info_mock);
    });
    describe('getInstalledPlugins helper method', function () {
        it('should return result of PluginInfoProvider\'s getAllWithinSearchPath method', function () {
            const plugins_list = ['VRPlugin', 'MastodonSocialPlugin'];
            plugin_info_mock.prototype.getAllWithinSearchPath.and.returnValue(plugins_list);
            expect(plugin_util.getInstalledPlugins('/some/path/to/a/project')).toEqual(plugins_list);
        });
    });
    describe('mergeVariables happy path', function () {
        it('should return variable from cli', function () {
            cfg_parser_mock.prototype.getPlugin.and.returnValue(undefined);
            plugin_info_mock.prototype.getPreferences.and.returnValue({});
            const opts = { cli_variables: { FCM_VERSION: '9.0.0' } };
            expect(plugin_util.mergeVariables(plugin_info_mock.prototype, cfg_parser_mock.prototype, opts)).toEqual({ FCM_VERSION: '9.0.0' });
        });
        it('should return empty object if there are no config and no cli variables', function () {
            cfg_parser_mock.prototype.getPlugin.and.returnValue(undefined);
            plugin_info_mock.prototype.getPreferences.and.returnValue({});
            const opts = { cli_variables: {} };
            expect(plugin_util.mergeVariables(plugin_info_mock.prototype, cfg_parser_mock.prototype, opts)).toEqual({});
        });
        it('cli variable takes precedence over config.xml', function () {
            cfg_parser_mock.prototype.getPlugin.and.returnValue(undefined);
            plugin_info_mock.prototype.getPreferences.and.returnValue({
                name: 'phonegap-plugin-push',
                spec: '/Users/auso/cordova/phonegap-plugin-push',
                variables: { FCM_VERSION: '11.0.1' }
            });
            const opts = { cli_variables: { FCM_VERSION: '9.0.0' } };
            expect(plugin_util.mergeVariables(plugin_info_mock.prototype, cfg_parser_mock.prototype, opts)).toEqual({ FCM_VERSION: '9.0.0' });
        });
        it('use config.xml variable if no cli variable is passed in', function () {
            cfg_parser_mock.prototype.getPlugin.and.returnValue({
                name: 'phonegap-plugin-push',
                spec: '/Users/auso/cordova/phonegap-plugin-push',
                variables: { FCM_VERSION: '11.0.1' }
            });
            plugin_info_mock.prototype.getPreferences.and.returnValue({});
            const opts = { cli_variables: {} };
            expect(plugin_util.mergeVariables(plugin_info_mock.prototype, cfg_parser_mock.prototype, opts)).toEqual({ FCM_VERSION: '11.0.1' });
        });
        it('should get missed variables', function () {
            cfg_parser_mock.prototype.getPlugin.and.returnValue(undefined);
            plugin_info_mock.prototype.getPreferences.and.returnValue({ key: 'FCM_VERSION', value: undefined });
            const opts = { cli_variables: {} };
            expect(function () { plugin_util.mergeVariables(plugin_info_mock.prototype, cfg_parser_mock.prototype, opts); }).toThrow();
            expect(fs.removeSync).toHaveBeenCalledWith(undefined);
            expect(events.emit).toHaveBeenCalledWith('verbose', 'Removing undefined because mandatory plugin variables were missing.');
        });
    });
});
