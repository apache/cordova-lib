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

const path = require('path');
const fs = require('fs-extra');
const util = require('util');
const events = require('cordova-common').events;
const rewire = require('rewire');
const cordova_util = require('../../../src/cordova/util');
const platforms = require('../../../src/platforms');
const plugman = require('../../../src/plugman/plugman');
const fetch_metadata = require('../../../src/plugman/util/metadata');

describe('cordova/platform/addHelper', function () {
    const projectRoot = '/some/path';
    let cfg_parser_mock, fake_platform, fetch_mock, hooks_mock,
        package_json_mock, platform_addHelper, platform_api_mock, prepare_mock;

    beforeEach(function () {
        fake_platform = {
            platform: 'atari'
        };
        package_json_mock = {
            cordova: {},
            dependencies: {},
            devDependencies: {}
        };
        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Promise.resolve());

        cfg_parser_mock = function () {};
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser mock', [
            'write', 'removeEngine', 'addEngine', 'getHookScripts'
        ]);
        fetch_mock = jasmine.createSpy('fetch mock').and.returnValue(Promise.resolve());
        prepare_mock = jasmine.createSpy('prepare mock').and.returnValue(Promise.resolve());
        const preparePlatforms = jasmine.createSpy('preparePlatforms mock').and.returnValue(Promise.resolve());
        prepare_mock.preparePlatforms = preparePlatforms;

        // `cordova.prepare` is never saved to a variable, so we need to fake `require`
        platform_addHelper = rewire('../../../src/cordova/platform/addHelper');
        const testSubjectRequire = platform_addHelper.__get__('require');
        const requireFake = jasmine.createSpy('require', testSubjectRequire).and.callThrough();
        requireFake.withArgs('../prepare').and.returnValue(prepare_mock);

        const getPlatformDetailsFromDir = jasmine.createSpy('getPlatformDetailsFromDir').and.returnValue(Promise.resolve(fake_platform));

        platform_addHelper.__set__({
            ConfigParser: cfg_parser_mock,
            fetch: fetch_mock,
            require: requireFake,
            getPlatformDetailsFromDir,
            preparePlatforms
        });

        spyOn(fs, 'ensureDirSync');
        spyOn(fs, 'existsSync').and.returnValue(false);
        spyOn(fs, 'readFileSync');
        spyOn(fs, 'writeFileSync');
        spyOn(cordova_util, 'projectConfig').and.returnValue(path.join(projectRoot, 'config.xml'));
        spyOn(cordova_util, 'isDirectory').and.returnValue(false);
        spyOn(cordova_util, 'fixRelativePath').and.callFake(function (input) { return input; });
        spyOn(cordova_util, 'isUrl').and.returnValue(false);
        spyOn(cordova_util, 'removePlatformPluginsJson');
        spyOn(platforms, 'hostSupports').and.returnValue(true);
        spyOn(events, 'emit');
        // Fake platform details we will use for our mocks, returned by either
        // getPlatfromDetailsFromDir (in the local-directory case), or
        // downloadPlatform (in every other case)
        spyOn(platform_addHelper, 'downloadPlatform').and.returnValue(Promise.resolve(fake_platform));
        spyOn(platform_addHelper, 'getVersionFromConfigFile').and.returnValue(false);
        spyOn(platform_addHelper, 'installPluginsForNewPlatform').and.returnValue(Promise.resolve());
        platform_api_mock = jasmine.createSpyObj('platform api mock', ['createPlatform', 'updatePlatform']);
        platform_api_mock.createPlatform.and.returnValue(Promise.resolve());
        platform_api_mock.updatePlatform.and.returnValue(Promise.resolve());
        spyOn(cordova_util, 'getPlatformApiFunction').and.returnValue(platform_api_mock);
        spyOn(cordova_util, 'requireNoCache').and.returnValue({});
    });

    describe('error/warning conditions', function () {
        it('should require specifying at least one platform', async () => {
            for (const targets of [[], undefined, null]) {
                await expectAsync(platform_addHelper('add', hooks_mock, projectRoot, targets))
                    .withContext(`targets = ${util.inspect(targets)}`)
                    .toBeRejectedWithError(/No platform specified\./);
            }
        });

        it('should log if host OS does not support the specified platform', function () {
            platforms.hostSupports.and.returnValue(false);
            return platform_addHelper('add', hooks_mock, projectRoot, ['atari']).then(function () {
                expect(platforms.hostSupports).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('warning', jasmine.stringMatching(/WARNING: Applications/));
            });
        });

        it('should throw if platform was already added before adding', function () {
            fs.existsSync.and.returnValue('/some/path/platforms/ios');
            return expectAsync(
                platform_addHelper('add', hooks_mock, projectRoot, ['ios'])
            ).toBeRejectedWithError(/already added\./);
        });

        it('should throw if platform was not added before updating', function () {
            return expectAsync(
                platform_addHelper('update', hooks_mock, projectRoot, ['atari'])
            ).toBeRejectedWithError(
                'Platform "atari" is not yet added. See `cordova platform list`.'
            );
        });
    });
    describe('happy path (success conditions)', function () {
        it('should fire the before_platform_* hook', function () {
            return platform_addHelper('add', hooks_mock, projectRoot, ['atari']).then(_ => {
                expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_add', jasmine.any(Object));
            });
        });

        describe('platform spec inference', function () {
            it('should retrieve platform details from directories-specified-as-platforms using getPlatformDetailsFromDir', function () {
                const directory_to_platform = '/path/to/cordova-atari';
                cordova_util.isDirectory.and.returnValue(true);
                fetch_mock.and.returnValue(Promise.resolve(directory_to_platform));
                return platform_addHelper('add', hooks_mock, projectRoot, [directory_to_platform], { restoring: true }).then(function () {
                    expect(platform_addHelper.__get__('getPlatformDetailsFromDir')).toHaveBeenCalledWith(directory_to_platform, null);
                    expect(platform_addHelper.downloadPlatform).not.toHaveBeenCalled();
                });
            });

            it('should retrieve platform details from URLs-specified-as-platforms using downloadPlatform', function () {
                cordova_util.isUrl.and.returnValue(true);
                const url_to_platform = 'http://github.com/apache/cordova-atari';
                return platform_addHelper('add', hooks_mock, projectRoot, [url_to_platform], { restoring: true }).then(function () {
                    expect(platform_addHelper.downloadPlatform).toHaveBeenCalledWith(projectRoot, null, url_to_platform, jasmine.any(Object));
                });
            });

            it('should use spec from config.xml if package.json does not contain dependency for platform', function () {
                package_json_mock.dependencies = {};
                cordova_util.requireNoCache.and.returnValue(package_json_mock);
                fs.existsSync.and.callFake(function (filePath) {
                    return path.basename(filePath) === 'package.json';
                });

                return platform_addHelper('add', hooks_mock, projectRoot, ['windows'], { restoring: true }).then(function () {
                    expect(platform_addHelper.getVersionFromConfigFile).toHaveBeenCalled();
                });
            });

            it('should attempt to retrieve from config.xml if exists and package.json does not', function () {
                return platform_addHelper('add', hooks_mock, projectRoot, ['atari'], { restoring: true }).then(function () {
                    expect(platform_addHelper.getVersionFromConfigFile).toHaveBeenCalled();
                });
            });

            it('should invoke fetch if provided as an option and spec is a directory', function () {
                cordova_util.isDirectory.and.returnValue(projectRoot);
                cordova_util.fixRelativePath.and.returnValue(projectRoot);
                spyOn(path, 'resolve').and.callThrough();
                return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], { save: true, restoring: true }).then(function () {
                    expect(fetch_mock).toHaveBeenCalled();
                });
            });
        });

        describe('platform api invocation', function () {
            it('should invoke the createPlatform platform API method when adding a platform, providing destination location, parsed config file and platform detail options as arguments', function () {
                return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], { save: true, restoring: true }).then(function (result) {
                    expect(platform_api_mock.createPlatform).toHaveBeenCalled();
                });
            });

            it('should invoke the update platform API method when updating a platform, providing destination location and plaform detail options as arguments', function () {
                cordova_util.isDirectory.and.returnValue(true);
                fs.existsSync.and.returnValue(true);
                return platform_addHelper('update', hooks_mock, projectRoot, ['ios'], { restoring: true }).then(function (result) {
                    expect(platform_api_mock.updatePlatform).toHaveBeenCalled();
                });
            });
        });

        describe('after platform api invocation', function () {
            describe('when the restoring option is not provided', function () {
                it('should invoke preparePlatforms twice (?!?), once before installPluginsForNewPlatforms and once after... ?!', function () {
                    const preparePlatforms = platform_addHelper.__get__('preparePlatforms');
                    return platform_addHelper('add', hooks_mock, projectRoot, ['atari'], { save: true }).then(function (result) {
                        expect(preparePlatforms).toHaveBeenCalledWith(['atari'], '/some/path', { searchpath: undefined });
                    });
                });
            });

            it('should invoke the installPluginsForNewPlatforms method in the platform-add case', function () {
                return platform_addHelper('add', hooks_mock, projectRoot, ['atari'], { save: true, restoring: true }).then(function (result) {
                    expect(platform_addHelper.installPluginsForNewPlatform).toHaveBeenCalled();
                });
            });

            describe('if the project contains a package.json', function () {
                it('should use getVersionFromPackageJson to determine platform version', async () => {
                    const getVersionFromPackageJson = jasmine.createSpy('getVersionFromPackageJson')
                        .and.returnValue('1.2.3');

                    platform_addHelper.__set__({
                        getVersionFromPackageJson,
                        readPackageJsonIfExists: () => package_json_mock
                    });

                    await platform_addHelper('add', hooks_mock, projectRoot, ['ios'], { save: true, restoring: true });

                    expect(getVersionFromPackageJson).toHaveBeenCalledWith('ios', package_json_mock);
                    expect(platform_addHelper.getVersionFromConfigFile).not.toHaveBeenCalled();
                });

                it('should write out the platform just added/updated to the cordova.platforms property of package.json', function () {
                    fs.readFileSync.and.returnValue('file');
                    fs.existsSync.and.callFake(function (filePath) {
                        if (path.basename(filePath) === 'package.json') {
                            return true;
                        } else {
                            return false;
                        }
                    });
                    package_json_mock.cordova = { platforms: ['ios'] };
                    cordova_util.requireNoCache.and.returnValue(package_json_mock);
                    return platform_addHelper('add', hooks_mock, projectRoot, ['android'], { save: true, restoring: true }).then(function (result) {
                        expect(fs.writeFileSync).toHaveBeenCalled();
                    });
                });

                it('should only write the package.json file if it was modified', function () {
                    package_json_mock.cordova = { platforms: ['ios'] };
                    cordova_util.requireNoCache.and.returnValue(package_json_mock);
                    return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], { save: true, restoring: true }).then(function (result) {
                        expect(fs.writeFileSync).not.toHaveBeenCalled();
                    });
                });

                it('should file the after_platform_* hook', function () {
                    return platform_addHelper('add', hooks_mock, projectRoot, ['atari'], { save: true, restoring: true }).then(function (result) {
                        expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_add', Object({ save: true, restoring: true }));
                    });
                });
            });
        });
    });
    describe('downloadPlatform', function () {
        beforeEach(function () {
            platform_addHelper.downloadPlatform.and.callThrough();
        });
        describe('errors', function () {
            it('should reject the promise should fetch fail', function () {
                fetch_mock.and.returnValue(Promise.reject(new Error('fetch has failed, rejecting promise')));
                return expectAsync(
                    platform_addHelper.downloadPlatform(projectRoot, 'android', '67')
                ).toBeRejectedWithError(
                    /fetch has failed, rejecting promise/
                );
            });
        });
        describe('happy path', function () {
            it('should invoke cordova-fetch if fetch was provided as an option', function () {
                fetch_mock.and.returnValue(true);
                return platform_addHelper.downloadPlatform(projectRoot, 'android', '6.0.0').then(function () {
                    expect(fetch_mock).toHaveBeenCalledWith('cordova-android@6.0.0', projectRoot, undefined);
                });
            });
            it('should pass along a libDir argument to getPlatformDetailsFromDir on a successful platform download', function () {
                cordova_util.isUrl.and.returnValue(true);
                return platform_addHelper.downloadPlatform(projectRoot, 'android', 'https://github.com/apache/cordova-android', { save: true }).then(function () {
                    expect(platform_addHelper.__get__('getPlatformDetailsFromDir')).toHaveBeenCalled();
                });
            }, 60000);
        });
    });
    describe('installPluginsForNewPlatform', function () {
        beforeEach(function () {
            spyOn(plugman, 'install').and.returnValue(Promise.resolve());
            spyOn(cordova_util, 'findPlugins').and.returnValue(['cordova-plugin-whitelist']);
            spyOn(fetch_metadata, 'get_fetch_metadata').and.returnValue({});
            platform_addHelper.installPluginsForNewPlatform.and.callThrough();
        });

        // Call installPluginsForNewPlatform with some preset test arguments
        function installPluginsForNewPlatformWithTestArgs () {
            return platform_addHelper.installPluginsForNewPlatform('atari', projectRoot, {});
        }

        it('should immediately return if there are no plugins to install into the platform', function () {
            cordova_util.findPlugins.and.returnValue([]);

            return installPluginsForNewPlatformWithTestArgs().then(() => {
                expect(plugman.install).not.toHaveBeenCalled();
            });
        });

        it('should invoke plugman.install, giving correct platform, plugin and other arguments', function () {
            return installPluginsForNewPlatformWithTestArgs().then(() => {
                expect(events.emit).toHaveBeenCalledWith(
                    'verbose',
                    'Installing plugin "cordova-plugin-whitelist" following successful platform add of atari'
                );
                expect(plugman.install).toHaveBeenCalledTimes(1);
                expect(plugman.install).toHaveBeenCalledWith(
                    'atari',
                    path.normalize('/some/path/platforms/atari'),
                    'cordova-plugin-whitelist',
                    path.normalize('/some/path/plugins'),
                    {
                        searchpath: undefined,
                        usePlatformWww: true,
                        is_top_level: undefined,
                        force: undefined,
                        save: false
                    }
                );
            });
        });

        it('should properly signal a top level plugin to plugman.install,', () => {
            fetch_metadata.get_fetch_metadata.and.returnValue({ is_top_level: true });

            return installPluginsForNewPlatformWithTestArgs().then(() => {
                expect(plugman.install).toHaveBeenCalledTimes(1);
                const installOptions = plugman.install.calls.argsFor(0)[4];
                expect(installOptions.is_top_level).toBe(true);
            });
        });

        it('should invoke plugman.install with correct plugin ID for a scoped plugin', () => {
            const scopedPluginId = '@cordova/cordova-plugin-scoped';
            cordova_util.findPlugins.and.returnValue([scopedPluginId]);

            return installPluginsForNewPlatformWithTestArgs().then(() => {
                expect(plugman.install).toHaveBeenCalledTimes(1);
                const pluginId = plugman.install.calls.argsFor(0)[2];
                expect(pluginId).toBe(scopedPluginId);
            });
        });

        it('should include any plugin variables as options when invoking plugman install', function () {
            const variables = {};
            fetch_metadata.get_fetch_metadata.and.returnValue({ variables });

            return installPluginsForNewPlatformWithTestArgs().then(() => {
                expect(events.emit).toHaveBeenCalledWith(
                    'verbose',
                    'Found variables for "cordova-plugin-whitelist". Processing as cli_variables.'
                );
                expect(plugman.install).toHaveBeenCalledTimes(1);
                const installOptions = plugman.install.calls.argsFor(0)[4];
                expect(installOptions.cli_variables).toBe(variables);
            });
        });
    });

    describe('getVersionFromPackageJson', () => {
        let getVersionFromPackageJson;
        beforeEach(() => {
            getVersionFromPackageJson = platform_addHelper.__get__('getVersionFromPackageJson');
        });

        it('gets the platform version from dependencies or devDependencies, preferring the latter', () => {
            const pkgJson = {
                dependencies: {
                    'cordova-ios': '1.2.3-ios',
                    'cordova-android': '1.2.3-android'
                },
                devDependencies: { 'cordova-ios': '1.2.3-ios.dev' }
            };
            expect(getVersionFromPackageJson('android', pkgJson)).toBe('1.2.3-android');
            expect(getVersionFromPackageJson('ios', pkgJson)).toBe('1.2.3-ios.dev');
            expect(getVersionFromPackageJson('osx', pkgJson)).toBeUndefined();
        });

        it('gets the platform version given either long or short name', () => {
            const pkgJson = {
                devDependencies: { 'cordova-ios': '1.2.3-ios.dev' }
            };
            expect(getVersionFromPackageJson('ios', pkgJson)).toBe('1.2.3-ios.dev');
            expect(getVersionFromPackageJson('cordova-ios', pkgJson)).toBe('1.2.3-ios.dev');
        });

        it('handles empty package.json objects', () => {
            expect(getVersionFromPackageJson('ios', undefined)).toBeUndefined();
            expect(getVersionFromPackageJson('ios', {})).toBeUndefined();
        });
    });
});
