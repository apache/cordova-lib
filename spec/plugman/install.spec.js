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
var install = require('../../src/plugman/install');
var actions = require('cordova-common').ActionStack;
var xmlHelpers = require('cordova-common').xmlHelpers;
var et = require('elementtree');
var PlatformJson = require('cordova-common').PlatformJson;
var events = require('cordova-common').events;
var plugman = require('../../src/plugman/plugman');
var platforms = require('../../src/plugman/platforms/common');
var knownPlatforms = require('../../src/platforms/platforms');
var common = require('../common');
var fs = require('fs-extra');
var os = require('os');
var child_process = require('child_process');
var semver = require('semver');
var Q = require('q');
var spec = __dirname;
var srcProject = path.join(spec, 'projects', 'android');
var temp_dir = path.join(fs.realpathSync(os.tmpdir()), 'plugman-test');
var project = path.join(temp_dir, 'android_install');
var plugins_dir = path.join(spec, 'plugins');
var plugins_install_dir = path.join(project, 'cordova', 'plugins');
var plugins = {
    'org.test.plugins.dummyplugin': path.join(plugins_dir, 'org.test.plugins.dummyplugin'),
    'com.cordova.engine': path.join(plugins_dir, 'com.cordova.engine'),
    'com.cordova.engine-android': path.join(plugins_dir, 'com.cordova.engine-android'),
    'org.test.plugins.childbrowser': path.join(plugins_dir, 'org.test.plugins.childbrowser'),
    'com.adobe.vars': path.join(plugins_dir, 'com.adobe.vars'),
    'org.test.defaultvariables': path.join(plugins_dir, 'org.test.defaultvariables'),
    'org.test.invalid.engine.script': path.join(plugins_dir, 'org.test.invalid.engine.script'),
    'org.test.invalid.engine.no.platform': path.join(plugins_dir, 'org.test.invalid.engine.no.platform'),
    'org.test.invalid.engine.no.scriptSrc': path.join(plugins_dir, 'org.test.invalid.engine.no.scriptSrc'),
    'A': path.join(plugins_dir, 'dependencies', 'A'),
    'B': path.join(plugins_dir, 'dependencies', 'B'),
    'C': path.join(plugins_dir, 'dependencies', 'C'),
    'F': path.join(plugins_dir, 'dependencies', 'F'),
    'G': path.join(plugins_dir, 'dependencies', 'G'),
    'I': path.join(plugins_dir, 'dependencies', 'I'),
    'C@1.0.0': path.join(plugins_dir, 'dependencies', 'C@1.0.0')
};
var results = {};
var TIMEOUT = 90000;
var superspawn = require('cordova-common').superspawn;

// Pre-crete the temp dir, without it the test fails.
fs.ensureDirSync(temp_dir);

var existsSync = fs.existsSync;

// Mocked functions for tests
var fake = {
    'existsSync': {
        'noPlugins': function (path) {
            // fake installed plugin directories as 'not found'
            if (path.slice(-5) !== '.json' && path.indexOf(plugins_install_dir) >= 0) {
                return false;
            }

            return existsSync(path);
        }
    },
    'fetch': {
        'dependencies': function (id, dir) {
            if (id === plugins['A']) { return Q(id); } // full path to plugin
            return Q(path.join(plugins_dir, 'dependencies', id));
        }
    }
};

var TEST_XML = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<widget xmlns     = "http://www.w3.org/ns/widgets"\n' +
    '        xmlns:cdv = "http://cordova.apache.org/ns/1.0"\n' +
    '        id        = "io.cordova.hellocordova"\n' +
    '        version   = "0.0.1">\n' +
    '    <name>Hello Cordova</name>\n' +
    '    <description>\n' +
    '        A sample Apache Cordova application that responds to the deviceready event.\n' +
    '    </description>\n' +
    '    <author href="http://cordova.io" email="dev@cordova.apache.org">\n' +
    '        Apache Cordova Team\n' +
    '    </author>\n' +
    '    <content src="index.html" />\n' +
    '    <access origin="*" />\n' +
    '    <preference name="fullscreen" value="true" />\n' +
    '    <preference name="webviewbounce" value="true" />\n' +
    '</widget>\n';

