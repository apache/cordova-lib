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

const child_process = require('child_process');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const Q = require('q');
const semver = require('semver');

const { events, PlatformJson, superspawn } = require('cordova-common');
const { spy: emitSpyHelper } = require('../common');
const install = require('../../src/plugman/install');
const knownPlatforms = require('../../src/platforms/platforms');
const platforms = require('../../src/plugman/platforms/common');
const plugman = require('../../src/plugman/plugman');

const srcProject = path.join(__dirname, 'projects', 'android');
const temp_dir = path.join(fs.realpathSync(os.tmpdir()), 'plugman-test');
const project = path.join(temp_dir, 'android_install');
const plugins_dir = path.join(__dirname, 'plugins');
const plugins_install_dir = path.join(project, 'cordova', 'plugins');

function pluginDir (pluginId) {
    const base = pluginId.length === 1
        ? path.join(plugins_dir, 'dependencies')
        : plugins_dir;
    return path.join(base, pluginId);
}

const results = {};
const TIMEOUT = 90000;

const existsSync = fs.existsSync;

// Mocked functions for tests
const fake = {
    existsSync: {
        noPlugins (path) {
            // fake installed plugin directories as 'not found'
            if (path.slice(-5) !== '.json' && path.indexOf(plugins_install_dir) >= 0) {
                return false;
            }

            return existsSync(path);
        }
    },
    fetch: {
        dependencies (id, dir) {
            if (id === pluginDir('A')) { return Q(id); } // full path to plugin
            return Q(path.join(plugins_dir, 'dependencies', id));
        }
    }
};

