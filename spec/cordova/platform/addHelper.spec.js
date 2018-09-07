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
var Q = require('q');
var events = require('cordova-common').events;
var rewire = require('rewire');
var platform_module = require('../../../src/cordova/platform');
var cordova_util = require('../../../src/cordova/util');
var cordova_config = require('../../../src/cordova/config');
var plugman = require('../../../src/plugman/plugman');
var fetch_metadata = require('../../../src/plugman/util/metadata');
var prepare = require('../../../src/cordova/prepare');

describe('cordova/platform/addHelper', function () {
    const projectRoot = '/some/path';
    var cfg_parser_mock, fake_platform, fetch_mock, hooks_mock,
        package_json_mock, platform_addHelper, platform_api_mock, prepare_mock;

    beforeEach(function () {
        fake_platform = {
            'platform': 'atari'
        };
        package_json_mock = {
            cordova: {},
            dependencies: {},
            devDependencies: {}
        };
        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Q());

        cfg_parser_mock = function () {};
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser mock', [
            'write', 'removeEngine', 'addEngine', 'getHookScripts'
        ]);
        fetch_mock = jasmine.createSpy('fetch mock').and.returnValue(Q());
        prepare_mock = jasmine.createSpy('prepare mock').and.returnValue(Q());
        prepare_mock.preparePlatforms = jasmine.createSpy('preparePlatforms mock').and.returnValue(Q());

        // `cordova.prepare` is never saved to a variable, so we need to fake `require`
        platform_addHelper = rewire('../../../src/cordova/platform/addHelper');
        const testSubjectRequire = platform_addHelper.__get__('require');
        const requireFake = jasmine.createSpy('require', testSubjectRequire).and.callThrough();
        requireFake.withArgs('../prepare').and.returnValue(prepare_mock);

        platform_addHelper.__set__({
            ConfigParser: cfg_parser_mock,
            fetch: fetch_mock,
            require: requireFake
        });

        spyOn(fs, 'ensureDirSync');
        spyOn(fs, 'existsSync').and.returnValue(false);
        spyOn(fs, 'readFileSync');
        spyOn(fs, 'writeFileSync');
        spyOn(cordova_util, 'projectConfig').and.returnValue(path.join(projectRoot, 'config.xml'));
        spyOn(cordova_util, 'isDirectory').and.returnValue(false);
        spyOn(cordova_util, 'fixRelativePath').and.callFake(function (input) { return input; });
        spyOn(cordova_util, 'isUrl').and.returnValue(false);
        spyOn(cordova_util, 'hostSupports').and.returnValue(true);
        spyOn(cordova_util, 'removePlatformPluginsJson');
        spyOn(cordova_config, 'read').and.returnValue({});
        spyOn(events, 'emit');
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
        spyOn(cordova_util, 'requireNoCache').and.returnValue({});
    });

    describe('error/warning conditions', function () {
        it('should require specifying at least one platform', function () {
            return platform_addHelper('add', hooks_mock).then(function () {
                fail('addHelper success handler unexpectedly invoked');
            }, function (e) {
                expect(e.message).toContain('No platform specified.');
            });
        });

        it('should log if host OS does not support the specified platform', function () {
            cordova_util.hostSupports.and.returnValue(false);
            return platform_addHelper('add', hooks_mock, projectRoot, ['atari']).then(function () {
                expect(cordova_util.hostSupports).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('warning', jasmine.stringMatching(/WARNING: Applications/));
            });
        });

        it('should throw if platform was already added before adding', function () {
            fs.existsSync.and.returnValue('/some/path/platforms/ios');
            return platform_addHelper('add', hooks_mock, projectRoot, ['ios']).then(function () {
                fail('addHelper success handler unexpectedly invoked');
            }, function (e) {
                expect(e.message).toContain('already added.');
            });
        });

        it('should throw if platform was not added before updating', function () {
            return platform_addHelper('update', hooks_mock, projectRoot, ['atari']).then(function () {
                fail('addHelper success handler unexpectedly invoked');
            }, function (e) {
                expect(e.message).toContain('Platform "atari" is not yet added. See `cordova platform list`.');
            });
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
                var directory_to_platform = '/path/to/cordova-atari';
                cordova_util.isDirectory.and.returnValue(true);
                fetch_mock.and.returnValue(Promise.resolve(directory_to_platform));
                return platform_addHelper('add', hooks_mock, projectRoot, [directory_to_platform], {restoring: true}).then(function () {
                    expect(platform_module.getPlatformDetailsFromDir).toHaveBeenCalledWith(directory_to_platform, null);
                    expect(platform_addHelper.downloadPlatform).not.toHaveBeenCalled();
                });
            });

            it('should retrieve platform details from URLs-specified-as-platforms using downloadPlatform', function () {
                cordova_util.isUrl.and.returnValue(true);
                var url_to_platform = 'http://github.com/apache/cordova-atari';
                return platform_addHelper('add', hooks_mock, projectRoot, [url_to_platform], {restoring: true}).then(function () {
                    expect(platform_addHelper.downloadPlatform).toHaveBeenCalledWith(projectRoot, null, url_to_platform, jasmine.any(Object));
                });
            });

            it('should use spec from config.xml if package.json does not contain dependency for platform', function () {
                package_json_mock.dependencies = {};
                cordova_util.requireNoCache.and.returnValue(package_json_mock);
                fs.existsSync.and.callFake(function (filePath) {
                    return path.basename(filePath) === 'package.json';
                });

                return platform_addHelper('add', hooks_mock, projectRoot, ['windows'], {restoring: true}).then(function () {
                    expect(platform_addHelper.getVersionFromConfigFile).toHaveBeenCalled();
                });
            });

            it('should attempt to retrieve from config.xml if exists and package.json does not', function () {
                return platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {restoring: true}).then(function () {
                    expect(platform_addHelper.getVersionFromConfigFile).toHaveBeenCalled();
                });
            });

            it('should fall back to using pinned version if both package.json and config.xml do not specify it', function () {
                return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {restoring: true}).then(function () {
                    expect(events.emit).toHaveBeenCalledWith('verbose', 'Grabbing pinned version.');
                });
            });

            it('should invoke fetch if provided as an option and spec is a directory', function () {
                cordova_util.isDirectory.and.returnValue(projectRoot);
                cordova_util.fixRelativePath.and.returnValue(projectRoot);
                spyOn(path, 'resolve').and.callThrough();
                return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, restoring: true}).then(function () {
                    expect(fetch_mock).toHaveBeenCalled();
                });
            });
        });

        describe('platform api invocation', function () {

            it('should invoke the createPlatform platform API method when adding a platform, providing destination location, parsed config file and platform detail options as arguments', function () {
                return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, restoring: true}).then(function (result) {
                    expect(platform_api_mock.createPlatform).toHaveBeenCalled();
                });
            });

            it('should invoke the update platform API method when updating a platform, providing destination location and plaform detail options as arguments', function () {
                cordova_util.isDirectory.and.returnValue(true);
                fs.existsSync.and.returnValue(true);
                return platform_addHelper('update', hooks_mock, projectRoot, ['ios'], {restoring: true}).then(function (result) {
                    expect(platform_api_mock.updatePlatform).toHaveBeenCalled();
                });
            });
        });

        describe('after platform api invocation', function () {

            describe('when the restoring option is not provided', function () {
                // test is commented out b/c preparePlatforms can't be spied on as it is dynamically required due to circular references.
                xit('should invoke preparePlatforms twice (?!?), once before installPluginsForNewPlatforms and once after... ?!', function () {
                    return platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {save: true}).then(function (result) {
                        expect(prepare.preparePlatforms).toHaveBeenCalledWith([ 'atari' ], '/some/path', Object({ searchpath: undefined }));
                    });
                });
            });

            it('should invoke the installPluginsForNewPlatforms method in the platform-add case', function () {
                return platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {save: true, restoring: true}).then(function (result) {
                    expect(platform_addHelper.installPluginsForNewPlatform).toHaveBeenCalled();
                });
            });

            it('should write out the version of platform just added/updated to config.xml if the save option is provided', function () {
                return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, restoring: true}).then(function (result) {
                    expect(cfg_parser_mock.prototype.removeEngine).toHaveBeenCalled();
                    expect(cfg_parser_mock.prototype.addEngine).toHaveBeenCalled();
                    expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
                });
            });

            describe('if the project contains a package.json', function () {
                it('should write out the platform just added/updated to the cordova.platforms property of package.json', function () {
                    fs.readFileSync.and.returnValue('file');
                    fs.existsSync.and.callFake(function (filePath) {
                        if (path.basename(filePath) === 'package.json') {
                            return true;
                        } else {
                            return false;
                        }
                    });
                    package_json_mock.cordova = {'platforms': ['ios']};
                    cordova_util.requireNoCache.and.returnValue(package_json_mock);
                    return platform_addHelper('add', hooks_mock, projectRoot, ['android'], {save: true, restoring: true}).then(function (result) {
                        expect(fs.writeFileSync).toHaveBeenCalled();
                    });
                });

                it('should use pkgJson version devDependencies, if dependencies are undefined', function () {
                    package_json_mock.dependencies = undefined;
                    package_json_mock.cordova = {'platforms': ['ios']};
                    package_json_mock.devDependencies['ios'] = {};
                    cordova_util.requireNoCache.and.returnValue(package_json_mock);
                    fs.existsSync.and.callFake(function (filePath) {
                        return path.basename(filePath) === 'package.json';
                    });
                    fs.readFileSync.and.returnValue('{}');
                    return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, restoring: true}).then(function () {
                        expect(platform_addHelper.getVersionFromConfigFile).not.toHaveBeenCalled();
                        expect(fs.writeFileSync).toHaveBeenCalled();
                    });
                });

                it('should only write the package.json file if it was modified', function () {
                    package_json_mock.cordova = {'platforms': ['ios']};
                    cordova_util.requireNoCache.and.returnValue(package_json_mock);
                    return platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, restoring: true}).then(function (result) {
                        expect(fs.writeFileSync).not.toHaveBeenCalled();
                    });
                });

                it('should file the after_platform_* hook', function () {
                    return platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {save: true, restoring: true}).then(function (result) {
                        expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_add', Object({ save: true, restoring: true, searchpath: undefined }));
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
                fetch_mock.and.returnValue(Q.reject('fetch has failed, rejecting promise'));
                return platform_addHelper.downloadPlatform(projectRoot, 'android', '67').then(function () {
                    fail('success handler unexpectedly invoked');
                }, function (e) {
                    expect(e.message).toContain('fetch has failed, rejecting promise');
                });
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
                return platform_addHelper.downloadPlatform(projectRoot, 'android', 'https://github.com/apache/cordova-android', {save: true}).then(function () {
                    expect(require('../../../src/cordova/platform/index').getPlatformDetailsFromDir).toHaveBeenCalled();
                });
            }, 60000);
        });
    });
    describe('installPluginsForNewPlatform', function () {
        beforeEach(function () {
            spyOn(fetch_metadata, 'get_fetch_metadata');
            spyOn(plugman, 'install').and.returnValue(Q());
            platform_addHelper.installPluginsForNewPlatform.and.callThrough();
        });

        it('should immediately return if there are no plugins to install into the platform', function () {
            return platform_addHelper.installPluginsForNewPlatform('android', projectRoot).then(function () {
                expect(plugman.install).not.toHaveBeenCalled();
            });
        });

        it('should invoke plugman.install, giving correct platform, plugin and other arguments', function () {
            spyOn(cordova_util, 'findPlugins').and.returnValue(['cordova-plugin-whitelist']);
            fetch_metadata.get_fetch_metadata.and.returnValue({ });
            return platform_addHelper.installPluginsForNewPlatform('browser', projectRoot, {save: true}).then(function () {
                expect(plugman.install).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('verbose', 'Installing plugin "cordova-plugin-whitelist" following successful platform add of browser');
            });
        });

        it('should include any plugin variables as options when invoking plugman install', function () {
            spyOn(cordova_util, 'findPlugins').and.returnValue(['cordova-plugin-camera']);
            fetch_metadata.get_fetch_metadata.and.returnValue({ source: {}, variables: {} });
            return platform_addHelper.installPluginsForNewPlatform('browser', projectRoot, {save: true}).then(function () {
                expect(plugman.install).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('verbose', 'Found variables for "cordova-plugin-camera". Processing as cli_variables.');
            });
        });
    });
});