describe('plugman install start', function () {
    var config_queue_add;
    var actions_push;
    var ca;
    var emit;

    beforeEach(function () {
        config_queue_add = spyOn(PlatformJson.prototype, 'addInstalledPluginToPrepareQueue');
        spyOn(actions.prototype, 'process').and.returnValue(Q(true));
        actions_push = spyOn(actions.prototype, 'push');
        ca = spyOn(actions.prototype, 'createAction');

        var origParseElementtreeSync = xmlHelpers.parseElementtreeSync.bind(xmlHelpers);
        spyOn(xmlHelpers, 'parseElementtreeSync').and.callFake(function (path) {
            if (/config.xml$/.test(path)) return new et.ElementTree(et.XML(TEST_XML));
            return origParseElementtreeSync(path);
        });
    });

    it('Test 001 : plugman install start', function () {
        fs.copySync(srcProject, project);

        // Every time when addPlugin is called it will return some truthy value
        var returnValueIndex = 0;
        var returnValues = [true, {}, [], 'foo', function () {}];
        var api = knownPlatforms.getPlatformApi('android', project);
        var addPluginOrig = api.addPlugin;
        spyOn(api, 'addPlugin').and.callFake(function () {
            return addPluginOrig.apply(api, arguments)
                .then(_ => returnValues[returnValueIndex++]);
        });

        return install('android', project, plugins['org.test.plugins.dummyplugin'])
            .then(function (result) {
                expect(result).toBeTruthy();
                results['actions_callCount'] = actions_push.calls.count();
                results['actions_create'] = ca.calls.argsFor[0];
                results['config_add'] = config_queue_add.calls.argsFor[0];
                return result;
            }).then(function () {
                return install('android', project, plugins['com.cordova.engine']);
            }).then(function (result) {
                expect(result).toBeTruthy();
                emit = spyOn(events, 'emit');
                return install('android', project, plugins['org.test.plugins.childbrowser']);
            }).then(function (result) {
                expect(result).toBeTruthy();
                return install('android', project, plugins['com.adobe.vars'], plugins_install_dir, { cli_variables: {API_KEY: 'batman'} });
            }).then(function (result) {
                expect(result).toBeTruthy();
                return install('android', project, plugins['org.test.defaultvariables'], plugins_install_dir, { cli_variables: {API_KEY: 'batman'} });
            }).then(function (result) {
                expect(result).toBeTruthy();
                results['emit_results'] = [];
                emit.calls.all().forEach(function (val, i) {
                    if (emit.calls.argsFor(i)[0] === 'results') { results['emit_results'].push(emit.calls.argsFor(i)[1]); }
                });
                events.emit('verbose', '***** DONE START *****');
            });
    }, TIMEOUT);
});

