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
        readFile = spyOn(fs, 'readFileSync').and.returnValue(xml_contents);
    });

    it('Test 001 : should create an instance based on an xml file', function() {
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
            it('Test 002 : should get the (default) packagename', function() {
                expect(cfg.packageName()).toEqual('io.cordova.hellocordova');
            });
            it('Test 003 : should allow setting the packagename', function() {
                cfg.setPackageName('this.is.bat.country');
                expect(cfg.packageName()).toEqual('this.is.bat.country');
            });
        });

        describe('package name / android-packageName', function() {
            it('Test 004 : should get the android packagename', function() {
                expect(cfg.android_packageName()).toEqual('io.cordova.hellocordova.android');
            });
        });

        describe('package name / ios-CFBundleIdentifier', function() {
            it('Test 005 : should get the ios packagename', function() {
                expect(cfg.ios_CFBundleIdentifier()).toEqual('io.cordova.hellocordova.ios');
            });
        });

        describe('version', function() {
            it('Test 006 : should get the version', function() {
                expect(cfg.version()).toEqual('0.0.1');
            });
            it('Test 007 : should allow setting the version', function() {
                cfg.setVersion('2.0.1');
                expect(cfg.version()).toEqual('2.0.1');
            });
        });

        describe('app name', function() {
            it('Test 008 : should get the (default) app name', function() {
                expect(cfg.name()).toEqual('Hello Cordova');
            });
            it('Test 009 : should allow setting the app name', function() {
                cfg.setName('this.is.bat.country');
                expect(cfg.name()).toEqual('this.is.bat.country');
            });

            describe('short name', function() {
                it('should default to the app name', function() {
                    expect(cfg.shortName()).toEqual('Hello Cordova');
                });

                it('should allow setting the app short name', function() {
                    cfg.setShortName('Hi CDV');
                    expect(cfg.name()).toEqual('Hello Cordova');
                    expect(cfg.shortName()).toEqual('Hi CDV');
                });
            });
        });

        describe('preference', function() {
            it('Test 010 : should return the value of a global preference', function() {
                expect(cfg.getPreference('fullscreen')).toEqual('true');
            });
            it('Test 011 : should return the value of a platform-specific preference', function() {
                expect(cfg.getPreference('android-minSdkVersion', 'android')).toEqual('10');
            });
            it('Test 012 : should return an empty string for a non-existing preference', function() {
                expect(cfg.getPreference('zimzooo!')).toEqual('');
            });
        });
        describe('global preference', function() {
            it('Test 013 : should return the value of a global preference', function() {
                expect(cfg.getGlobalPreference('orientation')).toEqual('portrait');
            });
            it('Test 014 : should return an empty string for a non-existing preference', function() {
                expect(cfg.getGlobalPreference('foobar')).toEqual('');
            });
        });
        describe('platform-specific preference', function() {
            it('Test 015 : should return the value of a platform specific preference', function() {
                expect(cfg.getPlatformPreference('orientation', 'android')).toEqual('landscape');
            });
            it('Test 016 : should return an empty string when querying for a non-existing preference', function() {
                expect(cfg.getPlatformPreference('foobar', 'android')).toEqual('');
            });
            it('Test 017 : should return an empty string when querying with unsupported platform', function() {
                expect(cfg.getPlatformPreference('orientation', 'foobar')).toEqual('');
            });
        });
        describe('plugin',function(){
            it('Test 018 : should read plugin id list', function() {
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
            it('Test 019 : should read plugin given id', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.justaplugin');
                expect(plugin).toBeDefined();
                expect(plugin.name).toEqual('org.apache.cordova.justaplugin');
                expect(plugin.variables).toBeDefined();
            });
            it('Test 020 : should not read plugin given undefined id', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.undefinedplugin');
                expect(plugin).not.toBeDefined();
            });
            it('Test 021 : should read plugin with src and store it in spec field', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.pluginwithurl');
                expect(plugin.spec).toEqual('http://cordova.apache.org/pluginwithurl');
            });
            it('Test 022 : should read plugin with version and store it in spec field', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.pluginwithversion');
                expect(plugin.spec).toEqual('1.1.1');
            });
            it('Test 023 : should read plugin with source and version and store source in spec field', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.pluginwithurlandversion');
                expect(plugin.spec).toEqual('http://cordova.apache.org/pluginwithurlandversion');
            });
            it('Test 024 : should read plugin variables', function () {
                var plugin = cfg.getPlugin('org.apache.cordova.pluginwithvars');
                expect(plugin.variables).toBeDefined();
                expect(plugin.variables.var).toBeDefined();
                expect(plugin.variables.var).toEqual('varvalue');
            });
            it('Test 025 : should allow adding a new plugin', function(){
                cfg.addPlugin({name:'myplugin'});
                var plugins = cfg.doc.findall('plugin');
                var pluginNames = plugins.map(function(plugin){
                    return plugin.attrib.name;
                });
                expect(pluginNames).toContain('myplugin');
            });
            it('Test 026 : should allow adding features with params', function(){
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
            it('Test 027 : should be able to read legacy feature entries with a version', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.legacyfeatureversion');
                expect(plugin).toBeDefined();
                expect(plugin.name).toEqual('org.apache.cordova.legacyfeatureversion');
                expect(plugin.spec).toEqual('1.2.3');
                expect(plugin.variables).toBeDefined();
                expect(plugin.variables.aVar).toEqual('aValue');
            });
            it('Test 028 : should be able to read legacy feature entries with a url', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.legacyfeatureurl');
                expect(plugin).toBeDefined();
                expect(plugin.name).toEqual('org.apache.cordova.legacyfeatureurl');
                expect(plugin.spec).toEqual('http://cordova.apache.org/legacyfeatureurl');
            });
            it('Test 029 : should be able to read legacy feature entries with a version and a url', function(){
                var plugin = cfg.getPlugin('org.apache.cordova.legacyfeatureversionandurl');
                expect(plugin).toBeDefined();
                expect(plugin.name).toEqual('org.apache.cordova.legacyfeatureversionandurl');
                expect(plugin.spec).toEqual('http://cordova.apache.org/legacyfeatureversionandurl');
            });
            it('Test 030 : it should remove given plugin', function(){
                cfg.removePlugin('org.apache.cordova.justaplugin');
                var plugins = cfg.doc.findall('plugin');
                var pluginNames = plugins.map(function(plugin){
                    return plugin.attrib.name;
                });
                expect(pluginNames).not.toContain('org.apache.cordova.justaplugin');
            });
            it('Test 031 : it should remove given legacy feature id', function(){
                cfg.removePlugin('org.apache.cordova.legacyplugin');
                var plugins = cfg.doc.findall('feature');
                var pluginNames = plugins.map(function(plugin){
                    return plugin.attrib.name;
                });
                expect(pluginNames).not.toContain('org.apache.cordova.legacyplugin');
            });
            it('Test 032 : it should read <access> tag entries', function(){
                var accesses = cfg.getAccesses();
                expect(accesses.length).not.toEqual(0);
            });
            it('Test 033 : it should read <allow-navigation> tag entries', function(){
                var navigations = cfg.getAllowNavigations();
                expect(navigations.length).not.toEqual(0);
            });
            it('Test 034 : it should read <allow-intent> tag entries', function(){
                var intents = cfg.getAllowIntents();
                expect(intents.length).not.toEqual(0);
            });
            it('it should read <edit-config> tag entries', function(){
                var editConfigs = cfg.getEditConfigs('android');
                expect(editConfigs.length).not.toEqual(0);
            });
        });
        describe('static resources', function() {
            var hasPlatformPropertyDefined = function (e) { return !!e.platform; };
            var hasSrcPropertyDefined = function (e) { return !!e.src; };
            var hasTargetPropertyDefined = function (e) { return !!e.target; };
            var hasDensityPropertyDefined = function (e) { return !!e.density; };
            var hasPlatformPropertyUndefined = function (e) { return !e.platform; };

            it('Test 035 : should fetch shared resources if platform parameter is not specified', function() {
                expect(cfg.getStaticResources(null, 'icon').length).toBe(2);
                expect(cfg.getStaticResources(null, 'icon').every(hasPlatformPropertyUndefined)).toBeTruthy();
            });

            it('Test 036 : should fetch platform-specific resources along with shared if platform parameter is specified', function() {
                expect(cfg.getStaticResources('android', 'icon').length).toBe(5);
                expect(cfg.getStaticResources('android', 'icon').some(hasPlatformPropertyDefined)).toBeTruthy();
                expect(cfg.getStaticResources('android', 'icon').filter(hasPlatformPropertyDefined).length).toBe(3);
                expect(cfg.getStaticResources('android', 'icon').some(hasPlatformPropertyUndefined)).toBeTruthy();
            });

            it('Test 037 : should parse resources\' attributes', function() {
                expect(cfg.getStaticResources(null, 'icon').every(hasSrcPropertyDefined)).toBeTruthy();
                expect(cfg.getStaticResources('windows', 'icon').filter(hasPlatformPropertyDefined).every(hasTargetPropertyDefined)).toBeTruthy();
                expect(cfg.getStaticResources('android', 'icon').filter(hasPlatformPropertyDefined).every(hasDensityPropertyDefined)).toBeTruthy();
                expect(cfg.getStaticResources('android', 'icon').filter(hasPlatformPropertyDefined).every(hasDensityPropertyDefined)).toBeTruthy();
            });

            it('Test 038 : should have defaultResource property', function() {
                expect(cfg.getStaticResources(null, 'icon').defaultResource).toBeDefined();
                expect(cfg.getStaticResources(null, 'icon').defaultResource.src).toBe('icon.png');
            });

            it('Test 039 : should have getDefault method returning defaultResource property', function() {
                expect(cfg.getStaticResources(null, 'icon').defaultResource).toEqual(cfg.getStaticResources(null, 'icon').getDefault());
            });

            it('Test 040 : should have getBySize method returning resource with size specified or null', function() {
                expect(cfg.getStaticResources('windows', 'icon').getBySize(128)).toBe(null);
                expect(cfg.getStaticResources('windows', 'icon').getBySize(72)).toBeDefined();
                expect(cfg.getStaticResources('windows', 'icon').getBySize(72).width).toBe(72);
                expect(cfg.getStaticResources('windows', 'icon').getBySize(null, 48)).toBeDefined();
                expect(cfg.getStaticResources('windows', 'icon').getBySize(null, 48).height).toBe(48);
            });

            it('Test 041 : should have getByDensity method returning resource with density specified or null', function() {
                expect(cfg.getStaticResources('android', 'icon').getByDensity('hdpi')).toBe(null);
                expect(cfg.getStaticResources('android', 'icon').getByDensity('mdpi')).toBeDefined();
                expect(cfg.getStaticResources('android', 'icon').getByDensity('mdpi').src).toBe('logo-android.png');
            });
        });

        describe('file resources', function() {
            var hasSrcPropertyDefined = function (e) { return !!e.src; };
            var hasTargetPropertyDefined = function (e) { return !!e.target; };
            var hasArchPropertyDefined = function (e) { return !!e.arch; };

            it('should fetch platform-specific resources', function() {
                expect(cfg.getFileResources('android').length).toBe(2);
            });

            it('should parse resources\' attributes', function() {
                expect(cfg.getFileResources('android').every(hasSrcPropertyDefined)).toBeTruthy();
                expect(cfg.getFileResources('android').every(hasTargetPropertyDefined)).toBeTruthy();
                expect(cfg.getFileResources('windows').every(hasArchPropertyDefined)).toBeTruthy();
            });
        });
    });
});
