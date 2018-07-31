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

var install = require('../src/plugman/install');
var actions = require('cordova-common').ActionStack;
var PluginInfo = require('cordova-common').PluginInfo;
var events = require('cordova-common').events;
var common = require('../spec/common');
var platforms = require('../src/platforms/platforms');
var xmlHelpers = require('cordova-common').xmlHelpers;
var et = require('elementtree');
var fs = require('fs');
var path = require('path');
var shell = require('shelljs');
var Q = require('q');
var rewire = require('rewire');
var spec = path.join(__dirname, '..', 'spec', 'plugman');
var srcProject = path.join(spec, 'projects', 'android');
var project = path.join(spec, 'projects', 'android_uninstall.test');
var project2 = path.join(spec, 'projects', 'android_uninstall.test2');
var project3 = path.join(spec, 'projects', 'android_uninstall.test3');

var plugins_dir = path.join(spec, 'plugins');
var plugins_install_dir = path.join(project, 'cordova', 'plugins');
var plugins_install_dir2 = path.join(project2, 'cordova', 'plugins');
var plugins_install_dir3 = path.join(project3, 'cordova', 'plugins');

var plugins = {
    'org.test.plugins.dummyplugin': path.join(plugins_dir, 'org.test.plugins.dummyplugin'),
    'A': path.join(plugins_dir, 'dependencies', 'A'),
    'C': path.join(plugins_dir, 'dependencies', 'C')
};
var dummy_id = 'org.test.plugins.dummyplugin';

var dummyPluginInfo = new PluginInfo(plugins['org.test.plugins.dummyplugin']);

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
    '</widget>\n';

var uninstall;

beforeEach(() => {
    uninstall = rewire('../src/plugman/uninstall');
    uninstall.__set__('npmUninstall', jasmine.createSpy());
});

describe('plugman uninstall start', function () {
    beforeEach(function () {
        var origParseElementtreeSync = xmlHelpers.parseElementtreeSync.bind(xmlHelpers);
        spyOn(xmlHelpers, 'parseElementtreeSync').and.callFake(function (path) {
            if (/config.xml$/.test(path)) return new et.ElementTree(et.XML(TEST_XML));
            return origParseElementtreeSync(path);
        });
    });

    it('Test 001 : plugman uninstall start', function () {
        shell.rm('-rf', project, project2, project3);
        shell.cp('-R', path.join(srcProject, '*'), project);
        shell.cp('-R', path.join(srcProject, '*'), project2);
        shell.cp('-R', path.join(srcProject, '*'), project3);

        return install('android', project, plugins['org.test.plugins.dummyplugin'])
            .then(function (result) {
                return install('android', project, plugins['A']);
            }).then(function () {
                return install('android', project2, plugins['C']);
            }).then(function () {
                return install('android', project2, plugins['A']);
            }).then(function () {
                return install('android', project3, plugins['A']);
            }).then(function () {
                return install('android', project3, plugins['C']);
            }).then(function (result) {
                expect(result).toEqual(true);
            });
    }, 60000);
});

describe('uninstallPlatform', function () {
    /* eslint-disable no-unused-vars */
    var proc;
    var rm;
    var fsWrite;
    /* eslint-enable no-unused-vars */

    beforeEach(function () {
        proc = spyOn(actions.prototype, 'process').and.returnValue(Q());
        fsWrite = spyOn(fs, 'writeFileSync').and.returnValue(true);
        rm = spyOn(shell, 'rm').and.returnValue(true);
        spyOn(shell, 'cp').and.returnValue(true);
    });
    describe('success', function () {

        it('Test 002 : should get PlatformApi instance for platform and invoke its\' removePlugin method', function () {
            var platformApi = { removePlugin: jasmine.createSpy('removePlugin').and.returnValue(Q()) };
            var getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);

            return uninstall.uninstallPlatform('android', project, dummy_id)
                .then(function () {
                    expect(getPlatformApi).toHaveBeenCalledWith('android', project);
                    expect(platformApi.removePlugin).toHaveBeenCalled();
                });
        }, 6000);

        it('Test 003 : should return propagate value returned by PlatformApi removePlugin method', function () {
            var platformApi = { removePlugin: jasmine.createSpy('removePlugin') };
            spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);

            var existsSyncOrig = fs.existsSync;
            spyOn(fs, 'existsSync').and.callFake(function (file) {
                if (file.indexOf(dummy_id) >= 0) return true;
                return existsSyncOrig.call(fs, file);
            });

            var fakeProvider = jasmine.createSpyObj('fakeProvider', ['get']);
            fakeProvider.get.and.returnValue(dummyPluginInfo);

            function validateReturnedResultFor (values, expectedResult) {
                return values.reduce(function (promise, value) {
                    return promise
                        .then(function () {
                            platformApi.removePlugin.and.returnValue(Q(value));
                            return uninstall.uninstallPlatform('android', project, dummy_id, null,
                                { pluginInfoProvider: fakeProvider, platformVersion: '9.9.9' });
                        })
                        .then(function (result) {
                            expect(!!result).toEqual(expectedResult);
                        }, function (err) {
                            expect(err).toBeUndefined();
                        });
                }, Q());
            }

            return validateReturnedResultFor([ true, {}, [], 'foo', function () {} ], true)
                .then(function () {
                    return validateReturnedResultFor([ false, null, undefined, '' ], false);
                });
        });

        it('Test 014 : should uninstall dependent plugins', function () {
            var emit = spyOn(events, 'emit');
            return uninstall.uninstallPlatform('android', project, 'A')
                .then(function (result) {
                    expect(emit).toHaveBeenCalledWith('log', 'Uninstalling 2 dependent plugins.');
                });
        });
    });

    describe('failure ', function () {
        it('Test 004 : should throw if platform is unrecognized', function () {
            return uninstall.uninstallPlatform('atari', project, 'SomePlugin')
                .then(function (result) {
                    fail();
                }, function err (errMsg) {
                    expect(errMsg.toString()).toContain('Platform "atari" not supported.');
                });
        }, 6000);

        it('Test 005 : should throw if plugin is missing', function () {
            return uninstall.uninstallPlatform('android', project, 'SomePluginThatDoesntExist')
                .then(function (result) {
                    fail();
                }, function err (errMsg) {
                    expect(errMsg.toString()).toContain('Plugin "SomePluginThatDoesntExist" not found. Already uninstalled?');
                });
        }, 6000);
    });
});

