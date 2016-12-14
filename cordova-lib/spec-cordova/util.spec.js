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

/* jshint sub: true */

var shell = require('shelljs'),
    path = require('path'),
    fs = require('fs'),
    util = require('../src/cordova/util'),
    events = require('../cordova-lib').events,
    helpers = require('./helpers'),
    temp = path.join(__dirname, '..', 'temp');

var cwd = process.cwd();
var home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var origPWD = process.env['PWD'];

describe('util module', function() {
    describe('isCordova method', function() {
        afterEach(function() {
            process.env['PWD'] = origPWD;
            process.chdir(cwd);
        });
        function removeDir(directory) {
            shell.rm('-rf', directory);            
        }
        it('should return false if it hits the home directory', function() {
            var somedir = path.join(home, 'somedir');
            removeDir(somedir);
            shell.mkdir(somedir);
            expect(util.isCordova(somedir)).toEqual(false);
        });
        it('should return false if it cannot find a .cordova directory up the directory tree', function() {
            var somedir = path.join(home, '..');
            expect(util.isCordova(somedir)).toEqual(false);
        });
        it('should return the first directory it finds with a .cordova folder in it', function() {
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            removeDir(somedir);
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
            expect(util.isCordova(somedir)).toEqual(somedir);
        });
        it('should ignore PWD when its undefined', function() {
            delete process.env['PWD'];
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            removeDir(somedir);
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(somedir, 'www'));
            shell.mkdir('-p', path.join(somedir, 'config.xml'));
            process.chdir(anotherdir);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('should use PWD when available', function() {
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            removeDir(somedir);
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
            process.env['PWD'] = anotherdir;
            process.chdir(path.sep);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('should use cwd as a fallback when PWD is not a cordova dir', function() {
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            removeDir(somedir);
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
            process.env['PWD'] = path.sep;
            process.chdir(anotherdir);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('should ignore platform www/config.xml', function() {
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            removeDir(somedir);
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(anotherdir, 'www', 'config.xml'));
            shell.mkdir('-p', path.join(somedir, 'www'));
            shell.mkdir('-p', path.join(somedir, 'config.xml'));
            expect(util.isCordova(anotherdir)).toEqual(somedir);
        });
    });
    describe('deleteSvnFolders method', function() {
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        it('should delete .svn folders in any subdirectory of specified dir', function() {
            var one = path.join(temp, 'one');
            var two = path.join(temp, 'two');
            var one_svn = path.join(one, '.svn');
            var two_svn = path.join(two, '.svn');
            shell.mkdir('-p', one_svn);
            shell.mkdir('-p', two_svn);
            util.deleteSvnFolders(temp);
            expect(fs.existsSync(one_svn)).toEqual(false);
            expect(fs.existsSync(two_svn)).toEqual(false);
        });
    });
    describe('listPlatforms method', function() {
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        it('should only return supported platform directories present in a cordova project dir', function() {
            var platforms = path.join(temp, 'platforms');
            var android = path.join(platforms, 'android');
            var ios = path.join(platforms, 'ios');
            var wp8_dir = path.join(platforms, 'wp8');
            var atari = path.join(platforms, 'atari');
            shell.mkdir('-p', android);
            shell.mkdir('-p', ios);
            shell.mkdir('-p', wp8_dir);
            shell.mkdir('-p', atari);
            var res = util.listPlatforms(temp);
            expect(res.length).toEqual(3);
            expect(res.indexOf('atari')).toEqual(-1);
        });
    });
    describe('getInstalledPlatformsWithVersions method', function() {
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        it('should get the supported platforms in the cordova project dir along with their reported versions', function(done) {
            var platforms = path.join(temp, 'platforms');
            var android = path.join(platforms, 'android');

            shell.mkdir('-p', android);

            shell.cp('-R',
                path.join(__dirname, 'fixtures', 'platforms', helpers.testPlatform), platforms);
            util.getInstalledPlatformsWithVersions(temp)
            .then(function(platformMap) {
                expect(platformMap['android']).toBe('3.1.0');
            }).fin(done);
        });
    });
    describe('findPlugins method', function() {
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        it('should only return plugin directories present in a cordova project dir', function() {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var wp8_dir = path.join(plugins, 'wp8');
            var atari = path.join(plugins, 'atari');
            shell.mkdir('-p', android);
            shell.mkdir('-p', ios);
            shell.mkdir('-p', wp8_dir);
            shell.mkdir('-p', atari);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(4);
        });
        it('should not return ".svn" directories', function() {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var svn = path.join(plugins, '.svn');
            shell.mkdir('-p', android);
            shell.mkdir('-p', ios);
            shell.mkdir('-p', svn);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(2);
            expect(res.indexOf('.svn')).toEqual(-1);
        });
        it('should not return "CVS" directories', function() {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var cvs = path.join(plugins, 'CVS');
            shell.mkdir('-p', android);
            shell.mkdir('-p', ios);
            shell.mkdir('-p', cvs);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(2);
            expect(res.indexOf('CVS')).toEqual(-1);
        });
    });

    describe('preprocessOptions method', function() {

        var isCordova, listPlatforms;
        var DEFAULT_OPTIONS = {
            // 'android' is here because we create a spy
            // for listPlatforms below that returns 'android'
            platforms: ['android'],
            verbose: false
        };

        beforeEach(function() {
            isCordova = spyOn(util, 'isCordova').and.returnValue('/fake/path');
            listPlatforms = spyOn(util, 'listPlatforms').and.returnValue(['android']);
        });

        it('should throw if called outside of cordova project', function() {
            isCordova.and.returnValue(false);
            expect(function() { util.preProcessOptions(); }).toThrow();
        });

        it('should throw when no platforms added to project', function() {
            listPlatforms.and.returnValue([]);
            expect(function () { util.preProcessOptions(); }).toThrow();
        });

        it('should return default options when no arguments passed', function() {
            expect(util.preProcessOptions()).toEqual(jasmine.objectContaining(DEFAULT_OPTIONS));
        });

        it('should accept single string argument as platform name', function() {
            expect(util.preProcessOptions('ios')).toEqual(jasmine.objectContaining({platforms: ['ios']}));
        });

        it('should accept array of strings as platform names', function() {
            expect(util.preProcessOptions(['ios', 'windows'])).toEqual(jasmine.objectContaining({platforms: ['ios', 'windows']}));
        });

        it('should fall back to installed platform if input doesn\'t contain platforms list', function() {
            expect(util.preProcessOptions({verbose: true}))
                .toEqual(jasmine.objectContaining({platforms: ['android'], verbose: true}));
        });

        it('should pick buildConfig if no option is provided, but buildConfig.json exists', function() {
            spyOn(util, 'existsSync').and.returnValue(true);
            // Using path.join below to normalize path separators
            expect(util.preProcessOptions())
                .toEqual(jasmine.objectContaining({options: {buildConfig: path.join('/fake/path/build.json')}}));
        });

        describe('ensurePlatformOptionsCompatible', function() {

            var unknownOptions = ['--foo', '--appx=uap', '--gradleArg=--no-daemon'];
            var validOptions = ['--debug', '--release', '--device', '--emulator', '--nobuild', '--list',
                    '--buildConfig=/fake/path/build.json', '--target=foo', '--archs="x86 x64"'];

            it('should return \'options\' unchanged if they are not an array', function() {
                ['foo', true, {bar: true}].forEach(function (optionValue) {
                    expect(util.preProcessOptions({options: optionValue}))
                        .toEqual(jasmine.objectContaining({options: optionValue}));
                });
            });

            it('should emit \'warn\' event if \'options\' is an Array', function() {
                var warnSpy = jasmine.createSpy('warnSpy');
                events.on('warn', warnSpy);
                util.preProcessOptions({options: ['foo']});
                expect(warnSpy).toHaveBeenCalled();
                expect(warnSpy.calls[0].args[0]).toMatch('consider updating your cordova.raw.* method calls');
                events.removeListener('warn', warnSpy);
            });

            it('should convert options Array into object with \'argv\' field', function() {
                expect(util.preProcessOptions({options: []}))
                    .toEqual(jasmine.objectContaining({options: {argv: []}}));
            });

            it('should convert known options (platform-agnostic) into resultant object\'s fields', function () {
                var expectedResult = {
                    'debug': true, 'release': true,
                    'device': true, 'emulator': true,
                    'nobuild': true, 'list': true,
                    'buildConfig': '/fake/path/build.json',
                    'target': 'foo',
                    'archs': '\"x86 x64\"'
                };

                expect(util.preProcessOptions({options: validOptions}).options)
                    .toEqual(jasmine.objectContaining(expectedResult));

                validOptions.forEach(function (validOption) {
                    expect(util.preProcessOptions({options: validOptions}).options.argv)
                        .not.toContain(validOption);
                });
            });

            it('should try to convert unknown options (platform-specific) into resultant object\'s fields', function () {
                var expectedResult = {
                    'foo': true, 'appx': 'uap', 'gradleArg': '--no-daemon'
                };

                expect(util.preProcessOptions({options: unknownOptions}).options)
                    .toEqual(jasmine.objectContaining(expectedResult));
            });

            it('should copy unknown options (platform-specific) into resultant object\'s argv field', function () {
                unknownOptions.forEach(function (validOption) {
                    expect(util.preProcessOptions({options: unknownOptions}).options.argv).toContain(validOption);
                });
            });
        });
    });
});