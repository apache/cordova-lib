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
var registry = require('../../src/plugman/registry/registry'),
    manifest = require('../../src/plugman/registry/manifest'),
    fs = require('fs'),
    path = require('path'),
    shell   = require('shelljs'),
    os = require('os'),
    npm = require('npm');

describe('registry', function() {
    var done;
    beforeEach(function() {
        done = false;
    });
    function registryPromise(shouldSucceed, f) {
        waitsFor(function() { return done; }, 'promise never resolved', 500);
        return f.then(function() {
          done = true;
          expect(shouldSucceed).toBe(true);
        }, function(err) {
          done = err;
          expect(shouldSucceed).toBe(false);
        });
    }

    describe('manifest', function() {
        var pluginDir, tmp_plugin, tmp_plugin_xml, tmp_package_json;
        beforeEach(function() {
            pluginDir = __dirname + '/../plugins/com.cordova.engine';
            tmp_plugin = path.join(os.tmpdir(), 'plugin');
            tmp_plugin_xml = path.join(tmp_plugin, 'plugin.xml');
            tmp_package_json = path.join(tmp_plugin, 'package.json');
            shell.cp('-R', pluginDir+'/*', tmp_plugin);
        });
        afterEach(function() {
            shell.rm('-rf', tmp_plugin);
        });
        it('should generate a package.json from a plugin.xml', function() {
            registryPromise(true, manifest.generatePackageJsonFromPluginXml(tmp_plugin).then(function() {
                expect(fs.existsSync(tmp_package_json));
                var packageJson = JSON.parse(fs.readFileSync(tmp_package_json));
                expect(packageJson.name).toEqual('com.cordova.engine');
                expect(packageJson.version).toEqual('1.0.0');
                expect(packageJson.engines).toEqual(
                    [ { name : 'cordova', version : '>=2.3.0' }, { name : 'cordova-plugman', version : '>=0.10.0' }, { name : 'mega-fun-plugin', version : '>=1.0.0' }, { name : 'mega-boring-plugin', version : '>=3.0.0' } ]);
            }));
        });
        it('should raise an error if name does not follow com.domain.* format', function() {
            var xmlData = fs.readFileSync(tmp_plugin_xml).toString().replace('id="com.cordova.engine"', 'id="engine"');
            fs.writeFileSync(tmp_plugin_xml, xmlData);
            registryPromise(false, manifest.generatePackageJsonFromPluginXml(tmp_plugin));
        });
        it('should generate a package.json if name uses org.apache.cordova.* for a whitelisted plugin', function() {
            var xmlData = fs.readFileSync(tmp_plugin_xml).toString().replace('id="com.cordova.engine"', 'id="org.apache.cordova.camera"');
            fs.writeFileSync(tmp_plugin_xml, xmlData);
            registryPromise(true, manifest.generatePackageJsonFromPluginXml(tmp_plugin).then(function() {
                expect(!fs.existsSync(tmp_package_json));
            }));
        });
        it('should raise an error if name uses org.apache.cordova.* for a non-whitelisted plugin', function() {
            var xmlData = fs.readFileSync(tmp_plugin_xml).toString().replace('id="com.cordova.engine"', 'id="org.apache.cordova.myinvalidplugin"');
            fs.writeFileSync(tmp_plugin_xml, xmlData);
            registryPromise(false, manifest.generatePackageJsonFromPluginXml(tmp_plugin));
        });
    });
    describe('actions', function() {
        var fakeLoad, fakeNPMCommands;

        beforeEach(function() {
            done = false;
            var fakeSettings = {
                cache: '/some/cache/dir',
                logstream: 'somelogstream@2313213',
                userconfig: '/some/config/dir'
            };

            var fakeNPM = function() {
                if (arguments.length > 0) {
                    var cb = arguments[arguments.length-1];
                    if (cb && typeof cb === 'function') cb(null, true);
                }
            };

            registry.settings = fakeSettings;
            fakeLoad = spyOn(npm, 'load').andCallFake(function () { arguments[arguments.length - 1](null, true); });

            fakeNPMCommands = {};
            ['config', 'adduser', 'cache', 'publish', 'unpublish', 'search'].forEach(function(cmd) {
                fakeNPMCommands[cmd] = jasmine.createSpy(cmd).andCallFake(fakeNPM);
            });

            npm.commands = fakeNPMCommands;
            npm.config.set = function(){};
            npm.config.get = function(){};
            npm.config.del = function(){};
        });
        it('should run config', function() {
            var params = ['set', 'registry', 'http://registry.cordova.io'];
            registryPromise(true, registry.config(params).then(function() {
                expect(fakeLoad).toHaveBeenCalledWith(jasmine.any(Object),jasmine.any(Function));
                expect(fakeNPMCommands.config).toHaveBeenCalledWith(params, jasmine.any(Function));
            }));
        });
        it('should run search', function() {
            var params = ['dummyplugin', 'plugin'];
            registryPromise(true, registry.search(params).then(function() {
                expect(fakeLoad).toHaveBeenCalledWith(jasmine.any(Object),jasmine.any(Function));
                expect(fakeNPMCommands.search).toHaveBeenCalledWith(params, true, jasmine.any(Function));
            }));
        });
    });
});