describe('plugman/install', () => {
    let exec, fetchSpy;

    beforeAll(() => {
        results['emit_results'] = [];
        events.on('results', result => results['emit_results'].push(result));

        fs.copySync(srcProject, project);

        // Every time when addPlugin is called it will return some truthy value
        const returnValues = [true, {}, [], 'foo', () => {}][Symbol.iterator]();
        const api = knownPlatforms.getPlatformApi('android', project);
        const addPluginOrig = api.addPlugin;
        spyOn(api, 'addPlugin').and.callFake(function () {
            return addPluginOrig.apply(api, arguments)
                .then(_ => returnValues.next());
        });

        return install('android', project, pluginDir('org.test.plugins.dummyplugin'))
            .then(result => {
                expect(result).toBeTruthy();
                return install('android', project, pluginDir('com.cordova.engine'));
            }).then(result => {
                expect(result).toBeTruthy();
                return install('android', project, pluginDir('org.test.plugins.childbrowser'));
            }).then(result => {
                expect(result).toBeTruthy();
                return install('android', project, pluginDir('com.adobe.vars'), plugins_install_dir, { cli_variables: {API_KEY: 'batman'} });
            }).then(result => {
                expect(result).toBeTruthy();
                return install('android', project, pluginDir('org.test.defaultvariables'), plugins_install_dir, { cli_variables: {API_KEY: 'batman'} });
            }).then(result => {
                expect(result).toBeTruthy();
                api.addPlugin.and.callThrough();
                events.removeAllListeners('results');
            });
    }, TIMEOUT);

    afterAll(() => {
        fs.removeSync(temp_dir);
    });

    beforeEach(() => {
        exec = spyOn(child_process, 'exec').and.callFake((cmd, cb) => {
            cb(null, '', '');
        });
        spyOn(superspawn, 'spawn').and.returnValue(Q('3.1.0'));
        spyOn(fs, 'ensureDirSync').and.returnValue(true);
        spyOn(platforms, 'copyFile').and.returnValue(true);

        fetchSpy = spyOn(plugman, 'fetch').and.returnValue(Q(pluginDir('com.cordova.engine')));
        spyOn(fs, 'writeFileSync').and.returnValue(true);
        spyOn(fs, 'copySync').and.returnValue(true);
        spyOn(fs, 'removeSync').and.returnValue(true);
        spyOn(PlatformJson.prototype, 'addInstalledPluginToPrepareQueue');
    });

    describe('success', () => {
        it('Test 002 : should emit a results event with platform-agnostic <info>', () => {
            // org.test.plugins.childbrowser
            expect(results['emit_results'][0]).toBe('No matter what platform you are installing to, this notice is very important.');
        }, TIMEOUT);
        it('Test 003 : should emit a results event with platform-specific <info>', () => {
            // org.test.plugins.childbrowser
            expect(results['emit_results'][1]).toBe('Please make sure you read this because it is very important to complete the installation of your plugin.');
        }, TIMEOUT);
        it('Test 004 : should interpolate variables into <info> tags', () => {
            // VariableBrowser
            expect(results['emit_results'][2]).toBe('Remember that your api key is batman!');
        }, TIMEOUT);
        it('Test 005 : should call fetch if provided plugin cannot be resolved locally', () => {
            fetchSpy.and.returnValue(Q(pluginDir('org.test.plugins.dummyplugin')));
            spyOn(fs, 'existsSync').and.callFake(fake['existsSync']['noPlugins']);
            return install('android', project, 'CLEANYOURSHORTS')
                .then(() => {
                    expect(fetchSpy).toHaveBeenCalled();
                });
        });

        describe('engine versions', () => {
            let satisfies;
            beforeEach(() => {
                satisfies = spyOn(semver, 'satisfies').and.returnValue(true);
                spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            });

            it('Test 007 : should check version if plugin has engine tag', () => {
                exec.and.callFake((cmd, cb) => { cb(null, '2.5.0\n'); });
                return install('android', project, pluginDir('com.cordova.engine'))
                    .then(() => {
                        expect(satisfies).toHaveBeenCalledWith('2.5.0', '>=1.0.0', true);
                    });
            }, TIMEOUT);
            it('Test 008 : should check version and munge it a little if it has "rc" in it so it plays nice with semver (introduce a dash in it)', () => {
                exec.and.callFake((cmd, cb) => { cb(null, '3.0.0rc1\n'); });
                return install('android', project, pluginDir('com.cordova.engine'))
                    .then(() => {
                        expect(satisfies).toHaveBeenCalledWith('3.0.0-rc1', '>=1.0.0', true);
                    });
            }, TIMEOUT);
            it('Test 009 : should check specific platform version over cordova version if specified', () => {
                exec.and.callFake((cmd, cb) => { cb(null, '3.1.0\n'); });
                return install('android', project, pluginDir('com.cordova.engine-android'))
                    .then(() => {
                        expect(satisfies).toHaveBeenCalledWith('3.1.0', '>=3.1.0', true);
                    });
            }, TIMEOUT);
            it('Test 010 : should check platform sdk version if specified', () => {
                const cordovaVersion = require('../../package.json').version.replace(/-dev|-nightly.*$/, '');
                exec.and.callFake((cmd, cb) => { cb(null, '18\n'); });
                return install('android', project, pluginDir('com.cordova.engine-android'))
                    .then(() => {
                        expect(satisfies.calls.count()).toBe(3);
                        // <engine name="cordova" VERSION=">=3.0.0"/>
                        expect(satisfies.calls.argsFor(0)).toEqual([ cordovaVersion, '>=3.0.0', true ]);
                        // <engine name="cordova-android" VERSION=">=3.1.0"/>
                        expect(satisfies.calls.argsFor(1)).toEqual([ '18.0.0', '>=3.1.0', true ]);
                        // <engine name="android-sdk" VERSION=">=18"/>
                        expect(satisfies.calls.argsFor(2)).toEqual([ '18.0.0', '>=18', true ]);
                    });
            }, TIMEOUT);
            it('Test 011 : should check engine versions', () => {
                return install('android', project, pluginDir('com.cordova.engine'))
                    .then(() => {
                        const plugmanVersion = require('../../package.json').version.replace(/-dev|-nightly.*$/, '');
                        const cordovaVersion = require('../../package.json').version.replace(/-dev|-nightly.*$/, '');
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
            it('Test 012 : should not check custom engine version that is not supported for platform', () => {
                return install('blackberry10', project, pluginDir('com.cordova.engine'))
                    .then(() => {
                        // Version >=3.0.0 of `mega-boring-plugin` is specified with platform="ios|android"
                        expect(satisfies.calls.count()).toBe(3);
                        expect(satisfies).not.toHaveBeenCalledWith(jasmine.anything(), '>=3.0.0', true);
                    });
            }, TIMEOUT);
        });

        describe('with dependencies', () => {
            let emit;
            beforeEach(() => {
                spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
                spyOn(fs, 'existsSync').and.callFake(fake['existsSync']['noPlugins']);
                fetchSpy.and.callFake(fake['fetch']['dependencies']);
                emit = spyOn(events, 'emit');
                exec.and.callFake((cmd, cb) => {
                    cb(null, '9.0.0\n');
                });

                class PlatformApiMock {
                    static addPlugin () { return Q(); }
                }
                spyOn(knownPlatforms, 'getPlatformApi').and.returnValue(PlatformApiMock);
            });

            it('Test 015 : should install specific version of dependency', () => {
                // Plugin I depends on C@1.0.0
                emit.calls.reset();
                return install('android', project, pluginDir('I'))
                    .then(() => {
                        expect(fetchSpy).toHaveBeenCalledWith('C@1.0.0', jasmine.any(String), jasmine.any(Object));
                        expect(emitSpyHelper.getInstall(emit)).toEqual([
                            'Install start for "C" on android.',
                            'Install start for "I" on android.'
                        ]);
                    }, TIMEOUT);
            }, TIMEOUT);

            it('Test 016 : should install any dependent plugins if missing', () => {
                emit.calls.reset();
                return install('android', project, pluginDir('A'))
                    .then(() => {
                        expect(emitSpyHelper.getInstall(emit)).toEqual([
                            'Install start for "C" on android.',
                            'Install start for "D" on android.',
                            'Install start for "A" on android.'
                        ]);
                    });
            }, TIMEOUT);

            it('Test 017 : should install any dependent plugins from registry when url is not defined', () => {
                emit.calls.reset();
                return install('android', project, pluginDir('A'))
                    .then(() => {
                        expect(emitSpyHelper.getInstall(emit)).toEqual([
                            'Install start for "C" on android.',
                            'Install start for "D" on android.',
                            'Install start for "A" on android.'
                        ]);
                    });
            }, TIMEOUT);

            it('Test 018 : should process all dependent plugins with alternate routes to the same plugin', () => {
                // Plugin F depends on A, C, D and E
                emit.calls.reset();
                return install('android', project, pluginDir('F'))
                    .then(() => {
                        expect(emitSpyHelper.getInstall(emit)).toEqual([
                            'Install start for "C" on android.',
                            'Install start for "D" on android.',
                            'Install start for "A" on android.',
                            'Install start for "D" on android.',
                            'Install start for "F" on android.'
                        ]);
                    });
            }, TIMEOUT);

            it('Test 019 : should throw if there is a cyclic dependency', () => {
                return install('android', project, pluginDir('G'))
                    .then(() => {
                        fail('Expected promise to be rejected');
                    }, err => {
                        expect(err.toString()).toContain('Cyclic dependency from G to H');
                    });
            }, TIMEOUT);

            it('Test 020 : install subdir relative to top level plugin if no fetch meta', () => {
                return install('android', project, pluginDir('B'))
                    .then(() => {
                        expect(emitSpyHelper.getInstall(emit)).toEqual([
                            'Install start for "D" on android.',
                            'Install start for "E" on android.',
                            'Install start for "B" on android.'
                        ]);
                    });
            }, TIMEOUT);

            it('Test 021 : install uses meta data (if available) of top level plugin source', () => {
                // Fake metadata so plugin 'B' appears from 'meta/B'
                const meta = require('../../src/plugman/util/metadata');
                spyOn(meta, 'get_fetch_metadata').and.callFake(() => {
                    return {
                        source: {type: 'dir', url: path.join(pluginDir('B'), '..', 'meta')}
                    };
                });

                return install('android', project, pluginDir('B'))
                    .then(() => {
                        expect(emitSpyHelper.getInstall(emit)).toEqual([
                            'Install start for "D" on android.',
                            'Install start for "E" on android.',
                            'Install start for "B" on android.'
                        ]);

                        const copy = emitSpyHelper.startsWith(emit, 'Copying from');
                        expect(copy.length).toBe(3);
                        expect(copy[0].indexOf(path.normalize('meta/D')) > 0).toBe(true);
                        expect(copy[1].indexOf(path.normalize('meta/subdir/E')) > 0).toBe(true);
                    });
            }, TIMEOUT);
        });
    });

    describe('failure', () => {
        it('Test 023 : should throw if variables are missing', () => {
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            return install('android', project, pluginDir('com.adobe.vars'))
                .then(() => {
                    fail('Expected promise to be rejected');
                }, err => {
                    expect(err.toString()).toContain('Variable(s) missing: API_KEY');
                });
        }, TIMEOUT);

        it('Test 025 :should not fail when trying to install plugin less than minimum version. Skip instead  ', () => {
            spyOn(semver, 'satisfies').and.returnValue(false);
            exec.and.callFake((cmd, cb) => {
                cb(null, '0.0.1\n');
            });
            return install('android', project, pluginDir('com.cordova.engine'))
                .then(result => {
                    expect(result).toBe(true);
                });
        }, TIMEOUT);

        it('Test 026 : should throw if the engine scriptSrc escapes out of the plugin dir.', () => {
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            return install('android', project, pluginDir('org.test.invalid.engine.script'))
                .then(() => {
                    fail('Expected promise to be rejected');
                }, err => {
                    // <engine name="path-escaping-plugin" version=">=1.0.0" scriptSrc="../../../malicious/script" platform="*" />
                    expect(err).toBeDefined();
                    expect(err.message.indexOf('Security violation:')).toBe(0);
                });
        }, TIMEOUT);
        it('Test 027 : should throw if a non-default cordova engine platform attribute is not defined.', () => {
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            return install('android', project, pluginDir('org.test.invalid.engine.no.platform'))
                .then(() => {
                    fail('Expected promise to be rejected');
                }, err => {
                    expect(err).toEqual(jasmine.any(Error));
                });
        }, TIMEOUT);
        it('Test 028 : should throw if a non-default cordova engine scriptSrc attribute is not defined.', () => {
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            return install('android', project, pluginDir('org.test.invalid.engine.no.scriptSrc'))
                .then(() => {
                    fail('Expected promise to be rejected');
                }, err => {
                    expect(err).toEqual(jasmine.any(Error));
                });
        }, TIMEOUT);
    });
});
