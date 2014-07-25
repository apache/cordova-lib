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
    ConfigParser = require('../src/configparser/ConfigParser'),
    xml = path.join(__dirname, 'test-config.xml'),
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
            it('should get value of existing preference', function() {
                expect(cfg.getPreference('fullscreen')).toEqual('true');
            });
            it('should get undefined as non existing preference', function() {
                expect(cfg.getPreference('zimzooo!')).toEqual(undefined);
            });
        });
        describe('feature',function(){
            it('should read feature id list', function() {
               var expectedList = [
                   "org.apache.cordova.featurewithvars",
                   "org.apache.cordova.featurewithurl",
                   "org.apache.cordova.featurewithversion",
                   "org.apache.cordova.featurewithurlandversion",
                   "org.apache.cordova.justafeature"
               ];
               var list = cfg.getFeatureIdList();
               expect(list.length).toEqual(expectedList.length);
               expectedList.forEach(function(feature){
                   expect(list).toContain(feature);
               });
            });
            it('should read feature given id', function(){
                var feature = cfg.getFeature("org.apache.cordova.justafeature");
                expect(feature).toBeDefined();
                expect(feature.name).toEqual("A simple feature");
                expect(feature.id).toEqual("org.apache.cordova.justafeature");
                expect(feature.params).toBeDefined();
                expect(feature.params.id).toBeDefined();
                expect(feature.params.id).toEqual("org.apache.cordova.justafeature");
            });
            it('should not read feature given undefined id', function(){
                var feature = cfg.getFeature("org.apache.cordova.undefinedfeature");
                expect(feature).not.toBeDefined();
            });
            it('should read feature with url and set \'url\' param', function(){
                var feature = cfg.getFeature("org.apache.cordova.featurewithurl");
                expect(feature.url).toEqual("http://cordova.apache.org/featurewithurl");
                expect(feature.params).toBeDefined();
                expect(feature.params.url).toBeDefined();
                expect(feature.params.url).toEqual("http://cordova.apache.org/featurewithurl");
            });
            it('should read feature with version and set \'version\' param', function(){
                var feature = cfg.getFeature("org.apache.cordova.featurewithversion");
                expect(feature.version).toEqual("1.1.1");
                expect(feature.params).toBeDefined();
                expect(feature.params.version).toBeDefined();
                expect(feature.params.version).toEqual("1.1.1");
            });
            it('should read feature variables', function () {
                var feature = cfg.getFeature("org.apache.cordova.featurewithvars");
                expect(feature.variables).toBeDefined();
                expect(feature.variables.var).toBeDefined();
                expect(feature.variables.var).toEqual("varvalue");
            });
            it('should allow adding a new feature', function(){
                cfg.addFeature('myfeature');
                var features = cfg.doc.findall('feature');
                var featureNames = features.map(function(feature){
                    return feature.attrib.name;
                });
                expect(featureNames).toContain('myfeature');
            });
            it('should allow adding features with params', function(){
                cfg.addFeature('afeature', JSON.parse('[{"name":"paraname", "value":"paravalue"}]'));
                var features = cfg.doc.findall('feature');
                var feature  = (function(){
                    var i = features.length;
                    var f;
                    while (--i >= 0) {
                        f = features[i];
                        if ('afeature' === f.attrib.name) return f;
                    }
                    return undefined;
                })();
                expect(feature).toBeDefined();
                var params = feature.findall('param');
                expect(params[0].attrib.name).toEqual('paraname');
                expect(params[0].attrib.value).toEqual('paravalue');
            });
        });
    });
});
