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
var Q = require('q');
var shell = require('shelljs');
var events = require('cordova-common').events;
var rewire = require('rewire');
var platform_addHelper = rewire('../../src/cordova/platform/addHelper');
var platform_module = require('../../src/cordova/platform');
var platform_metadata = require('../../src/cordova/platform_metadata');
var cordova_util = require('../../src/cordova/util');
var cordova_config = require('../../src/cordova/config');
var plugman = require('../../src/plugman/plugman');
var fetch_metadata = require('../../src/plugman/util/metadata');

describe('cordova/platform/addHelper', function () {
    var projectRoot = '/some/path';
    // These _mock and _revert_mock objects use rewire as the modules these mocks replace
    // during testing all return functions, which we cannot spy on using jasmine.
    // Thus, we replace these modules inside the scope of addHelper.js using rewire, and shim
    // in these _mock test dummies. The test dummies themselves are constructed using
    // jasmine.createSpy inside the first beforeEach.
    var cfg_parser_mock = function () {};
    var cfg_parser_revert_mock;
    var hooks_mock;
    var platform_api_mock;
    var fetch_mock;
    var fetch_revert_mock;
    var prepare_mock;
    var prepare_revert_mock;
    var fake_platform = {
        'platform': 'atari'
    };
    beforeEach(function () {
        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Q());
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser mock', ['write', 'removeEngine', 'addEngine']);
        cfg_parser_revert_mock = platform_addHelper.__set__('ConfigParser', cfg_parser_mock);
        fetch_mock = jasmine.createSpy('fetch mock').and.returnValue(Q());
        fetch_revert_mock = platform_addHelper.__set__('fetch', fetch_mock);
        prepare_mock = jasmine.createSpy('prepare mock').and.returnValue(Q());
        prepare_mock.preparePlatforms = jasmine.createSpy('preparePlatforms mock').and.returnValue(Q());
        prepare_revert_mock = platform_addHelper.__set__('prepare', prepare_mock);
        spyOn(shell, 'mkdir');
        spyOn(fs, 'existsSync').and.returnValue(false);
        spyOn(fs, 'writeFileSync');
        spyOn(cordova_util, 'projectConfig').and.returnValue(path.join(projectRoot, 'config.xml'));
        spyOn(cordova_util, 'isDirectory').and.returnValue(false);
        spyOn(cordova_util, 'fixRelativePath').and.callFake(function (input) { return input; });
        spyOn(cordova_util, 'isUrl').and.returnValue(false);
        spyOn(cordova_util, 'hostSupports').and.returnValue(true);
        spyOn(cordova_util, 'removePlatformPluginsJson');
        spyOn(cordova_config, 'read').and.returnValue({});
        // Fake platform details we will use for our mocks, returned by either
        // getPlatfromDetailsFromDir (in the local-directory case), or
        // downloadPlatform (in every other case)
        spyOn(platform_module, 'getPlatformDetailsFromDir').and.returnValue(Q(fake_platform));
        spyOn(platform_addHelper, 'downloadPlatform').and.returnValue(Q(fake_platform));
        spyOn(platform_addHelper, 'getVersionFromConfigFile').and.returnValue(false);
        spyOn(platform_addHelper, 'installPluginsForNewPlatform').and.returnValue(Q());
        platform_api_mock = jasmine.createSpyObj('platform api mock', ['createPlatform', 'updatePlatform']);
        platform_api_mock.createPlatform.and.returnValue(Q());
        platform_api_mock.updatePlatform.and.returnValue(Q());
        spyOn(cordova_util, 'getPlatformApiFunction').and.returnValue(platform_api_mock);
        spyOn(platform_metadata, 'save');
    });
    afterEach(function () {
        cfg_parser_revert_mock();
        fetch_revert_mock();
        prepare_revert_mock();
    });
    describe('error/warning conditions', function () {
        it('should require specifying at least one platform', function (done) {
            platform_addHelper('add', hooks_mock).then(function () {
                fail('addHelper success handler unexpectedly invoked');
            }).fail(function (e) {
                expect(e.message).toContain('No platform specified.');
            }).done(done);
        });
        it('should log if host OS does not support the specified platform', function () {
            cordova_util.hostSupports.and.returnValue(false);
            spyOn(events, 'emit');
            platform_addHelper('add', hooks_mock, projectRoot, ['atari']);
            expect(events.emit.calls.mostRecent().args[1]).toContain('can not be built on this OS');
        });
        it('should throw if platform was already added before adding');
        it('should throw if platform was not added before updating');
    });
    describe('happy path (success conditions)', function () {
        it('should fire the before_platform_* hook', function () {
            platform_addHelper('add', hooks_mock, projectRoot, ['atari']);
            expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_add', jasmine.any(Object));
        });
        it('should warn about using deprecated platforms', function (done) {
            spyOn(events, 'emit');
            platform_addHelper('add', hooks_mock, projectRoot, ['ubuntu', 'blackberry10']);
            process.nextTick(function () {
                expect(events.emit).toHaveBeenCalledWith(jasmine.stringMatching(/has been deprecated/));
                done();
            });
        });
        describe('platform spec inference', function () {
            // TODO: test these by checking how platform_adDHelper.downloadPlatform OR
            // platform_module.getPlatformDetailsFromDir were called.
            it('should retrieve platform details from directories-specified-as-platforms using getPlatformDetailsFromDir', function (done) {
                cordova_util.isDirectory.and.returnValue(true);
                var directory_to_platform = '/path/to/cordova-atari';
                platform_addHelper('add', hooks_mock, projectRoot, [directory_to_platform]).then(function () {
                    expect(platform_module.getPlatformDetailsFromDir).toHaveBeenCalledWith(directory_to_platform, null);
                    expect(platform_addHelper.downloadPlatform).not.toHaveBeenCalled();
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
            });
            it('should retrieve platform details from URLs-specified-as-platforms using downloadPlatform', function (done) {
                cordova_util.isUrl.and.returnValue(true);
                var url_to_platform = 'http://github.com/apache/cordova-atari';
                platform_addHelper('add', hooks_mock, projectRoot, [url_to_platform]).then(function () {
                    expect(platform_addHelper.downloadPlatform).toHaveBeenCalledWith(projectRoot, null, url_to_platform, jasmine.any(Object));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
            });
            it('should attempt to retrieve from package.json if exists in project');
            it('should attempt to retrieve from config.xml if exists and package.json does not');
            it('should fall back to using pinned version if both package.json and config.xml do not specify it');
            it('should invoke fetch if provided as an option and spec is a directory');
        });
        describe('platform api invocation', function () {
            it('should invoke the createPlatform platform API method when adding a platform, providing destination location, parsed config file and platform detail options as arguments');
            it('should invoke the update platform API method when updating a platform, providing destination location and plaform detail options as arguments');
        });
        describe('after platform api invocation', function () {
            describe('when the restoring option is not provided', function () {
                it('should invoke preparePlatforms twice (?!?), once before installPluginsForNewPlatforms and once after... ?!');
            });
            it('should invoke the installPluginsForNewPlatforms method in the platform-add case');
            it('should save the platform metadata');
            it('should write out the version of platform just added/updated to config.xml if the save option is provided');
            describe('if the project contains a package.json', function () {
                it('should write out the platform just added/updated to the cordova.platforms property of package.json');
                it('should only write the package.json file if it was modified');
            });
            it('should file the after_platform_* hook');
        });
    });
    describe('downloadPlatform', function () {
        describe('errors', function () {
            it('should reject the promise should fetch fail');
            it('should reject the promise should lazy_load.git_clone fail');
            it('should reject the promise should lazy_load.based_on_config fail');
            it('should reject the promise should both git_clone and based_on_config fail after the latter was fallen back on');
        });
        describe('happy path', function () {
            it('should invoke cordova-fetch if fetch was provided as an option');
            it('should invoke lazy_load.git_clone if the version to download is a URL');
            it('should attempt to lazy_load.based_on_config if lazy_load.git_clone fails');
            it('should by default attempt to lazy_load.based_on_config');
            it('should pass along a libDir argument to getPlatformDetailsFromDir on a successful platform download');
        });
    });
    describe('installPluginsForNewPlatform', function () {
        beforeEach(function () {
            spyOn(fetch_metadata, 'get_fetch_metadata');
            spyOn(plugman, 'install').and.returnValue(Q());
        });
        // TODO: these these by checking plugman.install calls.
        it('should immediately return if there are no plugins to install into the platform');
        it('should invoke plugman.install, giving correct platform, plugin and other arguments');
        it('should include any plugin variables as options when invoking plugman install');
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

    // TODO: for the tests below, do we have the test coverage these tests _aim_ to provide already
    // written up in the specs above? are we sure that these tests exercise code from addHelper.js, or possibly other places? unit tests should test logic local to only one module - not test code of a dependent module.
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
    });
});
