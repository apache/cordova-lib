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
var PlatformJson = rewire('../src/PlatformJson');
var ModuleMetadata = PlatformJson.__get__('ModuleMetadata');

var FAKE_MODULE = {
    name: 'fakeModule',
    src: 'www/fakeModule.js',
    clobbers: [{target: 'window.fakeClobber'}],
    merges: [{target: 'window.fakeMerge'}],
    runs: true
};

describe('PlatformJson class', function() {
    it('should be constructable', function () {
        expect(new PlatformJson()).toEqual(jasmine.any(PlatformJson));
    });

    describe('instance', function () {
        var platformJson;
        var fakePlugin;
        
        beforeEach(function () {
            platformJson = new PlatformJson('/fake/path', 'android');
            fakePlugin = jasmine.createSpyObj('fakePlugin', ['getJsModules']);
            fakePlugin.id = 'fakeId';
            fakePlugin.version = '1.0.0';
            fakePlugin.getJsModules.and.returnValue([FAKE_MODULE]);
        });
        
        describe('addPluginMetadata method', function () {
            it('should not throw if root "modules" property is missing', function () {
                expect(function () {
                    platformJson.addPluginMetadata(fakePlugin);
                }).not.toThrow();
            });
    
            it('should add each module to "root.modules" array', function () {
                platformJson.addPluginMetadata(fakePlugin);
                expect(platformJson.root.modules.length).toBe(1);
                expect(platformJson.root.modules[0]).toEqual(jasmine.any(ModuleMetadata));
            });
            
            it('shouldn\'t add module if there is already module with the same file added', function () {
                platformJson.root.modules = [{
                    name: 'fakePlugin2',
                    file: 'plugins/fakeId/www/fakeModule.js'
                }];
                
                platformJson.addPluginMetadata(fakePlugin);
                expect(platformJson.root.modules.length).toBe(1);
                expect(platformJson.root.modules[0].name).toBe('fakePlugin2');
            });
            
            it('should add entry to plugin_metadata with corresponding version', function () {
                platformJson.addPluginMetadata(fakePlugin);
                expect(platformJson.root.plugin_metadata[fakePlugin.id]).toBe(fakePlugin.version);
            });
        });
        
        describe('removePluginMetadata method', function () {
            it('should not throw if root "modules" property is missing', function () {
                expect(function () {
                    platformJson.removePluginMetadata(fakePlugin);
                }).not.toThrow();
            });
    
            it('should remove plugin modules from "root.modules" array based on file path', function () {
                
                var pluginPaths = [
                    'plugins/fakeId/www/fakeModule.js',
                    'plugins/otherPlugin/www/module1.js',
                    'plugins/otherPlugin/www/module1.js'
                ];
                
                platformJson.root.modules = pluginPaths.map(function (p) { return {file: p}; });
                platformJson.removePluginMetadata(fakePlugin);
                var resultantPaths = platformJson.root.modules
                    .map(function (p) { return p.file; })
                    .filter(function (f) { return /fakeModule\.js$/.test(f); });
                   
                expect(resultantPaths.length).toBe(0);
            });
            
            it('should remove entry from plugin_metadata with corresponding version', function () {
                platformJson.root.plugin_metadata = {};
                platformJson.root.plugin_metadata[fakePlugin.id] = fakePlugin.version;
                platformJson.removePluginMetadata(fakePlugin);
                expect(platformJson.root.plugin_metadata[fakePlugin.id]).not.toBeDefined();
            });
        });
        
        describe('generateMetadata method', function () {
            it('should generate text metadata containing list of installed modules', function () {
                var meta = platformJson.addPluginMetadata(fakePlugin).generateMetadata();
                expect(typeof meta).toBe('string');
                expect(meta.indexOf(JSON.stringify(platformJson.root.modules, null, 4))).toBeGreaterThan(0);
                // expect(meta).toMatch(JSON.stringify(platformJson.root.modules, null, 4));
                expect(meta).toMatch(JSON.stringify(platformJson.root.plugin_metadata, null, 4));
            });
        });
    });
});

describe('ModuleMetadata class', function () {
    it('should be constructable', function () {
        var meta;
        expect(function name(params) {
            meta = new ModuleMetadata('fakePlugin', {src: 'www/fakeModule.js'});
        }).not.toThrow();
        expect(meta instanceof ModuleMetadata).toBeTruthy();
    });
    
    it('should throw if either pluginId or jsModule argument isn\'t specified', function () {
        expect(ModuleMetadata).toThrow();
        expect(function () { new ModuleMetadata('fakePlugin', {}); }).toThrow();
    });
    
    it('should guess module id either from name property of from module src', function () {
        expect(new ModuleMetadata('fakePlugin', {name: 'fakeModule'}).id).toMatch(/fakeModule$/);
        expect(new ModuleMetadata('fakePlugin', {src: 'www/fakeModule.js'}).id).toMatch(/fakeModule$/);
    });
    
    it('should read "clobbers" property from module', function () {
        expect(new ModuleMetadata('fakePlugin', {name: 'fakeModule'}).clobbers).not.toBeDefined();
        var metadata = new ModuleMetadata('fakePlugin', FAKE_MODULE);
        expect(metadata.clobbers).toEqual(jasmine.any(Array));
        expect(metadata.clobbers[0]).toBe(FAKE_MODULE.clobbers[0].target);
    });
    
    it('should read "merges" property from module', function () {
        expect(new ModuleMetadata('fakePlugin', {name: 'fakeModule'}).merges).not.toBeDefined();
        var metadata = new ModuleMetadata('fakePlugin', FAKE_MODULE);
        expect(metadata.merges).toEqual(jasmine.any(Array));
        expect(metadata.merges[0]).toBe(FAKE_MODULE.merges[0].target);
    });
    
    it('should read "runs" property from module', function () {
        expect(new ModuleMetadata('fakePlugin', {name: 'fakeModule'}).runs).not.toBeDefined();
        expect(new ModuleMetadata('fakePlugin', FAKE_MODULE).runs).toBe(true);
    });
});