describe('uninstallPlugin', function () {
    /* eslint-disable no-unused-vars */
    var rm;
    var fsWrite;
    var rmstack = [];
    var emit;
    /* eslint-enable no-unused-vars */

    beforeEach(function () {
        fsWrite = spyOn(fs, 'writeFileSync').and.returnValue(true);
        rm = spyOn(shell, 'rm').and.callFake(function (f, p) { rmstack.push(p); return true; });
        rmstack = [];
        emit = spyOn(events, 'emit');
    });
    describe('with dependencies', function () {

        it('Test 006 : should delete all dependent plugins', function () {
            return uninstall.uninstallPlugin('A', plugins_install_dir)
                .then(function (result) {
                    var del = common.spy.getDeleted(emit);
                    expect(del).toEqual([
                        'Deleted plugin "C"',
                        'Deleted plugin "D"',
                        'Deleted plugin "A"'
                    ]);
                });
        });

        it('Test 007 : should fail if plugin is a required dependency', function () {
            return uninstall.uninstallPlugin('C', plugins_install_dir)
                .then(function (result) {
                    fail();
                }, function err (errMsg) {
                    expect(errMsg.toString()).toEqual('Plugin "C" is required by (A) and cannot be removed (hint: use -f or --force)');
                });
        }, 6000);

        it('Test 008 : allow forcefully removing a plugin', function () {
            return uninstall.uninstallPlugin('C', plugins_install_dir, {force: true})
                .then(function () {
                    var del = common.spy.getDeleted(emit);
                    expect(del).toEqual(['Deleted plugin "C"']);
                });
        });

        it('Test 009 : never remove top level plugins if they are a dependency', function () {
            return uninstall.uninstallPlugin('A', plugins_install_dir2)
                .then(function () {
                    var del = common.spy.getDeleted(emit);
                    expect(del).toEqual([
                        'Deleted plugin "D"',
                        'Deleted plugin "A"'
                    ]);
                });
        });

        it('Test 010 : should not remove dependent plugin if it was installed after as top-level', function () {
            return uninstall.uninstallPlugin('A', plugins_install_dir3)
                .then(function () {
                    var del = common.spy.getDeleted(emit);
                    expect(del).toEqual([
                        'Deleted plugin "D"',
                        'Deleted plugin "A"'
                    ]);
                });
        });
    });
});

describe('uninstall', function () {
    /* eslint-disable no-unused-vars */
    var fsWrite;
    var rm;
    /* eslint-enable no-unused-vars */

    beforeEach(function () {
        fsWrite = spyOn(fs, 'writeFileSync').and.returnValue(true);
        rm = spyOn(shell, 'rm').and.returnValue(true);
    });

    describe('failure', function () {
        it('Test 011 : should throw if platform is unrecognized', function () {
            return uninstall('atari', project, 'SomePlugin')
                .then(function (result) {
                    fail();
                }, function err (errMsg) {
                    expect(errMsg.toString()).toContain('Platform "atari" not supported.');
                });
        }, 6000);

        it('Test 012 : should throw if plugin is missing', function () {
            return uninstall('android', project, 'SomePluginThatDoesntExist')
                .then(function (result) {
                    fail();
                }, function err (errMsg) {
                    expect(errMsg.toString()).toContain('Plugin "SomePluginThatDoesntExist" not found. Already uninstalled?');
                });
        }, 6000);
    });
});

describe('end', function () {
    it('Test 013 : end', function () {
        return uninstall('android', project, plugins['org.test.plugins.dummyplugin'])
            .then(function () {
                // Fails... A depends on
                return uninstall('android', project, plugins['C']);
            }).fail(function (err) {
                expect(err.stack).toMatch(/The plugin 'C' is required by \(A\), skipping uninstallation./);
            }).then(function () {
                // dependencies on C,D ... should this only work with --recursive? prompt user..?
                return uninstall('android', project, plugins['A']);
            }).fin(function (err) {
                if (err) { events.emit('error', err); }
                shell.rm('-rf', project, project2, project3);
            });
    });
});
