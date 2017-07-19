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
var platform_addHelper = rewire('../../../src/cordova/platform/addHelper');
var platform_module = require('../../../src/cordova/platform');
var platform_metadata = require('../../../src/cordova/platform_metadata');
var cordova_util = require('../../../src/cordova/util');
var cordova_config = require('../../../src/cordova/config');
var plugman = require('../../../src/plugman/plugman');
var fetch_metadata = require('../../../src/plugman/util/metadata');
var lazy_load = require('../../../src/cordova/lazy_load');
var prepare = require('../../../src/cordova/prepare');
var gitclone = require('../../../src/gitclone');
var fail;

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
    var package_json_mock;
    package_json_mock = jasmine.createSpyObj('package json mock', ['cordova', 'dependencies']);
    package_json_mock.dependencies = {};
    package_json_mock.cordova = {};

    beforeEach(function () {
        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Q());
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser mock', ['write', 'removeEngine', 'addEngine', 'getHookScripts']);
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
        spyOn(platform_metadata, 'save');
        spyOn(cordova_util, 'requireNoCache').and.returnValue({});
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

        it('should log if host OS does not support the specified platform', function (done) {
            cordova_util.hostSupports.and.returnValue(false);
            platform_addHelper('add', hooks_mock, projectRoot, ['atari']).then(function () {
                fail('addHelper success handler unexpectedly invoked');
            }).fail(function (e) {
                expect(cordova_util.hostSupports).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('warning', jasmine.stringMatching(/WARNING: Applications/));
            }).done(done);
        });

        it('should throw if platform was already added before adding', function (done) {
            fs.existsSync.and.returnValue('/some/path/platforms/ios');
            platform_addHelper('add', hooks_mock, projectRoot, ['ios']).then(function () {
                fail('addHelper success handler unexpectedly invoked');
            }).fail(function (e) {
                expect(e.message).toContain('already added.');
            }).done(done);
        });

        it('should throw if platform was not added before updating', function (done) {
            platform_addHelper('update', hooks_mock, projectRoot, ['atari']).then(function () {
                fail('addHelper success handler unexpectedly invoked');
            }).fail(function (e) {
                expect(e.message).toContain('Platform "atari" is not yet added. See `cordova platform list`.');
            }).done(done);
        });
    });
    describe('happy path (success conditions)', function () {
        it('should fire the before_platform_* hook', function () {
            platform_addHelper('add', hooks_mock, projectRoot, ['atari']);
            expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_add', jasmine.any(Object));
        });

        it('should warn about using deprecated platforms', function (done) {
            platform_addHelper('add', hooks_mock, projectRoot, ['ubuntu', 'blackberry10']);
            process.nextTick(function () {
                expect(events.emit).toHaveBeenCalledWith(jasmine.stringMatching(/has been deprecated/));
                done();
            });
        });
        describe('platform spec inference', function () {
            it('should retrieve platform details from directories-specified-as-platforms using getPlatformDetailsFromDir', function (done) {
                cordova_util.isDirectory.and.returnValue(true);
                var directory_to_platform = '/path/to/cordova-atari';
                platform_addHelper('add', hooks_mock, projectRoot, [directory_to_platform], {restoring: true}).then(function () {
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
                platform_addHelper('add', hooks_mock, projectRoot, [url_to_platform], {restoring: true}).then(function () {
                    expect(platform_addHelper.downloadPlatform).toHaveBeenCalledWith(projectRoot, null, url_to_platform, jasmine.any(Object));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
            });

            it('should attempt to retrieve from config.xml if exists and package.json does not', function (done) {
                platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {restoring: true}).then(function () {
                    expect(platform_addHelper.getVersionFromConfigFile).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
            });

            it('should fall back to using pinned version if both package.json and config.xml do not specify it', function (done) {
                platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {restoring: true}).then(function () {
                    expect(events.emit).toHaveBeenCalledWith('verbose', 'Grabbing pinned version.');
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
            });

            it('should invoke fetch if provided as an option and spec is a directory', function (done) {
                cordova_util.isDirectory.and.returnValue(projectRoot);
                cordova_util.fixRelativePath.and.returnValue(projectRoot);
                spyOn(path, 'resolve').and.callThrough();
                platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, fetch: true, restoring: true}).then(function () {
                    expect(fetch_mock).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                    console.error(e);
                }).done(done);
            });
        });

        describe('platform api invocation', function () {

            it('should invoke the createPlatform platform API method when adding a platform, providing destination location, parsed config file and platform detail options as arguments', function (done) {
                platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, fetch: true, restoring: true}).then(function (result) {
                    expect(platform_api_mock.createPlatform).toHaveBeenCalled();
                }).fail(function (err) {
                    fail('unexpected failure handler invoked!');
                    console.error(err);
                }).done(done);
            });

            it('should invoke the update platform API method when updating a platform, providing destination location and plaform detail options as arguments', function (done) {
                cordova_util.isDirectory.and.returnValue(true);
                fs.existsSync.and.returnValue(true);
                platform_addHelper('update', hooks_mock, projectRoot, ['ios'], {restoring: true}).then(function (result) {
                    expect(platform_api_mock.updatePlatform).toHaveBeenCalled();
                }).fail(function (err) {
                    fail('unexpected failure handler invoked!');
                    console.error(err);
                }).done(done);
            });
        });

        describe('after platform api invocation', function () {

            describe('when the restoring option is not provided', function () {
                // test is commented out b/c preparePlatforms can't be spied on as it is dynamically required due to circular references.
                xit('should invoke preparePlatforms twice (?!?), once before installPluginsForNewPlatforms and once after... ?!', function (done) {
                    platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {save: true, fetch: true}).then(function (result) {
                        expect(prepare.preparePlatforms).toHaveBeenCalledWith([ 'atari' ], '/some/path', Object({ searchpath: undefined }));
                    }).fail(function (err) {
                        fail('unexpected failure handler invoked!');
                        console.error(err);
                    }).done(done);
                });
            });

            it('should invoke the installPluginsForNewPlatforms method in the platform-add case', function (done) {
                platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {save: true, fetch: true, restoring: true}).then(function (result) {
                    expect(platform_addHelper.installPluginsForNewPlatform).toHaveBeenCalled();
                }).fail(function (err) {
                    fail('unexpected failure handler invoked!');
                    console.error(err);
                }).done(done);
            });

            it('should save the platform metadata', function (done) {
                platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {save: true, fetch: true, restoring: true}).then(function (result) {
                    expect(platform_metadata.save).toHaveBeenCalledWith('/some/path', 'atari', undefined);
                }).fail(function (err) {
                    fail('unexpected failure handler invoked!');
                    console.error(err);
                }).done(done);
            });

            it('should write out the version of platform just added/updated to config.xml if the save option is provided', function (done) {
                platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, restoring: true}).then(function (result) {
                    expect(cfg_parser_mock.prototype.removeEngine).toHaveBeenCalled();
                    expect(cfg_parser_mock.prototype.addEngine).toHaveBeenCalled();
                    expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
                }).fail(function (err) {
                    fail('unexpected failure handler invoked!');
                    console.error(err);
                }).done(done);
            });

            describe('if the project contains a package.json', function () {
                it('should write out the platform just added/updated to the cordova.platforms property of package.json', function (done) {
                    fs.existsSync.and.callFake(function (filePath) {
                        if (path.basename(filePath) === 'package.json') {
                            return true;
                        } else {
                            return false;
                        }
                    });
                    package_json_mock.cordova = {'platforms': ['ios']};
                    cordova_util.requireNoCache.and.returnValue(package_json_mock);
                    platform_addHelper('add', hooks_mock, projectRoot, ['android'], {save: true, restoring: true}).then(function (result) {
                        expect(fs.writeFileSync).toHaveBeenCalled();
                    }).fail(function (err) {
                        fail('unexpected failure handler invoked!');
                        console.error(err);
                    }).done(done);
                });

                it('should only write the package.json file if it was modified', function (done) {
                    package_json_mock.cordova = {'platforms': ['ios']};
                    cordova_util.requireNoCache.and.returnValue(package_json_mock);
                    platform_addHelper('add', hooks_mock, projectRoot, ['ios'], {save: true, restoring: true}).then(function (result) {
                        expect(fs.writeFileSync).not.toHaveBeenCalled();
                    }).fail(function (err) {
                        fail('unexpected failure handler invoked!');
                        console.error(err);
                    }).done(done);
                });

                it('should file the after_platform_* hook', function (done) {
                    platform_addHelper('add', hooks_mock, projectRoot, ['atari'], {save: true, restoring: true}).then(function (result) {
                        expect(hooks_mock.fire).toHaveBeenCalledWith('before_platform_add', Object({ save: true, restoring: true, searchpath: undefined }));
                    }).fail(function (err) {
                        fail('unexpected failure handler invoked!');
                        console.error(err);
                    }).done(done);
                });
            });
        });
    });
    describe('downloadPlatform', function () {
        beforeEach(function () {
            spyOn(Q, 'reject').and.callThrough();
            spyOn(lazy_load, 'based_on_config');
            spyOn(lazy_load, 'git_clone').and.callThrough();
            platform_addHelper.downloadPlatform.and.callThrough();
        });
        describe('errors', function () {
            it('should reject the promise should fetch fail', function (done) {
                fetch_mock.and.returnValue(Q.reject('fetch has failed, rejecting promise'));
                platform_addHelper.downloadPlatform(projectRoot, 'android', '67', {fetch: true}).then(function () {
                    fail('success handler unexpectedly invoked');
                }).fail(function (e) {
                    expect(e.message).toContain('fetch has failed, rejecting promise');
                }).done(done);
            });

            it('should reject the promise should lazy_load.git_clone fail', function (done) {
                lazy_load.based_on_config.and.returnValue(false);
                cordova_util.isUrl.and.returnValue(true);
                platform_addHelper.downloadPlatform(projectRoot, 'android', 'https://github.com/apache/cordova-android', {save: true}).then(function () {
                    fail('success handler unexpectedly invoked');
                }).fail(function (e) {
                    expect(Q.reject).toHaveBeenCalled();
                    expect(events.emit).toHaveBeenCalledWith('verbose', 'Cloning failed. Let\'s try handling it as a tarball');
                }).done(done);
            }, 60000);

            it('should reject the promise should lazy_load.based_on_config fail', function (done) {
                spyOn(gitclone, 'clone').and.callThrough();
                lazy_load.git_clone.and.returnValue(true);
                lazy_load.based_on_config.and.returnValue(false);
                cordova_util.isUrl.and.returnValue(true);
                platform_addHelper.downloadPlatform(projectRoot, 'android', 'https://github.com/apache/cordova-android', {save: true}).then(function () {
                    fail('success handler unexpectedly invoked');
                }).fail(function (e) {
                    expect(Q.reject).toHaveBeenCalled();
                    expect(lazy_load.based_on_config).not.toHaveBeenCalled();
                }).done(done);
            }, 60000);

            it('should reject the promise should both git_clone and based_on_config fail after the latter was fallen back on', function (done) {
                lazy_load.git_clone.and.returnValue(Q.reject('git_clone failed'));
                lazy_load.based_on_config.and.returnValue(Q.reject('based_on_config failed'));
                cordova_util.isUrl.and.returnValue(true);
                fetch_mock.and.returnValue(true);
                platform_addHelper.downloadPlatform(projectRoot, 'android', 'https://github.com/apache/cordova-android', {save: true}).then(function () {
                    fail('success handler unexpectedly invoked');
                }).fail(function (e) {
                    expect(Q.reject).toHaveBeenCalled();
                }).done(done);
            }, 60000);
        });
        describe('happy path', function () {
            it('should invoke cordova-fetch if fetch was provided as an option', function (done) {
                fetch_mock.and.returnValue(true);
                platform_addHelper.downloadPlatform(projectRoot, 'android', '6.0.0', {fetch: true}).then(function () {
                    expect(fetch_mock).toHaveBeenCalledWith('cordova-android@6.0.0', projectRoot, Object({ fetch: true }));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                }).done(done);
            });

            it('should invoke lazy_load.git_clone if the version to download is a URL', function (done) {
                lazy_load.git_clone.and.callThrough();
                spyOn(gitclone, 'clone').and.returnValue(true);
                fetch_mock.and.returnValue(true);
                cordova_util.isUrl.and.returnValue(true);
                platform_addHelper.downloadPlatform(projectRoot, 'android', 'https://github.com/apache/cordova-android', {save: true}).then(function () {
                    expect(events.emit).toHaveBeenCalledWith('log', 'git cloning: https://github.com/apache/cordova-android');
                    expect(cordova_util.isUrl).toHaveBeenCalledWith('https://github.com/apache/cordova-android');
                    expect(lazy_load.git_clone).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                }).done(done);
            }, 60000);

            it('should attempt to lazy_load.based_on_config if lazy_load.git_clone fails', function (done) {
                cordova_util.isUrl.and.returnValue(true);
                platform_addHelper.downloadPlatform(projectRoot, 'android', 'https://github.com/apache/cordova-android', {save: true}).then(function () {
                    expect(events.emit).toHaveBeenCalledWith('verbose', '"git" command line tool is not installed: make sure it is accessible on your PATH.');
                    expect(events.emit).toHaveBeenCalledWith('verbose', 'Cloning failed. Let\'s try handling it as a tarball');
                    expect(lazy_load.based_on_config).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                }).done(done);
            }, 60000);

            it('should by default attempt to lazy_load.based_on_config', function (done) {
                platform_addHelper.downloadPlatform(projectRoot, 'android', '6.0.0', {save: true}).then(function () {
                    expect(lazy_load.based_on_config).toHaveBeenCalledWith('/some/path', 'android@6.0.0', Object({ save: true }));
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                }).done(done);
            }, 60000);

            it('should pass along a libDir argument to getPlatformDetailsFromDir on a successful platform download', function (done) {
                cordova_util.isUrl.and.returnValue(true);
                platform_addHelper.downloadPlatform(projectRoot, 'android', 'https://github.com/apache/cordova-android', {save: true}).then(function () {
                    expect(require('../../../src/cordova/platform/index').getPlatformDetailsFromDir).toHaveBeenCalled();
                }).fail(function (e) {
                    fail('fail handler unexpectedly invoked');
                }).done(done);
            }, 60000);
        });
    });
    describe('installPluginsForNewPlatform', function () {
        beforeEach(function () {
            spyOn(fetch_metadata, 'get_fetch_metadata');
            spyOn(plugman, 'install').and.returnValue(Q());
            platform_addHelper.installPluginsForNewPlatform.and.callThrough();
        });

        it('should immediately return if there are no plugins to install into the platform', function (done) {
            platform_addHelper.installPluginsForNewPlatform('android', projectRoot).then(function () {
                expect(plugman.install).not.toHaveBeenCalled();
            }).fail(function (e) {
                fail('fail handler unexpectedly invoked');
            }).done(done);
        });

        it('should invoke plugman.install, giving correct platform, plugin and other arguments', function (done) {
            spyOn(cordova_util, 'findPlugins').and.returnValue(['cordova-plugin-whitelist']);
            fetch_metadata.get_fetch_metadata.and.returnValue({ });
            platform_addHelper.installPluginsForNewPlatform('browser', projectRoot, {save: true, fetch: true}).then(function () {
                expect(plugman.install).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('verbose', 'Installing plugin "cordova-plugin-whitelist" following successful platform add of browser');
            }).fail(function (e) {
                fail('fail handler unexpectedly invoked');
            }).done(done);
        });

        it('should include any plugin variables as options when invoking plugman install', function (done) {
            spyOn(cordova_util, 'findPlugins').and.returnValue(['cordova-plugin-camera']);
            fetch_metadata.get_fetch_metadata.and.returnValue({ source: {}, variables: {} });
            platform_addHelper.installPluginsForNewPlatform('browser', projectRoot, {save: true, fetch: true}).then(function () {
                expect(plugman.install).toHaveBeenCalled();
                expect(events.emit).toHaveBeenCalledWith('verbose', 'Found variables for "cordova-plugin-camera". Processing as cli_variables.');
            }).fail(function (e) {
                fail('fail handler unexpectedly invoked');
            }).done(done);
        });
    });
});
