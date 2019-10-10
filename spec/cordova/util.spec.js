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

var path = require('path');
var fs = require('fs-extra');
var util = require('../../src/cordova/util');
var events = require('../../cordova-lib').events;
var helpers = require('../helpers');

var cwd = process.cwd();
var origPWD = process.env['PWD'];

describe('util module', function () {
    let temp;
    beforeEach(() => {
        temp = helpers.tmpDir('cordova.util.spec');
    });
    afterEach(() => {
        process.chdir(__dirname);
        fs.removeSync(temp);
    });

    describe('isCordova method', function () {
        let somedir, anotherdir;
        beforeEach(() => {
            // Base test directory setup
            somedir = path.join(temp, 'somedir');
            anotherdir = path.join(somedir, 'anotherdir');
            fs.ensureDirSync(anotherdir);
        });
        afterEach(function () {
            process.env['PWD'] = origPWD;
            process.chdir(cwd);
        });
        it('Test 002 : should return false if it cannot find a Cordova project directory up the directory tree', function () {
            expect(util.isCordova(somedir)).toEqual(false);
        });
        it('Test 003 : should recognize a Cordova project directory', function () {
            fs.ensureDirSync(path.join(somedir, 'www', 'config.xml'));
            expect(util.isCordova(somedir)).toEqual(somedir);
        });
        it('Test 004 : should ignore PWD when it is undefined', function () {
            delete process.env['PWD'];
            fs.ensureDirSync(path.join(somedir, 'www'));
            fs.ensureDirSync(path.join(somedir, 'config.xml'));
            process.chdir(anotherdir);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('Test 005 : should use PWD when available', function () {
            fs.ensureDirSync(path.join(somedir, 'www', 'config.xml'));
            process.env['PWD'] = anotherdir;
            process.chdir(path.sep);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('Test 006 : should use cwd as a fallback when PWD is not a cordova dir', function () {
            fs.ensureDirSync(path.join(somedir, 'www', 'config.xml'));
            process.env['PWD'] = path.sep;
            process.chdir(anotherdir);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('Test 007 : should ignore platform www/config.xml', function () {
            fs.ensureDirSync(path.join(anotherdir, 'www', 'config.xml'));
            fs.ensureDirSync(path.join(somedir, 'www'));
            fs.ensureDirSync(path.join(somedir, 'config.xml'));
            expect(util.isCordova(anotherdir)).toEqual(somedir);
        });
    });
    describe('deleteSvnFolders method', function () {
        it('Test 008 : should delete .svn folders in any subdirectory of specified dir', function () {
            var one = path.join(temp, 'one');
            var two = path.join(temp, 'two');
            var one_svn = path.join(one, '.svn');
            var two_svn = path.join(two, '.svn');
            fs.ensureDirSync(one_svn);
            fs.ensureDirSync(two_svn);
            util.deleteSvnFolders(temp);
            expect(fs.existsSync(one_svn)).toEqual(false);
            expect(fs.existsSync(two_svn)).toEqual(false);
        });
    });
    describe('listPlatforms method', function () {
        it('Test 009 : should only return supported platform directories present in a cordova project dir', function () {
            var platforms = path.join(temp, 'platforms');

            fs.ensureDirSync(path.join(platforms, 'android'));
            fs.ensureDirSync(path.join(platforms, 'ios'));
            fs.ensureDirSync(path.join(platforms, 'wp8'));
            fs.ensureDirSync(path.join(platforms, 'atari'));

            // create a typical platforms.json file, it should not be returned as a platform
            fs.ensureFileSync(path.join(platforms, 'platforms.json'));

            var res = util.listPlatforms(temp);
            expect(res.length).toEqual(4);
        });
    });
    describe('getInstalledPlatformsWithVersions method', function () {
        it('Test 010 : should get the supported platforms in the cordova project dir along with their reported versions', function () {
            const PLATFORM = 'cordova-android';
            const platformPath = path.join(temp, 'platforms', PLATFORM);

            return helpers.getFixture('androidApp').copyTo(platformPath)
                .then(_ => util.getInstalledPlatformsWithVersions(temp))
                .then(versions => expect(versions[PLATFORM]).toBe('8.1.0'));
        });
    });
    describe('findPlugins method', function () {
        it('Test 011 : should only return plugin directories present in a cordova project dir', function () {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var wp8_dir = path.join(plugins, 'wp8');
            var atari = path.join(plugins, 'atari');
            fs.ensureDirSync(android);
            fs.ensureDirSync(ios);
            fs.ensureDirSync(wp8_dir);
            fs.ensureDirSync(atari);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(4);
        });
        it('Test 012 : should not return ".svn" directories', function () {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var svn = path.join(plugins, '.svn');
            fs.ensureDirSync(android);
            fs.ensureDirSync(ios);
            fs.ensureDirSync(svn);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(2);
            expect(res.indexOf('.svn')).toEqual(-1);
        });
        it('Test 013 : should not return "CVS" directories', function () {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var cvs = path.join(plugins, 'CVS');
            fs.ensureDirSync(android);
            fs.ensureDirSync(ios);
            fs.ensureDirSync(cvs);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(2);
            expect(res.indexOf('CVS')).toEqual(-1);
        });
    });

    describe('preprocessOptions method', function () {

        var isCordova, listPlatforms;
        var DEFAULT_OPTIONS = {
            // 'android' is here because we create a spy
            // for listPlatforms below that returns 'android'
            platforms: ['android'],
            verbose: false
        };

        beforeEach(function () {
            isCordova = spyOn(util, 'isCordova').and.returnValue('/fake/path');
            listPlatforms = spyOn(util, 'listPlatforms').and.returnValue(['android']);
        });

        it('Test 014 : should throw if called outside of cordova project', function () {
            isCordova.and.returnValue(false);
            expect(function () { util.preProcessOptions(); }).toThrow();
        });

        it('Test 015 : should throw when no platforms added to project', function () {
            listPlatforms.and.returnValue([]);
            expect(function () { util.preProcessOptions(); }).toThrow();
        });

        it('Test 016 : should return default options when no arguments passed', function () {
            expect(util.preProcessOptions()).toEqual(jasmine.objectContaining(DEFAULT_OPTIONS));
        });

        it('Test 017 : should accept single string argument as platform name', function () {
            expect(util.preProcessOptions('ios')).toEqual(jasmine.objectContaining({ platforms: ['ios'] }));
        });

        it('Test 018 : should accept array of strings as platform names', function () {
            expect(util.preProcessOptions(['ios', 'windows'])).toEqual(jasmine.objectContaining({ platforms: ['ios', 'windows'] }));
        });

        it('Test 019 : should fall back to installed platform if input doesn\'t contain platforms list', function () {
            expect(util.preProcessOptions({ verbose: true }))
                .toEqual(jasmine.objectContaining({ platforms: ['android'], verbose: true }));
        });

        it('Test 020 : should pick buildConfig if no option is provided, but buildConfig.json exists', function () {
            spyOn(fs, 'existsSync').and.returnValue(true);
            // Using path.join below to normalize path separators
            expect(util.preProcessOptions())
                .toEqual(jasmine.objectContaining({ options: { buildConfig: path.join('/fake/path/build.json') } }));
        });

        describe('getPlatformApiFunction', function () {

            it('Test 030 : successfully find platform Api', function () {
                const FIXTURE_PROJECT = path.join(__dirname, 'fixtures/projects/platformApi/');
                const API_PATH = path.join(FIXTURE_PROJECT, 'platforms/windows/cordova/Api.js');
                spyOn(events, 'emit');

                util.getPlatformApiFunction(API_PATH, 'cordova-platform-fixture');

                expect(events.emit.calls.count()).toBe(1);
                expect(events.emit.calls.argsFor(0)[1]).toMatch('Platform API successfully found in:');
            });
        });
    });
});
