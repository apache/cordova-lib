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

describe('(save flag)', function () {
    var rewire      = require('rewire'),
        cordova     = require('../src/cordova/cordova'),
        helpers     = require('./helpers'),
        path        = require('path'),
        Q           = require('q'),
        shell       = require('shelljs'),
        util        = require('../src/cordova/util'),
        prepare     = require('../src/cordova/prepare'),
        platform    = rewire('../src/cordova/platform');

    var appName             = 'testApp',
        tempPath            = path.join(__dirname, 'temp'),
        appPath             = path.join(tempPath, appName),
        platformName        = helpers.testPlatform,
        platformVersionOld  = '4.0.0',
        platformVersionNew  = '4.0.1',
        platformLocalPath   = path.join(__dirname, 'cordova-' + platformName),
        platformGitUrl      = 'https://github.com/apache/cordova-' + platformName,
        platformGitRef      = '4.0.x',
        platformTgzUrl      = 'https://git-wip-us.apache.org/repos/asf?p=cordova-' + platformName + '.git;a=snapshot;h=' + platformVersionNew + ';sf=tgz',
        otherPlatformName   = 'windows',
        otherPlatformSpec   = '4.0.0',
        pluginName          = 'cordova-plugin-console',
        pluginVersion       = '1.0.0',
        pluginGitUrl        = 'https://github.com/apache/cordova-plugin-console.git',
        pluginOldName       = 'org.apache.cordova.console',
        pluginOldVersion    = '0.2.11',
        gitPluginName       = 'cordova-plugin-device',
        gitPluginUrl        = 'https://github.com/apache/cordova-plugin-device.git',
        variablePluginName  = 'com.phonegap.plugins.facebookconnect',
        variablePluginUrl   = 'https://github.com/Wizcorp/phonegap-facebook-plugin',
        localPluginName     = 'org.apache.cordova.fakeplugin1',
        localPluginPath     = path.join(__dirname, 'fixtures', 'plugins', 'fake1'),
        timeout             = 60 * 1000;

    //mock variables
    var revert_copy_cordova_js,
        revert_copy_cordovajs_src,
        revert_install_plugins_for_new_platform;

    beforeEach(function (done) {
        // initial cleanup
        shell.rm('-rf', tempPath);
        shell.mkdir(tempPath);

        //jasmine mocks
        spyOn(util, 'isCordova').andReturn(appPath);
        spyOn(util, 'cdProjectRoot').andReturn(appPath);
        spyOn(cordova.raw, 'prepare').andReturn(Q());

        //rewire mocks
        revert_copy_cordova_js = platform.__set__('copy_cordova_js', function () {});
        revert_copy_cordovajs_src = platform.__set__('copy_cordovajs_src', function () {});
        revert_install_plugins_for_new_platform = platform.__set__('installPluginsForNewPlatform', function () { return Q(); });

       //creating test app
        cordova.raw.create(appPath, undefined, undefined, {}).then(function () {
            //removing unnecessary whitelist plugin from config
            helpers.removePlugin(appPath, 'cordova-plugin-whitelist');
            done();
        }, function (err) {
            expect(true).toBe(false);
            console.log(err);
            done();
        });
    }, timeout);

    afterEach(function () {
        revert_copy_cordova_js();
        revert_copy_cordovajs_src();
        revert_install_plugins_for_new_platform();
    });

    describe('preparing fixtures', function () {
        it('cloning platform', function (done) {
            shell.rm('-rf', platformLocalPath);
            shell.exec('git clone ' + platformGitUrl + ' --depth 1 ' + platformLocalPath, { silent: true }, function (err) {
                expect(err).toBe(0);
                done();
            });
        }, timeout);
    });

    describe('platform add --save', function () {
        it('spec.1 should support custom tgz files', function (done) {
            helpers.removeEngine(appPath, platformName);
            platform('add', platformName + '@' + platformTgzUrl, { 'save': true })
            .then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe(platformTgzUrl);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);

        it('spec.2 should save platform to config', function (done) {
            helpers.removeEngine(appPath, platformName);
            platform('add', platformName, { 'save': true })
            .then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).not.toBe(null);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);

        it('spec.3 should overwrite platform in config, spec = version', function (done) {
            helpers.setEngineSpec(appPath, platformName, platformVersionOld);
            platform('add', platformName, { 'save': true })
            .then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe('~' + platformVersionOld);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);

        it('spec.4 should overwrite platform in config, spec = path', function (done) {
            helpers.setEngineSpec(appPath, platformName, platformLocalPath);
            platform('add', platformName, { 'save': true })
            .then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe(platformLocalPath);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);

        it('spec.5 should fail and should not update config if invalid version is specified', function (done) {
            helpers.removeEngine(appPath, platformName);
            platform('add', platformName + '@3.969.696', { 'save': true })
            .then(function () {
                expect(false).toBe(true);
                done();
            }).catch(function (err) {
                expect(err.message.indexOf('version not found') >= 0).toBe(true);
                expect(helpers.getEngineSpec(appPath, platformName)).toBe(null);
                done();
            });
        });

        it('spec.6 should save local path as spec if added using only local path', function (done) {
            helpers.removeEngine(appPath, platformName);
            platform('add', platformLocalPath, { 'save': true })
            .then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe(platformLocalPath);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);

        it('spec.7 should save git url with git ref properly', function (done) {
            var platformUrl = platformGitUrl + '#' + platformGitRef;
            helpers.removeEngine(appPath, platformName);
            platform('add', platformUrl, { 'save': true })
            .then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe(platformUrl);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);
    });

    describe('platform remove --save', function () {
        it('spec.8 should not update config if there is no engine in it', function (done) {
            helpers.removeEngine(appPath, platformName);
            platform('add', platformLocalPath)
            .then(function () {
                return cordova.raw.platform('rm', platformName, { 'save': true });
            }).then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe(null);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);

        it('spec.9 should remove engine from config', function (done) {
            helpers.setEngineSpec(appPath, platformName, platformLocalPath);
            platform('add', platformLocalPath)
            .then(function () {
                return cordova.raw.platform('rm', platformName, { 'save': true });
            }).then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe(null);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);
    });

    describe('platform update --save', function () {
        it('spec.10 should update config with new spec', function (done) {
            helpers.setEngineSpec(appPath, platformName, platformVersionNew);
            platform('add', platformName + '@' + platformVersionNew)
            .then(function () {
                return cordova.raw.platform('update', platformName + '@' + platformVersionOld, { 'save': true });
            }).then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe('~' + platformVersionOld);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);

        it('spec.11 should update spec with git url when updating using git url', function (done) {
            helpers.setEngineSpec(appPath, platformName, platformVersionNew);
            platform('add', platformName + '@' + platformVersionNew)
            .then(function () {
                return cordova.raw.platform('update', platformGitUrl, { 'save': true });
            }).then(function () {
                var spec = helpers.getEngineSpec(appPath, platformName);
                expect(spec).not.toBe(null);
                expect(spec).not.toBe(platformVersionNew);
                done();
            }).catch(function (err) {
                console.log(err);
                expect(false).toBe(true);
                done();
            });
        }, timeout);
    });

    describe('plugin add --save', function () {
        it('spec.12 should save plugin to config', function (done) {
            platform('add', platformLocalPath)
            .then(function () {
                return cordova.raw.plugin('add', pluginName, { 'save': true });
            }).then(function () {
                expect(helpers.getPluginSpec(appPath, pluginName)).not.toBe(null);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);

        it('spec.13 should create new plugin tag in config with old plugin id when downgrading from plugin with new id', function (done) {
            platform('add', platformLocalPath)
            .then(function () {
                helpers.setPluginSpec(appPath, pluginName, pluginOldVersion);
                return cordova.raw.plugin('add', pluginName, { 'save': true });
            }).then(function () {
                expect(helpers.getPluginSpec(appPath, pluginOldName)).toBe('~' + pluginOldVersion);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);

        it('spec.14 should save variables', function (done) {
            platform('add', platformLocalPath)
            .then(function () {
                return cordova.raw.plugin('add', variablePluginUrl, {
                    'save': true,
                    'cli_variables': {
                        'APP_ID':'123456789',
                        'APP_NAME':'myApplication'
                    }
                });
            }).then(function () {
                expect(helpers.getPluginVariable(appPath, variablePluginName, 'APP_ID')).toBe('123456789');
                expect(helpers.getPluginVariable(appPath, variablePluginName, 'APP_NAME')).toBe('myApplication');
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);

        it('spec.15 save git url as spec', function (done) {
            platform('add', platformLocalPath)
            .then(function () {
                return cordova.raw.plugin('add', pluginGitUrl, { 'save': true });
            }).then(function () {
                expect(helpers.getPluginSpec(appPath, pluginName)).toBe(pluginGitUrl);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);

        it('spec.16 should save local directory as spec', function (done) {
            platform('add', platformLocalPath)
            .then(function () {
                return cordova.raw.plugin('add', localPluginPath, { 'save': true });
            }).then(function () {
                expect(helpers.getPluginSpec(appPath, localPluginName)).toBe(localPluginPath);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);
    });

    describe('plugin remove --save', function () {
        it('spec.17 should not add plugin to config', function (done) {
            platform('add', platformLocalPath)
            .then(function () {
                return cordova.raw.plugin('add', pluginName);
            }).then(function () {
                return cordova.raw.plugin('rm', pluginName, { 'save': true });
            }).then(function () {
                expect(helpers.getPluginSpec(appPath, pluginName)).toBe(null);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);

        it('spec.18 should remove plugin from config', function (done) {
            platform('add', platformLocalPath)
            .then(function () {
                return cordova.raw.plugin('add', pluginName);
            }).then(function () {
                helpers.setPluginSpec(appPath, pluginName, pluginGitUrl);
                return cordova.raw.plugin('rm', pluginName, { 'save': true });
            }).then(function () {
                expect(helpers.getPluginSpec(appPath, pluginName)).toBe(null);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);
    });

    describe('platform save', function () {
        it('spec.19 should not update config when there are no platforms installed', function (done) {
            var configContent = helpers.getConfigContent(appPath);
            platform('save')
            .then(function () {
                expect(helpers.getConfigContent(appPath)).toBe(configContent);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);

        it('spec.20 should add platform to config', function (done) {
            platform('add', platformName + '@' + platformVersionNew)
            .then(function () {
                return platform('save');
            }).then(function () {
                expect(helpers.getEngineSpec(appPath, platformName)).toBe('~' + platformVersionNew);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);
    });

    describe('plugin save', function () {
        it('spec.21 should not update config when there are no plugins installed', function (done) {
            var configContent = helpers.getConfigContent(appPath);
            cordova.raw.plugin('save')
            .finally(function () {
                expect(helpers.getConfigContent(appPath)).toBe(configContent);
                done();
            });
        }, timeout);

        it('spec.22 should update config with plugins: one with version, one with local folder and another one vith git url', function (done) {
            cordova.raw.plugin('add', pluginName + '@' + pluginVersion)
            .then(function () {
                return cordova.raw.plugin('add', gitPluginUrl);
            }).then(function () {
                return cordova.raw.plugin('add', localPluginPath);
            }).then(function () {
                return cordova.raw.plugin('save');
            }).then(function () {
                expect(helpers.getPluginSpec(appPath, pluginName)).toBe('~' + pluginVersion);
                expect(helpers.getPluginSpec(appPath, gitPluginName)).toBe(gitPluginUrl);
                expect(helpers.getPluginSpec(appPath, localPluginName)).toBe(localPluginPath);
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);
    });

    describe('prepare', function () {
        it('spec.23 should restore all platforms and plugins', function (done) {
            helpers.setEngineSpec(appPath, platformName, platformLocalPath);
            helpers.setPluginSpec(appPath, localPluginName, localPluginPath);
            prepare()
            .then(function () {
                expect(path.join(appPath, 'platforms', platformName)).toExist();
                expect(path.join(appPath, 'plugins', localPluginName)).toExist();
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        }, timeout);

        it('spec.24 should restore only specified platform', function (done) {
            helpers.setEngineSpec(appPath, platformName, platformLocalPath);
            helpers.setEngineSpec(appPath, otherPlatformName, otherPlatformSpec);
            var options = {
                verbose: false,
                platforms: [ platformName ],
                options: []
            };
            prepare(options)
            .then(function () {
                expect(path.join(appPath, 'platforms', platformName)).toExist();
                expect(path.join(appPath, 'platforms', otherPlatformName)).not.toExist();
                done();
            }).catch(function (err) {
                expect(true).toBe(false);
                console.log(err.message);
                done();
            });
        });
    });

    describe('(cleanup)', function () {
        it('removing temp dir', function () {
            shell.rm('-rf', tempPath);
            shell.rm('-rf', platformLocalPath);
        });
    });
});
