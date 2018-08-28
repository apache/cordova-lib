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

const Q = require('q');
const fs = require('fs-extra');
const path = require('path');
const rewire = require('rewire');

const { ActionStack, PluginInfo, events } = require('cordova-common');
const common = require('../spec/common');
const install = require('../src/plugman/install');
const platforms = require('../src/platforms/platforms');
const { tmpDir: getTmpDir } = require('../spec/helpers.js');

const spec = path.join(__dirname, '..', 'spec', 'plugman');
const srcProject = path.join(spec, 'projects', 'android');

const tmpDir = getTmpDir('plugman_uninstall_test');
const projectsPath = path.join(tmpDir, 'projects');
const project = path.join(tmpDir, 'project');
const plugins_install_dir = path.join(project, 'cordova/plugins');

const plugins_dir = path.join(spec, 'plugins');
const plugins = {
    'org.test.plugins.dummyplugin': path.join(plugins_dir, 'org.test.plugins.dummyplugin'),
    'A': path.join(plugins_dir, 'dependencies', 'A'),
    'C': path.join(plugins_dir, 'dependencies', 'C')
};

// Grab a reference to the original, before someone stubs it
const { copySync } = fs;
function setupProject (name) {
    const projectPath = path.join(projectsPath, name);
    copySync(projectPath, project);
}

