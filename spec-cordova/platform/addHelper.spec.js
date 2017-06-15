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
/* eslint-env jasmine */

var path = require('path');
var fs = require('fs');
var shell = require('shelljs');
var rewire = require('rewire');
var platform_addHelper = rewire('../../src/cordova/platform/addHelper');
var cordova_util = require('../../src/cordova/util');

var config_xml_path = 'spec-cordova/fixtures/config.xml';

describe('cordova/platform/addHelper', function () {
    describe('error/warning conditions', function () {
        it('should require specifying at least one platform');
        it('should warn if host OS does not support the specified platform');
    });
    describe('happy path (success conditions)', function () {
        it('should fire the before_platform_* hook');
        it('should warn about deprecated platforms');
        /*
         * first "leg" (`then`) of the promise is platform "spec" support:
         * - tries to infer spec from either package.json or config.xml
         * - defaults to pinned version for platform.
         * - downloads the platform, passing in spec.
         * --> how to test: spy on downloadPlatform, validate spec passed.
         * --> should mock out downloadPlatform completely for all happy path tests. this would short-circuit the first addHelper promise `then`.
         * second "leg" (`then`) of the promise:
         * - checks for already-added or not-added platform requirements. TODO: couldnt we move this up to before downloading, to the initial error/warning checks?
         * - invokes platform api createPlatform or updatePlatform
         * - if not restoring, runs a `prepare`
         * - if just added, installsPluginsForNewPlatform (TODO for fil: familiarize yourself why not just a regular "install plugin for platform" - why the 'newPlatform' API?)
         * - if not restoring, run a prepare. TODO: didnt we just do this? we just installed plugins, so maybe its needed, but couldnt we just run a single prepare after possibly installing plugins?
         * third `then`:
         * - save particular platform version installed to platform metadata.
         * - if autosaving or opts.save is provided, write platform to config.xml
         * fourth `then`:
         * - save added platform to package.json if exists.
         * fifth `then`:
         * - fire after_platform_add/update hook
         */
    });
    /*
    var projectRoot = path.join('some', 'path'),
        windowsPath = path.join(projectRoot,'cordova-windows'),
        configParserRevert,
        fetchRevert,
        downloadPlatformRevert,
        pkgJson = {},
        configEngines = [],
        fetchArgs = [];

    // Mock HooksRunner
    var hooksRunnerMock = {
        fire: function () {
            return Q();
        }
    };

    // Mock Platform Api
    function PlatformApiMock() {}
    PlatformApiMock.createPlatform = function() {
        return Q();
    };
    PlatformApiMock.updatePlatform = function() {
        return Q();
    };

    // Mock cordova-fetch
    var fetchMock = function(target) {
        fetchArgs.push(target);
        //return the basename of either the target, url or local path 
        return Q(path.basename(target));
    };

    // Mock ConfigParser
    function ConfigParserMock() {}
    ConfigParserMock.prototype = {
        write: function() {
            //do nothing
        },
        addEngine: function(plat, spec) {
            //add engine to configEngines
            configEngines.push({'name': plat, 'spec': spec});
        },
        removeEngine: function(plat) {
            //delete engine from configEngines
            configEngines.forEach(function(item, index) {
                if(item.name === plat){
                    delete configEngines[index]; 
                }
            });
        },
        getEngines: function() {
            return configEngines;
        }
    };

    function getPlatformDetailsFromDirMock(dir, platform) {
        var ver;
        var parts = dir.split('@');
        //attempt to derive version from dir/target
        //eg dir = android@~6.1.1 || atari@1.0.0
        if(parts.length > 1) {
            ver = parts[1] || parts[0];
            //remove ~ or ^ since the real function version wouldn't have that
            if(ver[0] === '~' || ver[0] === '^') {
                ver = ver.slice(1);
            }
        }
        // not a perfect representation of the real function, but good for testing
		return Q({
            'libDir':'Api.js',
            'platform':platform || path.basename(dir),
            'version':ver || 'n/a'
        });
    }

    beforeEach(function () {
        spyOn(cordova_util, 'projectConfig').and.returnValue(config_xml_path);
        spyOn(shell, 'mkdir').and.returnValue(true);

        configParserRevert = platform_addHelper.__set__('ConfigParser', ConfigParserMock);
        fetchRevert = platform_addHelper.__set__('fetch', fetchMock);
        spyOn(platform, 'getPlatformDetailsFromDir').and.callFake(getPlatformDetailsFromDirMock);
        spyOn(prepare, 'preparePlatforms').and.returnValue(Q());
        spyOn(cordova, 'prepare').and.returnValue(Q());
        spyOn(platformMetadata, 'save').and.returnValue(true);
        spyOn(cordova_util, 'getPlatformApiFunction').and.returnValue(PlatformApiMock);
        // writes to package.json
        spyOn(fs, 'writeFileSync').and.callFake(function (dest, pkgJ) {
            pkgJson = JSON.parse(pkgJ);
            return true;
        });

        // return true for windows local path target
        spyOn(cordova_util, 'isDirectory').and.callFake(function (filePath) {
            if (filePath.indexOf(windowsPath) !== -1) {
                return true;
            } else {
                return false;
            }
        });

        spyOn(lazy_load, 'git_clone').and.callFake(function (git_url, branch) {
            return Q(path.basename(git_url));
        });
        spyOn(lazy_load, 'based_on_config').and.callFake(function (projRoot, target) {
            return Q(target);
        });
    });

    afterEach(function () {
        configParserRevert();
        fetchRevert();
        if (downloadPlatformRevert) {
            downloadPlatformRevert();
            downloadPlatformRevert = undefined;
        }
        pkgJson = {};
        configEngines = [];
        fetchArgs = [];
    });
    */

    xdescribe('old add tests', function () {
        it('should succeed with fetch, save and package.json. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
            //spy for package.json to exist
            spyOn(fs,'existsSync').and.callFake(function(filePath) {
                if(path.basename(filePath) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });
            
            //require packge.json object
            spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
            
            platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': true, 'save': true})
            .then(function() {
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(shell.mkdir.calls.count()).toEqual(1);
                expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
                expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
                expect(cordova.prepare.calls.count()).toEqual(4);
                expect(prepare.preparePlatforms.calls.count()).toEqual(4);
                expect(platformMetadata.save.calls.count()).toEqual(4);
                expect(lazy_load.git_clone.calls.count()).toEqual(0);
                expect(lazy_load.based_on_config.calls.count()).toEqual(0);
                //expect correct arugments to be passed to cordova-fetch
                expect(fetchArgs[0]).toEqual('cordova-android@'+pinnedAndroidVer);
                expect(fetchArgs[1]).toEqual('https://github.com/apache/cordova-ios');
                expect(fetchArgs[2]).toContain('cordova-windows');
                expect(fetchArgs[3]).toEqual('atari@1.0.0'); 
                //test pkgJson is being built correctly
                expect(fs.writeFileSync.calls.count()).toEqual(1);
                expect(pkgJson.cordova).toBeDefined();
                expect(pkgJson.cordova.platforms).toEqual([ 'android', 'atari', 'cordova-ios', 'cordova-windows' ]);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(5);
                //test cfg.engines code is being run with correct arugments
                expect(configEngines.length).toEqual(4);
                expect(configEngines).toEqual(
                    [ { name: 'android', spec: pinnedAndroidVer },
                    { name: 'cordova-ios',
                    spec: 'https://github.com/apache/cordova-ios' },
                    { name: 'cordova-windows',
                    spec: windowsPath },
                    { name: 'atari', spec: '~1.0.0' } ]);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            })
            .fin(done);
        });

        it('should succeed with fetch, save and no package.json. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
            //spy for package.json to not exist
            spyOn(fs,'existsSync').and.returnValue(false);
            
            //require packge.json object
            spyOn(cordova_util, 'requireNoCache');
     
            platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': true, 'save': true})
            .then(function() {
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(shell.mkdir.calls.count()).toEqual(1);
                expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
                expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
                expect(cordova.prepare.calls.count()).toEqual(4);
                expect(prepare.preparePlatforms.calls.count()).toEqual(4);
                expect(platformMetadata.save.calls.count()).toEqual(4);
                expect(lazy_load.git_clone.calls.count()).toEqual(0);
                expect(lazy_load.based_on_config.calls.count()).toEqual(0);
                //expect correct arugments to be passed to cordova-fetch
                expect(fetchArgs[0]).toEqual('cordova-android@'+pinnedAndroidVer);
                expect(fetchArgs[1]).toEqual('https://github.com/apache/cordova-ios');
                expect(fetchArgs[2]).toContain('cordova-windows');
                expect(fetchArgs[3]).toEqual('atari@1.0.0');
                //test pkgJson releated commands aren't being called
                expect(fs.writeFileSync.calls.count()).toEqual(0);
                expect(pkgJson.cordova).toBeUndefined();
                expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
                //test cfg.engines code is being run with correct arugments
                expect(configEngines.length).toEqual(4);
                expect(configEngines).toEqual(
                    [ { name: 'android', spec: pinnedAndroidVer },
                    { name: 'cordova-ios',
                    spec: 'https://github.com/apache/cordova-ios' },
                    { name: 'cordova-windows',
                    spec: windowsPath },
                    { name: 'atari', spec: '~1.0.0' } ]);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            })
            .fin(done);
        });

        //no need to worry about packagae.json in this case
        it('should succeed with fetch, no save. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
            //spy for package.json to not exist
            spyOn(fs,'existsSync').and.returnValue(false);
     
            platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': true, 'save': false})
            .then(function() {
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(shell.mkdir.calls.count()).toEqual(1);
                expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
                expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
                expect(cordova.prepare.calls.count()).toEqual(4);
                expect(prepare.preparePlatforms.calls.count()).toEqual(4);
                expect(platformMetadata.save.calls.count()).toEqual(4);
                expect(lazy_load.git_clone.calls.count()).toEqual(0);
                expect(lazy_load.based_on_config.calls.count()).toEqual(0);
                //expect correct arugments to be passed to cordova-fetch
                expect(fetchArgs[0]).toEqual('cordova-android@'+pinnedAndroidVer);
                expect(fetchArgs[1]).toEqual('https://github.com/apache/cordova-ios');
                expect(fetchArgs[2]).toContain('cordova-windows');
                expect(fetchArgs[3]).toEqual('atari@1.0.0'); 
                //test pkgJson releated commands aren't being called
                expect(fs.writeFileSync.calls.count()).toEqual(0);
                expect(pkgJson.cordova).toBeUndefined();
                //test cfg.engines code is being run with correct arugments
                expect(configEngines.length).toEqual(0);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            })
            .fin(done);
        });

        it('should succeed with save, package.json and no fetch. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
            //spy for package.json to exist
            spyOn(fs,'existsSync').and.callFake(function(filePath) {
                if(path.basename(filePath) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });
            
            //require packge.json object
            spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
            
            platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': false, 'save': true})
            .then(function() {
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(shell.mkdir.calls.count()).toEqual(1);
                expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
                expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
                expect(cordova.prepare.calls.count()).toEqual(4);
                expect(prepare.preparePlatforms.calls.count()).toEqual(4);
                expect(platformMetadata.save.calls.count()).toEqual(4);
                expect(lazy_load.git_clone.calls.count()).toEqual(1);
                expect(lazy_load.based_on_config.calls.count()).toEqual(2);
                //expect correct arguments to be passed to cordova-fetch
                expect(fetchArgs.length).toEqual(0);
                //test pkgJson is being built correctly
                expect(fs.writeFileSync.calls.count()).toEqual(1);
                expect(pkgJson.cordova).toBeDefined();
                expect(pkgJson.cordova.platforms).toEqual([ 'android', 'atari', 'cordova-ios', 'cordova-windows' ]);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(5);
                //test cfg.engines code is being run with correct arugments
                expect(configEngines.length).toEqual(4);
                expect(configEngines).toEqual(
                    [ { name: 'android', spec: pinnedAndroidVer },
                    { name: 'cordova-ios',
                    spec: 'https://github.com/apache/cordova-ios' },
                    { name: 'cordova-windows',
                    spec: windowsPath },
                    { name: 'atari', spec: '~1.0.0' } ]);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            })
            .fin(done);
        });

        it('should succeed with save, no package.json and no fetch. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
            //spy for package.json to not exist
            spyOn(fs,'existsSync').and.returnValue(false);
                    
            //require packge.json object
            spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
            
            platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': false, 'save': true})
            .then(function() {
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(shell.mkdir.calls.count()).toEqual(1);
                expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
                expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
                expect(cordova.prepare.calls.count()).toEqual(4);
                expect(prepare.preparePlatforms.calls.count()).toEqual(4);
                expect(platformMetadata.save.calls.count()).toEqual(4);
                expect(lazy_load.git_clone.calls.count()).toEqual(1);
                expect(lazy_load.based_on_config.calls.count()).toEqual(2);
                //expect correct arguments to be passed to cordova-fetch
                expect(fetchArgs.length).toEqual(0);
                //test pkgJson releated commands aren't being called
                expect(fs.writeFileSync.calls.count()).toEqual(0);
                expect(pkgJson.cordova).toBeUndefined();
                expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
                //test cfg.engines code is being run with correct arugments
                expect(configEngines.length).toEqual(4);
                expect(configEngines).toEqual(
                    [ { name: 'android', spec: pinnedAndroidVer },
                    { name: 'cordova-ios',
                    spec: 'https://github.com/apache/cordova-ios' },
                    { name: 'cordova-windows',
                    spec: windowsPath },
                    { name: 'atari', spec: '~1.0.0' } ]);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            })
            .fin(done);
        });

        //no need to worry about packagae.json in this case
        it('should succeed with no fetch, no save. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
            //spy for package.json to not exist
            spyOn(fs,'existsSync').and.returnValue(false);
     
            platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': false, 'save': false})
            .then(function() {
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(shell.mkdir.calls.count()).toEqual(1);
                expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
                expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
                expect(cordova.prepare.calls.count()).toEqual(4);
                expect(prepare.preparePlatforms.calls.count()).toEqual(4);
                expect(platformMetadata.save.calls.count()).toEqual(4);
                expect(lazy_load.git_clone.calls.count()).toEqual(1);
                expect(lazy_load.based_on_config.calls.count()).toEqual(2);
                //test pkgJson releated commands aren't being called
                expect(fs.writeFileSync.calls.count()).toEqual(0);
                expect(pkgJson.cordova).toBeUndefined();
                //test cfg.engines code is being run with correct arugments
                expect(configEngines.length).toEqual(0);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            })
            .fin(done);
        });

        it('should succeed with fetch, save and package.json. Gets android spec from package.json', function(done) {
            //spy for package.json to exist
            spyOn(fs,'existsSync').and.callFake(function(filePath) {
                if(path.basename(filePath) === 'package.json') {
                    return true;
                } else {
                    return false;
                }
            });
            
            pkgJson = {
                'dependencies': {
                    'cordova-android': '^6.2.1'
                }
            };
            //require packge.json object
            spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
            
            platform.add(hooksRunnerMock, projectRoot, ['android'], {'fetch': true, 'save': true})
            .then(function() {
                expect(cordova_util.projectConfig.calls.count()).toEqual(1);
                expect(shell.mkdir.calls.count()).toEqual(1);
                expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(1);
                expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(1);
                expect(cordova.prepare.calls.count()).toEqual(1);
                expect(prepare.preparePlatforms.calls.count()).toEqual(1);
                expect(platformMetadata.save.calls.count()).toEqual(1);
                expect(lazy_load.git_clone.calls.count()).toEqual(0);
                expect(lazy_load.based_on_config.calls.count()).toEqual(0);
                //expect correct arugments to be passed to cordova-fetch
                expect(fetchArgs).toEqual([ 'cordova-android@^6.2.1']);
                //test pkgJson is being built correctly
                expect(fs.writeFileSync.calls.count()).toEqual(1);
                expect(pkgJson.cordova).toBeDefined();
                expect(pkgJson.cordova.platforms).toEqual([ 'android']);
                expect(cordova_util.requireNoCache.calls.count()).toEqual(2);
                //test cfg.engines code is being run with correct arugments
                expect(configEngines.length).toEqual(1);
                expect(configEngines).toEqual(
                    [ { name: 'android', spec: '~6.2.1'}]);
            }).fail(function(e) {
                expect(e).toBeUndefined();
            })
            .fin(done);
        });

        it('throws if platform already added', function (done) {
            // spy for android to exist
            spyOn(fs, 'existsSync').and.callFake(function (filePath) {
                var name = path.basename(filePath);
                if (['android'].indexOf(name) > -1) {
                    return true;
                } else {
                    return false;
                }
            });
            downloadPlatformRevert = platform_addHelper.__set__('module.exports.downloadPlatform', function(proj, plat, spec, opts) {
                console.log('calling fake');
                return Q({
                    platform: 'android'
                });
            });

            platform_addHelper(hooksRunnerMock, projectRoot, ['android'], {'fetch': true, 'save': true})
            .then(false)
            .fail(function(e) {
                expect(e.message).toBe('Platform android already added.');
            })
            .fin(done);
        });

        it('throws if the target list is undefined', function (done) {
            var targets; // = undefined;
            platform.add(hooksRunnerMock, projectRoot, targets, {})
            .then(false)
            .fail(function (error) {
                expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
            }).fin(done);
        });

        it('throws if the target list is null', function (done) {
            var targets = null; // = undefined;
            platform.add(hooksRunnerMock, projectRoot, targets, {})
            .then(false)
            .fail(function (error) {
                expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
            }).fin(done);
        });

        it('throws if the target list is empty', function (done) {
            var targets = []; // = undefined;
            platform.add(hooksRunnerMock, projectRoot, targets, {})
            .then(false)
            .fail(function (error) {
                expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
            }).fin(done);
        });
    });
});
