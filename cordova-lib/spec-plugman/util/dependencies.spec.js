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
var dependencies = require('../../src/plugman/util/dependencies'),
    xml_helpers = require('../../src/util/xml-helpers'),
    path = require('path'),
    config = require('../../src/plugman/util/config-changes');
var PlatformJson = require('../../src/plugman/util/PlatformJson');
var PluginInfoProvider = require('../../src/PluginInfoProvider');

describe('dependency module', function() {
    describe('generateDependencyInfo method', function() {
        it('should return a list of top-level plugins based on what is inside a platform.json file', function() {
            var tlps = {
                "hello":"",
                "isitme":"",
                "yourelookingfor":""
            };
            var platformJson = new PlatformJson('filePath', 'platform', {
                installed_plugins:tlps,
                dependent_plugins:[]
            });
            var pluginInfoProvider = new PluginInfoProvider();
            Object.keys(tlps).forEach(function(k) {
                pluginInfoProvider.put({id:k, dir: path.join('plugins_dir', k), getDependencies: function() {return[]}});
            });
            spyOn(xml_helpers, 'parseElementtreeSync').andReturn({findall:function(){}});
            var obj = dependencies.generateDependencyInfo(platformJson, 'plugins_dir', pluginInfoProvider);
            expect(obj.top_level_plugins).toEqual(Object.keys(tlps));
        });
        it('should return a dependency graph for the plugins', function() {
            var tlps = {
                "A":"",
                "B":""
            };
            var deps = {
                "C":"",
                "D":"",
                "E":""
            };
            var plugins_dir = path.join(__dirname, '..', 'plugins', 'dependencies');
            var platformJson = new PlatformJson(plugins_dir, 'android', {
                installed_plugins:tlps,
                dependent_plugins:[]
            });
            var obj = dependencies.generateDependencyInfo(platformJson, plugins_dir, new PluginInfoProvider());
            expect(obj.graph.getChain('A')).toEqual(['C','D']);
            expect(obj.graph.getChain('B')).toEqual(['D', 'E']);
        });
    });
});