describe('plugman/uninstall', () => {
    let uninstall, emit;

    beforeAll(() => {
        const project1 = path.join(projectsPath, 'uninstall.test');
        const project2 = path.join(projectsPath, 'uninstall.test2');
        const project3 = path.join(projectsPath, 'uninstall.test3');

        for (const p of [project1, project2, project3]) {
            fs.copySync(srcProject, p);
        }

        return install('android', project1, plugins['org.test.plugins.dummyplugin'])
            .then(function (result) {
                return install('android', project1, plugins['A']);
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
    });

    beforeEach(() => {
        uninstall = rewire('../src/plugman/uninstall');
        uninstall.__set__('npmUninstall', jasmine.createSpy());

        emit = spyOn(events, 'emit');
        spyOn(fs, 'writeFileSync').and.returnValue(true);
        spyOn(fs, 'removeSync').and.returnValue(true);
    });

    afterEach(() => {
        // Just so everything fails if someone does not setup their project
        fs.removeSync(project);
    });

    afterAll(() => {
        fs.removeSync(tmpDir);
    });

    describe('uninstallPlatform', function () {
        const dummy_id = 'org.test.plugins.dummyplugin';

        beforeEach(function () {
            setupProject('uninstall.test');

            spyOn(ActionStack.prototype, 'process').and.returnValue(Q());
            spyOn(fs, 'copySync').and.returnValue(true);
        });

        describe('success', function () {

            it('Test 002 : should get PlatformApi instance for platform and invoke its\' removePlugin method', function () {
                const platformApi = { removePlugin: jasmine.createSpy('removePlugin').and.returnValue(Q()) };
                const getPlatformApi = spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);

                return uninstall.uninstallPlatform('android', project, dummy_id)
                    .then(function () {
                        expect(getPlatformApi).toHaveBeenCalledWith('android', project);
                        expect(platformApi.removePlugin).toHaveBeenCalled();
                    });
            });

            it('Test 003 : should return propagate value returned by PlatformApi removePlugin method', function () {
                const platformApi = { removePlugin: jasmine.createSpy('removePlugin') };
                spyOn(platforms, 'getPlatformApi').and.returnValue(platformApi);

                const existsSyncOrig = fs.existsSync;
                spyOn(fs, 'existsSync').and.callFake(function (file) {
                    if (file.indexOf(dummy_id) >= 0) return true;
                    return existsSyncOrig.call(fs, file);
                });

                const fakeProvider = jasmine.createSpyObj('fakeProvider', ['get']);
                const dummyPluginInfo = new PluginInfo(plugins['org.test.plugins.dummyplugin']);
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
                        fail('Expected promise to be rejected');
                    }, function err (errMsg) {
                        expect(errMsg.toString()).toContain('Platform "atari" not supported.');
                    });
            });

            it('Test 005 : should throw if plugin is missing', function () {
                return uninstall.uninstallPlatform('android', project, 'SomePluginThatDoesntExist')
                    .then(function (result) {
                        fail('Expected promise to be rejected');
                    }, function err (errMsg) {
                        expect(errMsg.toString()).toContain('Plugin "SomePluginThatDoesntExist" not found. Already uninstalled?');
                    });
            });
        });
    });

    describe('uninstallPlugin', function () {

        describe('with dependencies', function () {

            it('Test 006 : should delete all dependent plugins', function () {
                setupProject('uninstall.test');

                return uninstall.uninstallPlugin('A', plugins_install_dir)
                    .then(function (result) {
                        const del = common.spy.getDeleted(emit);
                        expect(del).toEqual([
                            'Deleted plugin "C"',
                            'Deleted plugin "D"',
                            'Deleted plugin "A"'
                        ]);
                    });
            });

            it('Test 007 : should fail if plugin is a required dependency', function () {
                setupProject('uninstall.test');

                return uninstall.uninstallPlugin('C', plugins_install_dir)
                    .then(function (result) {
                        fail('Expected promise to be rejected');
                    }, function err (errMsg) {
                        expect(errMsg.toString()).toEqual('Plugin "C" is required by (A) and cannot be removed (hint: use -f or --force)');
                    });
            });

            it('Test 008 : allow forcefully removing a plugin', function () {
                setupProject('uninstall.test');

                return uninstall.uninstallPlugin('C', plugins_install_dir, {force: true})
                    .then(function () {
                        const del = common.spy.getDeleted(emit);
                        expect(del).toEqual(['Deleted plugin "C"']);
                    });
            });

            it('Test 009 : never remove top level plugins if they are a dependency', function () {
                setupProject('uninstall.test2');

                return uninstall.uninstallPlugin('A', plugins_install_dir)
                    .then(function () {
                        const del = common.spy.getDeleted(emit);
                        expect(del).toEqual([
                            'Deleted plugin "D"',
                            'Deleted plugin "A"'
                        ]);
                    });
            });

            it('Test 010 : should not remove dependent plugin if it was installed after as top-level', function () {
                setupProject('uninstall.test3');

                return uninstall.uninstallPlugin('A', plugins_install_dir)
                    .then(function () {
                        const del = common.spy.getDeleted(emit);
                        expect(del).toEqual([
                            'Deleted plugin "D"',
                            'Deleted plugin "A"'
                        ]);
                    });
            });
        });
    });

    describe('uninstall', function () {

        beforeEach(() => {
            setupProject('uninstall.test');
        });

        describe('failure', function () {
            it('Test 011 : should throw if platform is unrecognized', function () {
                return uninstall('atari', project, 'SomePlugin')
                    .then(function (result) {
                        fail('Expected promise to be rejected');
                    }, function err (errMsg) {
                        expect(errMsg.toString()).toContain('Platform "atari" not supported.');
                    });
            });

            it('Test 012 : should throw if plugin is missing', function () {
                return uninstall('android', project, 'SomePluginThatDoesntExist')
                    .then(function (result) {
                        fail('Expected promise to be rejected');
                    }, function err (errMsg) {
                        expect(errMsg.toString()).toContain('Plugin "SomePluginThatDoesntExist" not found. Already uninstalled?');
                    });
            });
        });
    });

    describe('end', function () {
        // TODO this was some test/teardown hybrid.
        // We should either add more expectations or get rid of it
        it('Test 013 : end', function () {
            setupProject('uninstall.test');

            return uninstall('android', project, plugins['org.test.plugins.dummyplugin'])
                .then(function () {
                    // Fails... A depends on
                    return uninstall('android', project, plugins['C']);
                }).catch(function (err) {
                    expect(err.stack).toMatch(/The plugin 'C' is required by \(A\), skipping uninstallation./);
                }).then(function () {
                    // dependencies on C,D ... should this only work with --recursive? prompt user..?
                    return uninstall('android', project, plugins['A']);
                });
        });
    });
});
