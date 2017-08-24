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
var rewire = require('rewire');
var variable_merge = rewire('../../src/plugman/variable-merge');
var underscore = require('underscore');

describe('mergeVariables', function () {
    var plugin_info_provider_mock = function () {};
    var plugin_info_provider_revert_mock;
    var plugin_info;

    beforeEach(function () {
        plugin_info = jasmine.createSpyObj('pluginInfo', ['getPreferences']);
        plugin_info.dir = 'some\\plugin\\path';
        plugin_info.id = 'cordova-plugin-device';
        plugin_info.version = '1.0.0';
        plugin_info_provider_mock.prototype = jasmine.createSpyObj('plugin info provider mock', ['get']);
        plugin_info_provider_mock.prototype.get = function (directory) {
            return plugin_info;
        };
        plugin_info_provider_revert_mock = variable_merge.__set__('PluginInfoProvider', plugin_info_provider_mock);
    });
    afterEach(function () {
        plugin_info_provider_revert_mock();
    });
    it('use plugin.xml if no cli/config variables', function () {
        plugin_info.getPreferences.and.returnValue({FCM_VERSION: '11.0.1'});
        var opts = { cli_variables: { } };
        expect(variable_merge.mergeVariables('some/path', 'android', opts)).toEqual({FCM_VERSION: '11.0.1'});
    });
    it('cli & config variables take precedence over plugin.xml ', function () {
        plugin_info.getPreferences.and.returnValue({FCM_VERSION: '11.0.1'});
        var opts = { cli_variables: {FCM_VERSION: '9.0.0'} };
        expect(variable_merge.mergeVariables('some/path', 'android', opts)).toEqual({FCM_VERSION: '9.0.0'});
    });
    it('should return no variables', function () {
        plugin_info.getPreferences.and.returnValue({});
        var opts = { cli_variables: {} };
        expect(variable_merge.mergeVariables('some/path', 'android', opts)).toEqual({});
    });
    it('should throw error if variables are missing', function () {
        plugin_info.getPreferences.and.returnValue({});
        spyOn(underscore, 'difference').and.returnValue(['missing variable']);
        var opts = { cli_variables: {} };
        expect(function () { variable_merge.mergeVariables('some/path', 'android', opts); }).toThrow();
    });
});
