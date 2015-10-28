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
var path = require('path'),
    fs = require('fs'),
    ConfigParser = require('../../src/ConfigParser/ConfigParser'),
    xml = path.join(__dirname, '../fixtures/test-config.xml'),
    xml_contents = fs.readFileSync(xml, 'utf-8');

describe('config.xml parser', function () {
    var readFile;
    beforeEach(function() {
        readFile = spyOn(fs, 'readFileSync').andReturn(xml_contents);
    });

    it('should create an instance based on an xml file', function() {
        var cfg;
        expect(function () {
            cfg = new ConfigParser(xml);
        }).not.toThrow();
        expect(cfg).toBeDefined();
        expect(cfg.doc).toBeDefined();
    });

    describe('methods', function() {
        var cfg;
        beforeEach(function() {
            cfg = new ConfigParser(xml);
        });

        describe('package name / id', function() {
            it('should get the (default) packagename', function() {
                expect(cfg.packageName()).toEqual('io.cordova.hellocordova');
            });
            it('should allow setting the packagename', function() {
                cfg.setPackageName('this.is.bat.country');
                expect(cfg.packageName()).toEqual('this.is.bat.country');
            });
        });

        describe('package name / android-packageName', function() {
            it('should get the android packagename', function() {
                expect(cfg.android_packageName()).toEqual('io.cordova.hellocordova.android');
            });
        });

        describe('package name / ios-CFBundleIdentifier', function() {
            it('should get the ios packagename', function() {
                expect(cfg.ios_CFBundleIdentifier()).toEqual('io.cordova.hellocordova.ios');
            });
        });

        describe('version', function() {
            it('should get the version', function() {
                expect(cfg.version()).toEqual('0.0.1');
            });
            it('should allow setting the version', function() {
                cfg.setVersion('2.0.1');
                expect(cfg.version()).toEqual('2.0.1');
            });
        });

        describe('app name', function() {
            it('should get the (default) app name', function() {
                expect(cfg.name()).toEqual('Hello Cordova');
            });
            it('should allow setting the app name', function() {
                cfg.setName('this.is.bat.country');
                expect(cfg.name()).toEqual('this.is.bat.country');
            });
        });
        describe('preference', function() {
            it('should return the value of a global preference', function() {
                expect(cfg.getPreference('fullscreen')).toEqual('true');
            });
            it('should return the value of a platform-specific preference', function() {
                expect(cfg.getPreference('android-minSdkVersion', 'android')).toEqual('10');
            });
            it('should return an empty string for a non-existing preference', function() {
                expect(cfg.getPreference('zimzooo!')).toEqual('');
            });
        });
        describe('global preference', function() {
            it('should return the value of a global preference', function() {
                expect(cfg.getGlobalPreference('orientation')).toEqual('portrait');
            });
            it('should return an empty string for a non-existing preference', function() {
                expect(cfg.getGlobalPreference('foobar')).toEqual('');
            });
        });
        describe('platform-specific preference', function() {
            it('should return the value of a platform specific preference', function() {
                expect(cfg.getPlatformPreference('orientation', 'android')).toEqual('landscape');
            });
            it('should return an empty string when querying for a non-existing preference', function() {
                expect(cfg.getPlatformPreference('foobar', 'android')).toEqual('');
            });
            it('should return an empty string when querying with unsupported platform', function() {
                expect(cfg.getPlatformPreference('orientation', 'foobar')).toEqual('');
            });
        });
        describe('plugin',function(){
            it('should read plugin id list', function() {
               var expectedList = [
                   'org.apache.cordova.pluginwithvars',
                   'org.apache.cordova.pluginwithurl',
                   'org.apache.cordova.pluginwithversion',
                   'org.apache.cordova.pluginwithurlandversion',
                   'org.apache.cordova.justaplugin',
                   'org.apache.cordova.legacyfeatureversion',
                   'org.apache.cordova.legacyfeatureurl',
                   'org.apache.cordova.legacyfeatureversionandurl'
               ];
               var list = cfg.getPluginIdList();
               expect(list.length).toEqual(expectedList.length);
               expectedList.forEach(function(plugin){
                   expect(list).toContain(plugin);
               });
            });
            it('should read plugin given id', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.justaplugin');
                expect(plugin).toBeDefined();
                expect(plugin.name).toEqual('org.apache.cordova.justaplugin');
                expect(plugin.variables).toBeDefined();
            });
            it('should not read plugin given undefined id', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.undefinedplugin');
                expect(plugin).not.toBeDefined();
            });
            it('should read plugin with src and store it in spec field', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.pluginwithurl');
                expect(plugin.spec).toEqual('http://cordova.apache.org/pluginwithurl');
            });
            it('should read plugin with version and store it in spec field', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.pluginwithversion');
                expect(plugin.spec).toEqual('1.1.1');
            });
            it('should read plugin with source and version and store source in spec field', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.pluginwithurlandversion');
                expect(plugin.spec).toEqual('http://cordova.apache.org/pluginwithurlandversion');
            });
            it('should read plugin variables', function () {
                var plugin = cfg.getPlugin('org.apache.cordova.pluginwithvars');
                expect(plugin.variables).toBeDefined();
                expect(plugin.variables.var).toBeDefined();
                expect(plugin.variables.var).toEqual('varvalue');
            });
            it('should allow adding a new plugin', function(){
                cfg.addPlugin({name:'myplugin'});
                var plugins = cfg.doc.findall('plugin');
                var pluginNames = plugins.map(function(plugin){
                    return plugin.attrib.name;
                });
                expect(pluginNames).toContain('myplugin');
            });
            it('should allow adding features with params', function(){
                cfg.addPlugin({name:'aplugin'}, [{name:'paraname',value:'paravalue'}]);
                // Additional check for new parameters syntax
                cfg.addPlugin({name:'bplugin'}, {paraname: 'paravalue'});
                var plugins = cfg.doc.findall('plugin')
                .filter(function (plugin) {
                    return plugin.attrib.name === 'aplugin' || plugin.attrib.name === 'bplugin';
                });
                expect(plugins.length).toBe(2);
                plugins.forEach(function (plugin) {
                    var variables = plugin.findall('variable');
                    expect(variables[0].attrib.name).toEqual('paraname');
                    expect(variables[0].attrib.value).toEqual('paravalue');
                });
            });
            it('should be able to read legacy feature entries with a version', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.legacyfeatureversion');
                expect(plugin).toBeDefined();
                expect(plugin.name).toEqual('org.apache.cordova.legacyfeatureversion');
                expect(plugin.spec).toEqual('1.2.3');
                expect(plugin.variables).toBeDefined();
                expect(plugin.variables.aVar).toEqual('aValue');
            });
            it('should be able to read legacy feature entries with a url', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.legacyfeatureurl');
                expect(plugin).toBeDefined();
                expect(plugin.name).toEqual('org.apache.cordova.legacyfeatureurl');
                expect(plugin.spec).toEqual('http://cordova.apache.org/legacyfeatureurl');
            });
            it('should be able to read legacy feature entries with a version and a url', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.legacyfeatureversionandurl');
                expect(plugin).toBeDefined();
                expect(plugin.name).toEqual('org.apache.cordova.legacyfeatureversionandurl');
                expect(plugin.spec).toEqual('http://cordova.apache.org/legacyfeatureversionandurl');
            });
            it('it should remove given plugin', function(){
                cfg.removePlugin('org.apache.cordova.justaplugin');
                var plugins = cfg.doc.findall('plugin');
                var pluginNames = plugins.map(function(plugin){
                    return plugin.attrib.name;
                });
                expect(pluginNames).not.toContain('org.apache.cordova.justaplugin');
            });
            it('it should remove given legacy feature id', function(){
                cfg.removePlugin('org.apache.cordova.legacyplugin');
                var plugins = cfg.doc.findall('feature');
                var pluginNames = plugins.map(function(plugin){
                    return plugin.attrib.name;
                });
                expect(pluginNames).not.toContain('org.apache.cordova.legacyplugin');
            });
            it('it should read <access> tag entries', function(){
                var accesses = cfg.getAccesses();
                expect(accesses.length).not.toEqual(0);
            });
            it('it should read <allow-navigation> tag entries', function(){
                var navigations = cfg.getAllowNavigations();
                expect(navigations.length).not.toEqual(0);
            });
        });
    });
});
