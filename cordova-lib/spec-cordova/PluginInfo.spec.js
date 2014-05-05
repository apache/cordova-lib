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

/* jshint node:true, laxcomma:true */
/* globals describe, it, expect */

var PluginInfo = require('../src/PluginInfo'),
    path = require('path');

var pluginsDir = path.join(__dirname, 'fixtures', 'plugins');

describe('PluginInfo', function () {
    it('should read a plugin.xml file', function () {
        var p;
        expect(function () {
            p = new PluginInfo.PluginInfo(path.join(pluginsDir, 'ChildBrowser'));
        }).not.toThrow();
        expect(p).toBeDefined();
        expect(p.name).toEqual('Child Browser');
    });
    it('should throw when there is no plugin.xml file', function () {
        expect(function () {
            var p = new PluginInfo.PluginInfo('/non/existent/dir');
        }).toThrow();
    });
    describe('loadPluginsDir', function () {
        it('should load all plugins in a dir', function () {
            var plugins = PluginInfo.loadPluginsDir(pluginsDir);
            expect(plugins.length).not.toBe(0);
        });
    });
});