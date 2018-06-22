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
var list = require('../../../src/cordova/plugin/list');
var plugin_util = require('../../../src/cordova/plugin/util');
var events = require('cordova-common').events;
var semver = require('semver');

describe('cordova/plugin/list', function () {
    var projectRoot = '/some/path';
    var hook_mock;
    var fake_plugins_list = [{id: 'VRPlugin', version: '1.0.0', name: 'VR'}, {id: 'MastodonSocialPlugin', version: '2.0.0', name: 'Mastodon'}];
    beforeEach(function () {
        hook_mock = jasmine.createSpyObj('hooks runner mock', ['fire']);
        hook_mock.fire.and.returnValue(Q());
        spyOn(plugin_util, 'getInstalledPlugins').and.returnValue(Q.resolve(fake_plugins_list));
        spyOn(events, 'emit');
    });
    it('should fire the before_plugin_ls hook', function () {
        var opts = {important: 'options'};
        return list(projectRoot, hook_mock, opts).then(function () {
            expect(hook_mock.fire).toHaveBeenCalledWith('before_plugin_ls', opts);
        });
    });
    it('should emit a "no plugins added" result if there are no installed plugins', function () {
        plugin_util.getInstalledPlugins.and.returnValue([]);
        return list(projectRoot, hook_mock).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/No plugins added/));
        });
    });
    it('should warn if plugin list contains dependencies that are missing', function () {
        var fake_plugins_list = [{id: 'VRPlugin', deps: '1'}];
        plugin_util.getInstalledPlugins.and.returnValue(Q.resolve(fake_plugins_list));
        return list(projectRoot, hook_mock).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/WARNING, missing dependency/));
        });
    });
    xit('should warn if plugin list contains a plugin dependency that does not have a version satisfied', function () {
        spyOn(semver, 'satisfies').and.returnValue(false);
        var fake_plugins_list = [{id: 'VRPlugin', version: '1', deps: '1'}];
        plugin_util.getInstalledPlugins.and.returnValue(Q.resolve(fake_plugins_list));
        return list(projectRoot, hook_mock).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/WARNING, broken dependency/));
        });
    });
    it('should emit a result containing a description of plugins installed', function () {
        return list(projectRoot, hook_mock).then(function () {
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching('VRPlugin 1.0.0'));
            expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching('MastodonSocialPlugin 2.0.0'));
        });
    });
    it('should fire the after_plugin_ls hook', function () {
        var opts = {important: 'options'};
        return list(projectRoot, hook_mock, opts).then(function () {
            expect(hook_mock.fire).toHaveBeenCalledWith('after_plugin_ls', opts);
        });
    });
    it('should resolve the promise by returning an array of plugin ids installed', function () {
        return list(projectRoot, hook_mock).then(function (results) {
            expect(results).toEqual([ 'VRPlugin', 'MastodonSocialPlugin' ]);
        });
    });
});
