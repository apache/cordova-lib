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
var platforms = require('../src/plugman/platforms'),
    prepare = require('../src/plugman/prepare'),
    common  = require('../src/plugman/platforms/common');
    fs      = require('fs'),
    os      = require('osenv'),
    path    = require('path'),
    shell   = require('shelljs'),
    config_changes = require('../src/plugman/util/config-changes'),
    PlatformJson = require('../src/plugman/util/PlatformJson'),
    temp    = __dirname,
    plugins_dir = path.join(temp, 'plugins');

var json = path.join(temp, 'assets', 'www', 'cordova_plugins.json');
var js = path.join(temp, 'assets', 'www', 'cordova_plugins.js');

describe('prepare', function() {
    var proc, platform_json, write, mkdir, rm;
    beforeEach(function() {
        rm = spyOn(shell, 'rm');
        mkdir = spyOn(shell, 'mkdir');
        proc = spyOn(config_changes, 'process');
        platform_json = spyOn(PlatformJson, 'load').andReturn(new PlatformJson(null, null, {installed_plugins:{},dependent_plugins:{},prepare_queue:{uninstalled:[]}}));
        write = spyOn(fs, 'writeFileSync');
    });
    it('should create cordova_plugins.js file in a custom www directory', function() {
        var custom_www = path.join(temp, 'assets', 'custom_www'),
            js = path.join(temp, 'assets', 'custom_www', 'cordova_plugins.js');
        prepare(temp, 'android', plugins_dir, custom_www);
        expect(write).toHaveBeenCalledWith(js, jasmine.any(String), 'utf-8');
    });
    describe('handling of js-modules', function() {
        var copySpy;
        beforeEach(function() {
            copySpy = spyOn(common, 'copyFile');
            platform_json.andReturn(new PlatformJson(null, null, {
                installed_plugins: {plugin_one: '', plugin_two: ''},
                dependent_plugins: {}, prepare_queue: {uninstalled:[]}
            }));
        });
        describe('uninstallation/removal', function() {
            var existsSync;
            beforeEach(function() {
                existsSync = spyOn(fs, 'existsSync').andReturn(true);
                platform_json.andReturn(new PlatformJson(null, null, {installed_plugins:{},dependent_plugins:{},prepare_queue:{uninstalled:[{
                    plugin:'nickelback',
                    id:'nickelback',
                    topLevel:true
                }]}}));
            });
            it('should remove any www/plugins directories related to plugins being queued for removal', function() {
                prepare(temp, 'android', plugins_dir);
                expect(rm).toHaveBeenCalledWith('-rf', path.join(temp, 'assets', 'www', 'plugins', 'nickelback'));
            });
        });
    });
    it('should call into config-changes\' process method to do config processing', function() {
        prepare(temp, 'android', plugins_dir);
        expect(proc).toHaveBeenCalledWith(plugins_dir, temp, 'android', jasmine.any(Object));
    });
});
