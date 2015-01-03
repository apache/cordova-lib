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

var helpers = require('./helpers'),
    path = require('path'),
    fs = require('fs'),
    shell = require('shelljs'),
    platforms = require('../src/cordova/platforms'),
    superspawn = require('../src/cordova/superspawn'),
    config = require('../src/cordova/config'),
    Q = require('q'),
    events = require('../src/events'),
    cordova = require('../src/cordova/cordova'),
    rewire = require('rewire'),
    platform = rewire('../src/cordova/platform.js');

var projectRoot = 'C:\\Projects\\cordova-projects\\move-tracker';

// Directory containing the 'bin/create' script. 
var libDir = "C:\\Projects\\cordova-projects\\cordova-android\\";

var cfg;
var opts;
var hooksRunnerMock;
var hostSupportsOriginal = platform.__get__('hostSupports');
var ConfigParserOriginal = platform.__get__('ConfigParser');
var configOriginal = platform.__get__('config');
var fsOriginal = platform.__get__('fs');
var platformsOriginal = platform.__get__('platforms');
var promiseUtilOriginal = platform.__get__('promiseutil');
var getPackageJsonContentOriginal = platform.__get__('getPackageJsonContent');

describe('platform end-to-end', function () {

    var supported_platforms = Object.keys(platforms).filter(function (p) { return p != 'www'; });
    var tmpDir = helpers.tmpDir('platform_test');
    var project = path.join(tmpDir, 'project');
    var platformParser = platforms[helpers.testPlatform].parser;

    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
    });
    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    // Factoring out some repeated checks.
    function emptyPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms: (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBe(-1);
        });
    }
    function fullPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms: (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
        });
    }

    // The flows we want to test are add, rm, list, and upgrade.
    // They should run the appropriate hooks.
    // They should fail when not inside a Cordova project.
    // These tests deliberately have no beforeEach and afterEach that are cleaning things up.
    it('should successfully run', function(done) {
        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'base'), tmpDir);
        shell.mv(path.join(tmpDir, 'base'), project);
        process.chdir(project);

        // Now we load the config.json in the newly created project and edit the target platform's lib entry
        // to point at the fixture version. This is necessary so that cordova.prepare can find cordova.js there.
        var c = config.read(project);
        c.lib[helpers.testPlatform].url = path.join(__dirname, 'fixtures', 'platforms', helpers.testPlatform + '-lib');
        config.write(project, c);

        // The config.json in the fixture project points at fake "local" paths.
        // Since it's not a URL, the lazy-loader will just return the junk path.
        spyOn(superspawn, 'spawn').andCallFake(function(cmd, args) {
            if (cmd.match(/create\b/)) {
                // This is a call to the bin/create script, so do the copy ourselves.
                shell.cp('-R', path.join(__dirname, 'fixtures', 'platforms', 'android'), path.join(project, 'platforms'));
            } else if(cmd.match(/version\b/)) {
                return Q('3.3.0');
            } else if(cmd.match(/update\b/)) {
                fs.writeFileSync(path.join(project, 'platforms', helpers.testPlatform, 'updated'), 'I was updated!', 'utf-8');
            }
            return Q();
        });

        events.on('results', function(res) { results = res; });

        // Check there are no platforms yet.
        emptyPlatformList().then(function() {
            // Add the testing platform.
            return cordova.raw.platform('add', [helpers.testPlatform]);
        }).then(function() {
            // Check the platform add was successful.
            expect(path.join(project, 'platforms', helpers.testPlatform)).toExist();
            expect(path.join(project, 'platforms', helpers.testPlatform, 'cordova')).toExist();
        }).then(fullPlatformList) // Check for it in platform ls.
        .then(function() {
            // Try to update the platform.
            return cordova.raw.platform('update', [helpers.testPlatform]);
        }).then(function() {
            // Our fake update script in the exec mock above creates this dummy file.
            expect(path.join(project, 'platforms', helpers.testPlatform, 'updated')).toExist();
        }).then(fullPlatformList) // Platform should still be in platform ls.
        .then(function() {
            // And now remove it.
            return cordova.raw.platform('rm', [helpers.testPlatform]);
        }).then(function() {
            // It should be gone.
            expect(path.join(project, 'platforms', helpers.testPlatform)).not.toExist();
        }).then(emptyPlatformList) // platform ls should be empty too.
        .fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    });
});

