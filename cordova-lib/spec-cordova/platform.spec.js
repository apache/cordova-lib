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

    beforeEach(function () {

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
            cfg = {};
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


	platform.__set__('resolvePath', function(p){
	    return p;
	});

	platform.__set__('getPackageJsonContent', function (p) {
            return p + '\\package';
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

    afterEach(function () {

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
                        // Induce test failure if invalid event is passed.
		        // Jasmine doesn't have an explicit 'make test fail' function, so we'll use this one
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

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        // Mock out package.json content
        platform.__set__('getPackageJsonContent', function (p) {
            return {
                'name': 'cordova-android',
                'version': '3.7.0-dev',
                'description': 'cordova-android release',
                'main': 'bin/create'
            };
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(call_into_create_mock).toHaveBeenCalledWith('android', projectRoot, cfg, targets[0], null, opts);
            done();
        });
    });

    it('throws if target directory supplied does not contain package.json file', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-android'];

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.__set__('getPackageJsonContent', function (p) {
            var pPath = path.join(p, 'package');
            var msg = "Cannot find module '" + pPath + "'";
            var err = new Error(msg);
            err.code = 'MODULE_NOT_FOUND';
            throw err;
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            var packagePath = path.join(targets[0], 'package');
            expect(error.message).toBe('The provided path does not seem to contain a ' + 'Cordova platform: ' + targets[0] +
                '\n' + 'Cannot find module ' + "'" + packagePath + "'");
            done();
        });
    });

    it('throws if package.json file does not contain name property', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-android'];

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.__set__('getPackageJsonContent', function (p) {
            return {
                //'name': 'cordova-android', // Don't return any name
                'version': '3.7.0-dev',
                'description': 'cordova-android release',
                'main': 'bin/create'
            };
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            var packagePath = path.join(targets[0], 'package');
            expect(error.message).toBe('The provided path does not seem to contain a ' + 'Cordova platform: ' + targets[0]);
            done();
        });
    });

    it('replaces "amazon" by "amazon-fireos" if package.json returns "amazon"', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-amazon-fireos'];

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.__set__('getPackageJsonContent', function (p) {
            return {
                'name': 'cordova-amazon', // use 'cordova-amazon' instead of 'cordova-amazon-fireos'
                'version': '3.7.0-dev',
                'description': 'cordova-amazon-fireos release',
                'main': 'bin/create'
            };
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function (error) {
            expect(call_into_create_mock).toHaveBeenCalledWith('amazon-fireos', projectRoot, cfg, targets[0], null, opts);
            done();
        });
    });

    it('throws if package.json file returns null', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-android'];

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.__set__('getPackageJsonContent', function (p) {
            return null;
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            var packagePath = path.join(targets[0], 'package');
            expect(error.message).toBe('The provided path does not seem to contain a ' + 'Cordova platform: ' + targets[0]);
            done();
        });
    });

    it('throws if the name in package.json file is not a recognized platform', function (done) {

        var targets = ['C:\\Projects\\cordova-projects\\cordova-android'];

        // These are the only 'recognized' platforms
        platform.__set__('platforms', {
            "ios": {
                "hostos": ["darwin"],
                "parser": "./metadata/ios_parser",
                "url": "https://git-wip-us.apache.org/repos/asf?p=cordova-ios.git",
                "version": "3.7.0"
            }
        });

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.__set__('getPackageJsonContent', function () {
            return {
                'name': 'cordova-android',
                'version': '3.7.0-dev',
                'description': 'cordova-android release',
                'main': 'bin/create'
            };
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            var packagePath = path.join(targets[0], 'package');
            expect(error.message).toBe('The provided path does not seem to contain a ' + 'Cordova platform: ' + targets[0]);
            done();
        });
    });

    it('uses lazy_loading when the target is specified by name', function (done) {

        var targets = ['android'];

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        var based_on_config_called = false;
        platform.__set__('lazy_load', {
            based_on_config: function (projectRoot, t, opts) {
                based_on_config_called = true;
                return Q(libDir);
            }
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(based_on_config_called).toBeTruthy();
            expect(call_into_create_mock).toHaveBeenCalledWith('android', projectRoot, cfg, libDir, null, opts);
            done();
        });
    });

    it('throws if lazy_loading fails', function (done) {

        var targets = ['android'];

        // Error out during 'lazy load'
        var errorMessage = 'Cordova library "' + targets[0] + '" not recognized.';
        platform.__set__('lazy_load', {
            based_on_config: function (projectRoot, t, opts) {
                return Q.reject(new Error(errorMessage));
            }
        });

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
            expect(error.message).toBe('Unable to fetch platform ' + targets[0] + ': ' + 'Error: ' + errorMessage);
            expect(call_into_create_mock).not.toHaveBeenCalled();
            done();
        });
    });

    it('allows targets of the form "platform@version" where "version" is a url', function (done) {

        var targets = ['wp8@https://git-wip-us.apache.org/repos/asf?p=cordova-wp8.git;a=snapshot;h=3.7.0;sf=tgz'];

        var call_into_create_mock = jasmine.createSpy();
        platform.__set__('call_into_create', call_into_create_mock);

        var based_on_config_called = false;
        platform.__set__('lazy_load', {
            based_on_config: function (projectRoot, t, opts) {
                based_on_config_called = true;
                return Q(libDir);
            }
        });

        platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
            expect(based_on_config_called).toBeTruthy();
            expect(call_into_create_mock).toHaveBeenCalledWith('wp8', projectRoot, cfg, libDir, null, opts);
            done();
        });
    });
});