describe('install', function () {
    var exec, fetchSpy;

    beforeEach(function () {
        exec = spyOn(child_process, 'exec').and.callFake(function (cmd, cb) {
            cb(false, '', ''); // eslint-disable-line standard/no-callback-literal
        });
        spyOn(superspawn, 'spawn').and.returnValue(Q('3.1.0'));
        spyOn(fs, 'ensureDirSync').and.returnValue(true);
        spyOn(platforms, 'copyFile').and.returnValue(true);

        fetchSpy = spyOn(plugman, 'fetch').and.returnValue(Q(plugins['com.cordova.engine']));
        spyOn(fs, 'writeFileSync').and.returnValue(true);
        spyOn(fs, 'copySync').and.returnValue(true);
        spyOn(fs, 'removeSync').and.returnValue(true);
        spyOn(PlatformJson.prototype, 'addInstalledPluginToPrepareQueue');
    });

    describe('success', function () {
        it('Test 002 : should emit a results event with platform-agnostic <info>', function () {
            // org.test.plugins.childbrowser
            expect(results['emit_results'][0]).toBe('No matter what platform you are installing to, this notice is very important.');
        }, TIMEOUT);
        it('Test 003 : should emit a results event with platform-specific <info>', function () {
            // org.test.plugins.childbrowser
            expect(results['emit_results'][1]).toBe('Please make sure you read this because it is very important to complete the installation of your plugin.');
        }, TIMEOUT);
        it('Test 004 : should interpolate variables into <info> tags', function () {
            // VariableBrowser
            expect(results['emit_results'][2]).toBe('Remember that your api key is batman!');
        }, TIMEOUT);
        it('Test 005 : should call fetch if provided plugin cannot be resolved locally', function () {
            fetchSpy.and.returnValue(Q(plugins['org.test.plugins.dummyplugin']));
            spyOn(fs, 'existsSync').and.callFake(fake['existsSync']['noPlugins']);
            return install('android', project, 'CLEANYOURSHORTS')
                .then(function () {
                    expect(fetchSpy).toHaveBeenCalled();
                });
        });

        describe('engine versions', function () {
            var satisfies;
            beforeEach(function () {
                satisfies = spyOn(semver, 'satisfies').and.returnValue(true);
                spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            });

            it('Test 007 : should check version if plugin has engine tag', function () {
                exec.and.callFake(function (cmd, cb) { cb(null, '2.5.0\n'); });
                return install('android', project, plugins['com.cordova.engine'])
                    .then(function () {
                        expect(satisfies).toHaveBeenCalledWith('2.5.0', '>=1.0.0', true);
                    });
            }, TIMEOUT);
            it('Test 008 : should check version and munge it a little if it has "rc" in it so it plays nice with semver (introduce a dash in it)', function () {
                exec.and.callFake(function (cmd, cb) { cb(null, '3.0.0rc1\n'); });
                return install('android', project, plugins['com.cordova.engine'])
                    .then(function () {
                        expect(satisfies).toHaveBeenCalledWith('3.0.0-rc1', '>=1.0.0', true);
                    });
            }, TIMEOUT);
            it('Test 009 : should check specific platform version over cordova version if specified', function () {
                exec.and.callFake(function (cmd, cb) { cb(null, '3.1.0\n'); });
                return install('android', project, plugins['com.cordova.engine-android'])
                    .then(function () {
                        expect(satisfies).toHaveBeenCalledWith('3.1.0', '>=3.1.0', true);
                    });
            }, TIMEOUT);
            it('Test 010 : should check platform sdk version if specified', function () {
                var cordovaVersion = require('../../package.json').version.replace(/-dev|-nightly.*$/, '');
                exec.and.callFake(function (cmd, cb) { cb(null, '18\n'); });
                return install('android', project, plugins['com.cordova.engine-android'])
                    .then(function () {
                        expect(satisfies.calls.count()).toBe(3);
                        // <engine name="cordova" VERSION=">=3.0.0"/>
                        expect(satisfies.calls.argsFor(0)).toEqual([ cordovaVersion, '>=3.0.0', true ]);
                        // <engine name="cordova-android" VERSION=">=3.1.0"/>
                        expect(satisfies.calls.argsFor(1)).toEqual([ '18.0.0', '>=3.1.0', true ]);
                        // <engine name="android-sdk" VERSION=">=18"/>
                        expect(satisfies.calls.argsFor(2)).toEqual([ '18.0.0', '>=18', true ]);
                    });
            }, TIMEOUT);
            it('Test 011 : should check engine versions', function () {
                return install('android', project, plugins['com.cordova.engine'])
                    .then(function () {
                        var plugmanVersion = require('../../package.json').version.replace(/-dev|-nightly.*$/, '');
                        var cordovaVersion = require('../../package.json').version.replace(/-dev|-nightly.*$/, '');
                        expect(satisfies.calls.count()).toBe(4);
                        // <engine name="cordova" version=">=2.3.0"/>
                        expect(satisfies.calls.argsFor(0)).toEqual([ cordovaVersion, '>=2.3.0', true ]);
                        // <engine name="cordova-plugman" version=">=0.10.0" />
                        expect(satisfies.calls.argsFor(1)).toEqual([ plugmanVersion, '>=0.10.0', true ]);
                        // <engine name="mega-fun-plugin" version=">=1.0.0" scriptSrc="megaFunVersion" platform="*" />
                        expect(satisfies.calls.argsFor(2)).toEqual([ null, '>=1.0.0', true ]);
                        // <engine name="mega-boring-plugin" version=">=3.0.0" scriptSrc="megaBoringVersion" platform="ios|android" />
                        expect(satisfies.calls.argsFor(3)).toEqual([ null, '>=3.0.0', true ]);
                    });
            }, TIMEOUT);
            it('Test 012 : should not check custom engine version that is not supported for platform', function () {
                return install('blackberry10', project, plugins['com.cordova.engine'])
                    .then(function () {
                        // Version >=3.0.0 of `mega-boring-plugin` is specified with platform="ios|android"
                        expect(satisfies.calls.count()).toBe(3);
                        expect(satisfies).not.toHaveBeenCalledWith(jasmine.anything(), '>=3.0.0', true);
                    });
            }, TIMEOUT);
        });

        describe('with dependencies', function () {
            var emit;
            beforeEach(function () {
                spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
                spyOn(fs, 'existsSync').and.callFake(fake['existsSync']['noPlugins']);
                fetchSpy.and.callFake(fake['fetch']['dependencies']);
                emit = spyOn(events, 'emit');
                exec.and.callFake(function (cmd, cb) {
                    cb(null, '9.0.0\n');
                });

                function PlatformApiMock () {}
                PlatformApiMock.addPlugin = function () {
                    return Q();
                };
                spyOn(knownPlatforms, 'getPlatformApi').and.returnValue(PlatformApiMock);
            });

            it('Test 015 : should install specific version of dependency', function () {
                // Plugin I depends on C@1.0.0
                emit.calls.reset();
                return install('android', project, plugins['I'])
                    .then(function () {
                        var install = common.spy.getInstall(emit);
                        expect(fetchSpy).toHaveBeenCalledWith('C@1.0.0', jasmine.any(String), jasmine.any(Object));
                        expect(install).toEqual([
                            'Install start for "C" on android.',
                            'Install start for "I" on android.'
                        ]);
                    }, TIMEOUT);
            }, TIMEOUT);

            it('Test 016 : should install any dependent plugins if missing', function () {
                emit.calls.reset();
                return install('android', project, plugins['A'])
                    .then(function () {
                        var install = common.spy.getInstall(emit);
                        expect(install).toEqual([
                            'Install start for "C" on android.',
                            'Install start for "D" on android.',
                            'Install start for "A" on android.'
                        ]);
                    });
            }, TIMEOUT);

            it('Test 017 : should install any dependent plugins from registry when url is not defined', function () {
                emit.calls.reset();
                return install('android', project, plugins['A'])
                    .then(function () {
                        var install = common.spy.getInstall(emit);
                        expect(install).toEqual([
                            'Install start for "C" on android.',
                            'Install start for "D" on android.',
                            'Install start for "A" on android.'
                        ]);
                    });
            }, TIMEOUT);

            it('Test 018 : should process all dependent plugins with alternate routes to the same plugin', function () {
                // Plugin F depends on A, C, D and E
                emit.calls.reset();
                return install('android', project, plugins['F'])
                    .then(function () {
                        var install = common.spy.getInstall(emit);
                        expect(install).toEqual([
                            'Install start for "C" on android.',
                            'Install start for "D" on android.',
                            'Install start for "A" on android.',
                            'Install start for "D" on android.',
                            'Install start for "F" on android.'
                        ]);
                    });
            }, TIMEOUT);

            it('Test 019 : should throw if there is a cyclic dependency', function () {
                return install('android', project, plugins['G'])
                    .then(function () {
                        common.spy.getInstall(emit);
                    }).catch(function err (errMsg) {
                        expect(errMsg.toString()).toContain('Cyclic dependency from G to H');
                    });
            }, TIMEOUT);

            it('Test 020 : install subdir relative to top level plugin if no fetch meta', function () {
                return install('android', project, plugins['B'])
                    .then(function () {
                        var install = common.spy.getInstall(emit);
                        expect(install).toEqual([
                            'Install start for "D" on android.',
                            'Install start for "E" on android.',
                            'Install start for "B" on android.'
                        ]);
                    });
            }, TIMEOUT);

            it('Test 021 : install uses meta data (if available) of top level plugin source', function () {
                // Fake metadata so plugin 'B' appears from 'meta/B'
                var meta = require('../../src/plugman/util/metadata');
                spyOn(meta, 'get_fetch_metadata').and.callFake(function () {
                    return {
                        source: {type: 'dir', url: path.join(plugins['B'], '..', 'meta')}
                    };
                });

                return install('android', project, plugins['B'])
                    .then(function () {
                        var install = common.spy.getInstall(emit);
                        expect(install).toEqual([
                            'Install start for "D" on android.',
                            'Install start for "E" on android.',
                            'Install start for "B" on android.'
                        ]);

                        var copy = common.spy.startsWith(emit, 'Copying from');
                        expect(copy.length).toBe(3);
                        expect(copy[0].indexOf(path.normalize('meta/D')) > 0).toBe(true);
                        expect(copy[1].indexOf(path.normalize('meta/subdir/E')) > 0).toBe(true);
                    });
            }, TIMEOUT);
        });
    });

    describe('failure', function () {
        it('Test 023 : should throw if variables are missing', function () {
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            return install('android', project, plugins['com.adobe.vars'])
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err.toString()).toContain('Variable(s) missing: API_KEY');
                });
        }, TIMEOUT);

        it('Test 025 :should not fail when trying to install plugin less than minimum version. Skip instead  ', function () {
            spyOn(semver, 'satisfies').and.returnValue(false);
            exec.and.callFake(function (cmd, cb) {
                cb(null, '0.0.1\n');
            });
            return install('android', project, plugins['com.cordova.engine'])
                .then(function (result) {
                    expect(result).toBe(true);
                });
        }, TIMEOUT);

        it('Test 026 : should throw if the engine scriptSrc escapes out of the plugin dir.', function () {
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            return install('android', project, plugins['org.test.invalid.engine.script'])
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    // <engine name="path-escaping-plugin" version=">=1.0.0" scriptSrc="../../../malicious/script" platform="*" />
                    expect(err).toBeDefined();
                    expect(err.message.indexOf('Security violation:')).toBe(0);
                });
        }, TIMEOUT);
        it('Test 027 : should throw if a non-default cordova engine platform attribute is not defined.', function () {
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            return install('android', project, plugins['org.test.invalid.engine.no.platform'])
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                });
        }, TIMEOUT);
        it('Test 028 : should throw if a non-default cordova engine scriptSrc attribute is not defined.', function () {
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            return install('android', project, plugins['org.test.invalid.engine.no.scriptSrc'])
                .then(function () {
                    fail('Expected promise to be rejected');
                }, function (err) {
                    expect(err).toEqual(jasmine.any(Error));
                });
        }, TIMEOUT);
    });
});

describe('end', function () {

    it('Test 034 : end', function () {
        fs.removeSync(temp_dir);
    }, TIMEOUT);
});
