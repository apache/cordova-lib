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
const dependencies = require('../../../src/plugman/util/dependencies');
const xml_helpers = require('cordova-common').xmlHelpers;
const path = require('path');
const PlatformJson = require('cordova-common').PlatformJson;
const PluginInfoProvider = require('cordova-common').PluginInfoProvider;

describe('dependency module', function () {
    describe('generateDependencyInfo method', function () {
        it('Test 001 : should return a list of top-level plugins based on what is inside a platform.json file', function () {
            const tlps = {
                hello: '',
                isitme: '',
                yourelookingfor: ''
            };
            const platformJson = new PlatformJson('filePath', 'platform', {
                installed_plugins: tlps,
                dependent_plugins: []
            });
            const pluginInfoProvider = new PluginInfoProvider();
            Object.keys(tlps).forEach(function (k) {
                pluginInfoProvider.put({ id: k, dir: path.join('plugins_dir', k), getDependencies: function () { return []; } });
            });
            spyOn(xml_helpers, 'parseElementtreeSync').and.returnValue({ findall: function () {} });
            const obj = dependencies.generateDependencyInfo(platformJson, 'plugins_dir', pluginInfoProvider);
            expect(obj.top_level_plugins).toEqual(Object.keys(tlps));
        });
        it('Test 002 : should return a dependency graph for the plugins', function () {
            const tlps = {
                A: '',
                B: ''
            };
            const plugins_dir = path.join(__dirname, '..', 'plugins', 'dependencies');
            const platformJson = new PlatformJson(plugins_dir, 'android', {
                installed_plugins: tlps,
                dependent_plugins: []
            });
            const obj = dependencies.generateDependencyInfo(platformJson, plugins_dir, new PluginInfoProvider());
            expect(obj.graph.getChain('A')).toEqual(['C', 'D']);
            expect(obj.graph.getChain('B')).toEqual(['D', 'E']);
        });
    });
});