describe('add function', function () {
    
    beforeEach(function(){
	
        opts = {};
	
        hooksRunnerMock = {
            fire: function () {
                return Q();
            }
        };

        platform.__set__('hostSupports', function (platform) {
            return true;
        });

        platform.__set__('ConfigParser', function (xml) {
            cfg = 
		{
		    getEngines: function() {
		        return [
                    {
                        name: 'cordova-android',
                        value: '3.2.0'
                    },
                    {
                        name: 'cordova-wp8',
                        value: '2.1.0'
                    }
		        ];
		    }		
		};
            return cfg;
        });
	
        platform.__set__('config', {
            read: function (projectRoot) {
                return {};
            }
        });

        platform.__set__('fs', {
            existsSync: function (path) {
                return true;
            }
        });

        // These are the recognized/legal platforms
        platform.__set__('platforms', {
            'android': {
                'parser': './metadata/android_parser',
                'url': 'https://git-wip-us.apache.org/repos/asf?p=cordova-android.git',
                'version': '3.6.4'
            },
            'ios': {
                'hostos': ['darwin'],
                'parser': './metadata/ios_parser',
                'url': 'https://git-wip-us.apache.org/repos/asf?p=cordova-ios.git',
                'version': '3.7.0'
            },
            'wp8': {
                'hostos': ['win32'],
                'parser': './metadata/wp8_parser',
                'url': 'https://git-wip-us.apache.org/repos/asf?p=cordova-wp8.git',
                'version': '3.7.0',
                'altplatform': 'wp'
            },
            'amazon-fireos': {
                'name': 'cordova-amazon-fireos',
                'version': '3.7.0-dev',
                'description': 'cordova-amazon-fireos release',
                'main': 'bin/create'
            }
        });

    });

    afterEach(function(){
	
        platform.__set__('hostSupports', hostSupportsOriginal);
        platform.__set__('ConfigParser', ConfigParserOriginal);
        platform.__set__('config', configOriginal);
        platform.__set__('fs', fsOriginal);
        platform.__set__('platforms', platformsOriginal);
        platform.__set__('promiseutil', promiseUtilOriginal);
        platform.__set__('getPackageJsonContent', getPackageJsonContentOriginal);

    });

    it('throws if the target list is empty', function (done) {
        var targets = [];
        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            expect(error.message).toBe("No platform specified. Please specify a platform to add. See `cordova platform list`.");
            done();
        });
    });

    it('throws if the target list is undefined or null', function (done) {

        // case 1 : target list undefined
        var targets; // = undefined;
        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            expect(error.message).toBe("No platform specified. Please specify a platform to add. See `cordova platform list`.");
        });

        // case 2 : target list null
        targets = null;
        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            expect(error.message).toBe("No platform specified. Please specify a platform to add. See `cordova platform list`.");
            done();
        });
    });

    it('creates the "platforms" directory if it does not exist', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-android'];
        var wasPlatformDirectoryCreated = false;

        // Make it so that 'platforms' directory doesn't exist
        platform.__set__('fs', {
            existsSync: function () {
                return false;
            }
        });

        // Do nothing with the targets (only in this test)
        platform.__set__('promiseutil', {
            Q_chainmap: function () {
                return Q();
            }
        });

        platform.__set__('shell', {
            mkdir: function () {
                wasPlatformDirectoryCreated = true;
            }
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(wasPlatformDirectoryCreated).toBeTruthy();
            done();
        });
    });

    it('fires events "before_platform_add" and "after_platform_add" in the right order and at the right time', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-android'];

        // events 
        var before_platform_add_fired = false;
        var after_platform_add_fired = false;
        var platforms_added = false;

        var hooksRunnerMock = {
            fire: function (event, opts) {
                switch (event) {
                    case 'before_platform_add':
                        before_platform_add_fired = true;
                        expect(after_platform_add_fired).toBeFalsy();
                        expect(platforms_added).toBeFalsy();
                        break;
                    case 'after_platform_add':
                        after_platform_add_fired = true;
                        expect(before_platform_add_fired).toBeTruthy();
                        expect(platforms_added).toBeTruthy();
                        break;
                    default:
                        // induce test failure : test this !
                        // fail('invalid event fired');
                        expect(1).toBe(2);
                }
                return Q();
            }
        };
        platform.__set__('promiseutil', {
            Q_chainmap: function (targets, func) {
                platforms_added = true;
                expect(before_platform_add_fired).toBeTruthy();
                expect(after_platform_add_fired).toBeFalsy();
                return Q();
            }
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(before_platform_add_fired).toBeTruthy();
            expect(after_platform_add_fired).toBeTruthy();
            expect(platforms_added).toBeTruthy();
            done();
        });
    });

    it('runs the create script in the target directory when passed a directory as target', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-android'];

        var getPlatformDetailsFromDirMock = jasmine.createSpy();
        getPlatformDetailsFromDirMock.andReturn(Q({
            platform: 'android',
            libDir: targets[0]
        }));
        platform.__set__('getPlatformDetailsFromDir', getPlatformDetailsFromDirMock);

        var downloadPlatformMock = jasmine.createSpy();
        platform.__set__('downloadPlatform', downloadPlatformMock);

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(getPlatformDetailsFromDirMock).toHaveBeenCalledWith(targets[0]);
            expect(downloadPlatformMock).not.toHaveBeenCalled();
            expect(call_into_create_mock).toHaveBeenCalledWith('android', projectRoot, cfg, targets[0], null, opts);
            done();
        });
    });

    it('fails if there is an error while getting the platform details', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-android'];

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.__set__('getPlatformDetailsFromDir', function(){ // put this in globals section ? and reset
            var msg = 'The provided path does not seem to contain a Cordova platform: ' + targets[0];
            return Q.reject(new Error(msg));
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            var packagePath = path.join(targets[0], 'package');
            expect(error.message).toBe('The provided path does not seem to contain a ' + 'Cordova platform: ' + targets[0]);
            expect(call_into_create_mock).not.toHaveBeenCalled();
            done();
        });
    });

    it('downloads and uses the version of platform retrieved from config.xml when the target is specified by name with no version', function (done) {

        var targets = ['android'];
        var versionInConfigXML = '6.2.1';

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        var getVersionFromConfigFileMock = jasmine.createSpy().andReturn(versionInConfigXML); 
        platform.__set__('getVersionFromConfigFile', getVersionFromConfigFileMock);

        var downloadPlatformMock = jasmine.createSpy().andReturn(Q({
            platform: 'android',
            libDir: libDir
        }));
        platform.__set__('downloadPlatform', downloadPlatformMock);

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(getVersionFromConfigFileMock).toHaveBeenCalledWith('android', cfg);
            expect(downloadPlatformMock).toHaveBeenCalledWith(projectRoot, 'android@' + versionInConfigXML, opts);
            expect(call_into_create_mock).toHaveBeenCalledWith('android', projectRoot, cfg, libDir, null, opts);
            done();
        });
    });
    
    it('fails if there is an error while downloading the platform', function(done) {

        var targets = ['android'];
        var errorMessage = 'Unable to fetch platform andythoroid : Cordova library \'andythoroid\' not recognized.';
        platform.__set__('downloadPlatform', function(){
            throw new Error(errorMessage);
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function(error){
            expect(error.message).toBe(errorMessage);
            done();
        });
    });

    it('allows targets of the form "platform@version" where "version" is a url', function (done) {

        var targets = ['wp8@https://git-wip-us.apache.org/repos/asf?p=cordova-wp8.git;a=snapshot;h=3.7.0;sf=tgz'];

        var call_into_create_mock = jasmine.createSpy(); 
        platform.__set__('call_into_create', call_into_create_mock);

        var wasDownloadPlatformCalled = false;
        platform.__set__('downloadPlatform', function(){
            wasDownloadPlatformCalled = true;
            return Q({
                platform: 'wp8',
                libDir: libDir
            });
        });
	
        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(wasDownloadPlatformCalled).toBeTruthy();
            expect(call_into_create_mock).toHaveBeenCalledWith('wp8', projectRoot, cfg, libDir, null, opts);
            done();
        });
    });

    it('downloads and uses the pinned CLI version if platform has no version and config.xml has no corresponding engine', function(done) {
	
        var targets = ['android'];
	
        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.__set__('getVersionFromConfigFile', function(){
            return null;
        });

        var downloadPlatformMock = jasmine.createSpy().andReturn(Q({
            platform: 'android',
            libDir: libDir
        }));
        platform.__set__('downloadPlatform', downloadPlatformMock);

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(call_into_create_mock).toHaveBeenCalledWith('android', projectRoot, cfg, libDir, null, opts);
            expect(downloadPlatformMock).toHaveBeenCalledWith(projectRoot, 'android', opts);
            done();
        });
    });

    it('uses the directory in config.xml when the target has no version', function(done) {

        // uses the directory. make changes to other tests
        var targets = ['android'];

        platform.__set__('getVersionFromConfigFile', function(){
            return "file://C:/path/to/android/platform";
        });

        var downloadPlatformMock = jasmine.createSpy();
        platform.__set__('downloadPlatform', downloadPlatformMock);

        var getPlatformDetailsFromDirMock = jasmine.createSpy().andReturn(Q({
            platform: 'android',
            libDir: 'C:/path/to/android/platform'
        }));
        platform.__set__('getPlatformDetailsFromDir', getPlatformDetailsFromDirMock);

        var isDirectoryMock = jasmine.createSpy().andReturn(true);
        platform.__set__('isDirectory', isDirectoryMock);

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);
	
        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function(){
            expect(downloadPlatformMock).not.toHaveBeenCalled();
            expect(getPlatformDetailsFromDirMock).toHaveBeenCalledWith('C:/path/to/android/platform');
            expect(call_into_create_mock).toHaveBeenCalledWith('android', projectRoot, cfg, 'C:/path/to/android/platform', null, opts);
            done();
        });
	
    });

    it('uses the version from config.xml when no version is specified', function(done) {
		
        var targets = ['ios']; // no version part, as opposed to 'android@1.4.0'
        var version = '3.6.2';
	
        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock); 
	
        platform.__set__('getVersionFromConfigFile', function () {
            return version;
        });
		
        var downloadPlatformMock = jasmine.createSpy().andReturn(Q({
            platform: 'ios',
            libDir: libDir
        }));
        platform.__set__('downloadPlatform', downloadPlatformMock);

        var isDirectoryMock = jasmine.createSpy().andReturn(false);
        platform.__set__('isDirectory', isDirectoryMock);

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(downloadPlatformMock).toHaveBeenCalledWith(projectRoot, (targets[0] + '@' + version), opts);
            expect(call_into_create_mock).toHaveBeenCalledWith('ios', projectRoot, cfg, libDir, null, opts);
            done();
        });
    });

    it('uses the version of platform pinned in the CLI when the target is specified by name with no version and config.xml contains no corresponding engine', function(done) {
		
        var targets = ['ios']; // no version part, as opposed to 'android@1.4.0'
        var version = null;
	
        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock); 
	
        platform.__set__('getVersionFromConfigFile', function () {
            return version; // null
        });
		
        var downloadPlatformMock = jasmine.createSpy().andReturn(Q({
            platform: 'ios',
            libDir: libDir
        }));
        platform.__set__('downloadPlatform', downloadPlatformMock);

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(downloadPlatformMock).toHaveBeenCalledWith(projectRoot, targets[0], opts);
            expect(call_into_create_mock).toHaveBeenCalledWith('ios', projectRoot, cfg, libDir, null, opts);
            done();
        });
    });
});

