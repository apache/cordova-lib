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

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const rewire = require('rewire');
const fetch = rewire('../src/plugman/fetch');
const metadata = require('../src/plugman/util/metadata');
const temp = path.join(os.tmpdir(), 'plugman', 'fetch');
const plugins_dir = path.join(__dirname, '..', 'spec', 'plugman', 'plugins');
let test_plugin = path.join(plugins_dir, 'org.test.plugins.childbrowser');
const test_pkgjson_plugin = path.join(plugins_dir, 'pkgjson-test-plugin');
const test_plugin_searchpath = path.join(test_plugin, '..');
const test_plugin_id = 'org.test.plugins.childbrowser';
const test_plugin_version = '0.6.0';
const { asymmetricMatchers: { pathNormalizingTo } } = require('../spec/helpers');

describe('fetch', function () {
    describe('local plugins', function () {
        let sym;

        beforeEach(function () {
            fs.rmSync(temp, { recursive: true, force: true });

            spyOn(fs, 'rmSync');
            sym = spyOn(fs, 'symlinkSync');
            spyOn(fs, 'cpSync').and.callThrough();
            spyOn(metadata, 'save_fetch_metadata');

            const fetchSpy = jasmine.createSpy('fetch')
                .and.callFake(x => Promise.resolve(x));
            fetch.__set__({ localPlugins: null, fetch: fetchSpy });
        });

        it('Test 001 : should copy locally-available plugin to plugins directory', function () {
            return fetch(test_plugin, temp).then(function () {
                expect(fs.cpSync).toHaveBeenCalledWith(test_plugin, path.join(temp, test_plugin_id), jasmine.objectContaining({ dereference: true }));
            });
        });

        it('Test 008 : should copy locally-available plugin to plugins directory when spaces in path', () => {
            const testPluginWithSpace = path.join(temp, 'folder with space/org.test.plugins.childbrowser');
            fs.cpSync(test_plugin, testPluginWithSpace, { recursive: true });
            fs.cpSync.calls.reset();

            return fetch(testPluginWithSpace, temp).then(() => {
                expect(fs.cpSync).toHaveBeenCalledWith(testPluginWithSpace, path.join(temp, test_plugin_id), jasmine.any(Object));
            });
        });

        it('Test 002 : should copy locally-available plugin to plugins directory when adding a plugin with searchpath argument', function () {
            return fetch(test_plugin_id, temp, { searchpath: test_plugin_searchpath }).then(function () {
                expect(fs.cpSync).toHaveBeenCalledWith(
                    pathNormalizingTo(test_plugin),
                    path.join(temp, test_plugin_id),
                    jasmine.objectContaining({ dereference: true })
                );
            });
        });
        it('Test 003 : should create a symlink if used with `link` param', function () {
            return fetch(test_plugin, temp, { link: true }).then(function () {
                expect(sym).toHaveBeenCalledWith(test_plugin, path.join(temp, test_plugin_id), 'junction');
            });
        });

        it('Test 004 : should fail when the expected ID doesn\'t match', function () {
            return fetch(test_plugin, temp, { expected_id: 'wrongID' })
                .then(function () {
                    expect('this call').toBe('fail');
                }, function (err) {
                    expect('' + err).toContain('Expected plugin to have ID "wrongID" but got');
                });
        });

        it('Test 005 : should succeed when the expected ID is correct', function () {
            return fetch(test_plugin, temp, { expected_id: test_plugin_id }).then(function () {
                expect().nothing();
            });
        });
        it('Test 006 : should fail when the expected ID with version specified doesn\'t match', function () {
            return fetch(test_plugin, temp, { expected_id: test_plugin_id + '@wrongVersion' })
                .then(function () {
                    expect('this call').toBe('fail');
                }, function (err) {
                    expect('' + err).toContain('to satisfy version "wrongVersion" but got');
                });
        });
        it('Test 007 : should succeed when the plugin version specified is correct', function () {
            const exp_id = test_plugin_id + '@' + test_plugin_version;
            return fetch(test_plugin, temp, { expected_id: exp_id }).then(function () {
                expect().nothing();
            });
        });
        it('Test 027 : should copy locally-available plugin to plugins directory', function () {
            return fetch(test_pkgjson_plugin, temp).then(function () {
                expect(fs.cpSync).toHaveBeenCalledWith(test_pkgjson_plugin, path.join(temp, 'pkgjson-test-plugin'), jasmine.objectContaining({ dereference: true }));
                expect(fetch.__get__('fetch')).toHaveBeenCalledTimes(1);
            });
        });
        it('Test 028 : should fail when locally-available plugin is missing pacakge.json', function () {
            test_plugin = path.join(plugins_dir, 'org.test.androidonly');
            return expectAsync(
                fetch(test_plugin, temp)
            ).toBeRejectedWithError(/needs a valid package\.json/);
        });
    });

    describe('fetch recursive error CB-8809', function () {
        const srcDir = path.join(plugins_dir, 'recursivePlug');
        const appDir = path.join(plugins_dir, 'recursivePlug', 'demo');
        fetch.__set__('fetch', function (pluginDir) {
            return Promise.resolve(pluginDir);
        });

        it('Test 021 : should skip copy to avoid recursive error', function () {
            spyOn(fs, 'cpSync');

            return fetch(srcDir, appDir).then(function () {
                expect(fs.cpSync).not.toHaveBeenCalled();
            });
        });
    });
});