describe('downloadPlatform function', function(){
    
    var downloadPlatform = platform.__get__('downloadPlatform'); // function under test
 
    it('throws if lazy_loading fails', function (done) {

        var target = 'android';

        // Error out during 'lazy load'
        var errorMessage = 'Cordova library "' + target + '" not recognized.';
        platform.__set__('lazy_load', {
            based_on_config: function (projectRoot, t, opts) {
                return Q.reject(new Error(errorMessage));
            }
        });

        downloadPlatform(projectRoot, target, opts).fail(function (error) {
            expect(error.message).toBe('Unable to fetch platform ' + target + ': ' + 'Error: ' + errorMessage);
            done();
        });
    });
    
    it('allows targets of the form "platform@version" where "version" is a url', function (done) {

        var target = 'wp8@https://git-wip-us.apache.org/repos/asf?p=cordova-wp8.git;a=snapshot;h=3.7.0;sf=tgz';

        var based_on_config_called = false;
        platform.__set__('lazy_load', {
            based_on_config: function (projectRoot, t, opts) {
                based_on_config_called = true;
                return Q(libDir);
            }
        });

        downloadPlatform(projectRoot, target, opts).then(function (platformDetails) {
            expect(based_on_config_called).toBeTruthy();
            expect(platformDetails.platform).toBe('wp8');
	    expect(platformDetails.libDir).toBe(libDir);
            done();
        });
    });

    it('returns name and libDir of downloaded platform', function (done) {
	
        var target = 'wp8@3.1.0';

        var based_on_config_called = false;
        platform.__set__('lazy_load', {
            based_on_config: function (projectRoot, t, opts) {
                based_on_config_called = true;
                return Q(libDir);
            }
        });

        downloadPlatform(projectRoot, target, opts).then(function (platformDetails) {
            expect(based_on_config_called).toBeTruthy();
            expect(platformDetails.platform).toBe('wp8');
	    expect(platformDetails.libDir).toBe(libDir);
            done();
        });
    });
});

describe('getPlatformDetailsFromDir function', function(){

    var dir = 'C:\\Projects\\cordova-projects\\cordova-android';
    var getPlatformDetailsFromDir = platform.__get__('getPlatformDetailsFromDir'); // function under test
    
    it('returns the appropriate platform details', function(done){

        // Mock out package.json content
        platform.__set__('getPackageJsonContent', function (p) {
            return {
                'name': 'cordova-android',
                'version': '3.7.0-dev',
                'description': 'cordova-android release',
                'main': 'bin/create'
            };
        });

        getPlatformDetailsFromDir(dir).then(function (platformDetails) {
	    expect(platformDetails.platform).toBe('android');
	    expect(platformDetails.libDir).toBe(dir);
            done();
        });
    });

    it('throws if the directory supplied does not contain a package.json file', function (done) {

        platform.__set__('getPackageJsonContent', function (p) {
            var pPath = path.join(p, 'package');
            var msg = "Cannot find module '" + pPath + "'";
            var err = new Error(msg);
            err.code = 'MODULE_NOT_FOUND';
            throw err;
        });

        getPlatformDetailsFromDir(dir).fail(function (error) {
            var packagePath = path.join(dir, 'package');
            expect(error.message).toBe('The provided path does not seem to contain a Cordova platform: ' + dir +
				       '\n' + 'Cannot find module ' + "'" + packagePath + "'");
            done();
        });
    });

    it('replaces "amazon" by "amazon-fireos" if package.json returns "amazon"', function (done) {

        var dir = 'C:\\Projects\\cordova-projects\\cordova-amazon-fireos';

        platform.__set__('getPackageJsonContent', function (p) {
            return {
                'name': 'cordova-amazon', // use 'cordova-amazon' instead of 'cordova-amazon-fireos'
                'version': '3.7.0-dev',
                'description': 'cordova-amazon-fireos release',
                'main': 'bin/create'
            };
        });

        getPlatformDetailsFromDir(dir).then(function (platformDetails) {
	    expect(platformDetails.libDir).toBe(dir);
	    expect(platformDetails.platform).toBe('amazon-fireos');
            done();
        });
    });

    it('throws if package.json file has no name property', function (done) {
	
        platform.__set__('getPackageJsonContent', function (p) {
            return {
		//name: 'cordova-android' --> No name
	    };
        });

        getPlatformDetailsFromDir(dir).fail(function (error) {
            var packagePath = path.join(dir, 'package');
            expect(error.message).toBe('The provided path does not seem to contain a ' + 'Cordova platform: ' + dir);
            done();
        });
    });

    it('throws if package.json file returns null', function (done) {
	
        platform.__set__('getPackageJsonContent', function (p) {
            return null;
        });

        getPlatformDetailsFromDir(dir).fail(function (error) {
            var packagePath = path.join(dir, 'package');
            expect(error.message).toBe('The provided path does not seem to contain a ' + 'Cordova platform: ' + dir);
            done();
        });
    });

    it('throws if the name in package.json file is not a recognized platform', function (done) {

        // These are the only 'recognized' platforms
        platform.__set__('platforms', {
            "ios": {
                "hostos": ["darwin"],
                "parser": "./metadata/ios_parser",
                "url": "https://git-wip-us.apache.org/repos/asf?p=cordova-ios.git",
                "version": "3.7.0"
            }
        });

        platform.__set__('getPackageJsonContent', function () {
            return {
                'name': 'cordova-android',
                'version': '3.7.0-dev',
                'description': 'cordova-android release',
                'main': 'bin/create'
            };
        });

        getPlatformDetailsFromDir(dir).fail(function (error) {
            var packagePath = path.join(dir, 'package');
            expect(error.message).toBe('The provided path does not seem to contain a ' + 'Cordova platform: ' + dir);
            done();
        });
    });
});
