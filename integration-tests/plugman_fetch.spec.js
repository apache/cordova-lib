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
var rewire = require('rewire');
var fetch = rewire('../src/plugman/fetch');
var fs = require('fs-extra');
var os = require('os');
var path = require('path');
var metadata = require('../src/plugman/util/metadata');
var temp = path.join(os.tmpdir(), 'plugman', 'fetch');
var plugins_dir = path.join(__dirname, '..', 'spec', 'plugman', 'plugins');
var test_plugin = path.join(plugins_dir, 'org.test.plugins.childbrowser');
var test_pkgjson_plugin = path.join(plugins_dir, 'pkgjson-test-plugin');
var test_plugin_searchpath = path.join(test_plugin, '..');
var test_plugin_id = 'org.test.plugins.childbrowser';
var test_plugin_version = '0.6.0';

describe('fetch', function () {

    // Taking out the following test. Fetch has a copyPlugin method that uses
    // existsSync to see if a plugin already exists in the plugins folder. If
    // the plugin exists in the plugins directory for the cordova project, it
    // won't be copied over. This test fails now due it always returning true
    // for existsSync.
    xdescribe('plugin in a dir with spaces', function () {
        var xml_helpers = require('cordova-common').xmlHelpers;
        var test_plugin_with_space = path.join(__dirname, 'folder with space', 'plugins', 'org.test.plugins.childbrowser');
        var test_plugin_xml = xml_helpers.parseElementtreeSync(path.join(test_plugin, 'plugin.xml'));

        it('should copy locally-available plugin to plugins directory when spaces in path', function (done) {
            // XXX: added this because plugman tries to fetch from registry when plugin folder does not exist
            spyOn(fs, 'existsSync').and.returnValue(true);
            spyOn(xml_helpers, 'parseElementtreeSync').and.returnValue(test_plugin_xml);
            spyOn(fs, 'removeSync');
            spyOn(metadata, 'save_fetch_metadata');
            spyOn(fs, 'copySync');
            return fetch(test_plugin_with_space, temp).then(function () {
                expect(fs.copySync).toHaveBeenCalledWith('-R', path.join(test_plugin_with_space, '*'), path.join(temp, test_plugin_id));
            });
        });
    });

    describe('local plugins', function () {
        var sym;
        var revertLocal;
        var revertFetch;
        var fetchCalls = 0;

        beforeEach(function () {
            fs.removeSync(temp);

            spyOn(fs, 'removeSync');
            sym = spyOn(fs, 'symlinkSync');
            spyOn(fs, 'copySync').and.callThrough();
            spyOn(metadata, 'save_fetch_metadata');

            revertLocal = fetch.__set__('localPlugins', null);
            revertFetch = fetch.__set__('fetch', function (pluginDir) {
                fetchCalls++;
                return Promise.resolve(pluginDir);
            });
        });

        afterEach(function () {
            revertLocal();
            revertFetch();
            fetchCalls = 0;
        });

        it('Test 001 : should copy locally-available plugin to plugins directory', function () {
            return fetch(test_plugin, temp).then(function () {
                expect(fs.copySync).toHaveBeenCalledWith(path.join(test_plugin), path.join(temp, test_plugin_id), jasmine.objectContaining({ dereference: true }));
            });
        });
        it('Test 002 : should copy locally-available plugin to plugins directory when adding a plugin with searchpath argument', function () {
            return fetch(test_plugin_id, temp, { searchpath: test_plugin_searchpath }).then(function () {
                expect(fs.copySync).toHaveBeenCalledWith(path.join(test_plugin), path.join(temp, test_plugin_id), jasmine.objectContaining({ dereference: true }));
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
            var exp_id = test_plugin_id + '@' + test_plugin_version;
            return fetch(test_plugin, temp, { expected_id: exp_id }).then(function () {
                expect().nothing();
            });
        });
        it('Test 027 : should copy locally-available plugin to plugins directory', function () {
            return fetch(test_pkgjson_plugin, temp).then(function () {
                expect(fs.copySync).toHaveBeenCalledWith(path.join(test_pkgjson_plugin), path.join(temp, 'pkgjson-test-plugin'), jasmine.objectContaining({ dereference: true }));
                expect(fetchCalls).toBe(1);
            });
        });
        it('Test 028 : should fail when locally-available plugin is missing pacakge.json', function () {
            test_plugin = path.join(plugins_dir, 'org.test.androidonly');
            return fetch(test_plugin, temp)
                .then(function () {
                    fail();
                }, function (err) {
                    expect(err).toBeDefined();
                    expect(err.message).toContain('needs a valid package.json');
                });
        });
    });

    describe('fetch recursive error CB-8809', function () {

        var srcDir = path.join(plugins_dir, 'recursivePlug');
        var appDir = path.join(plugins_dir, 'recursivePlug', 'demo');
        fetch.__set__('fetch', function (pluginDir) {
            return Promise.resolve(pluginDir);
        });

        it('Test 021 : should skip copy to avoid recursive error', function () {
            spyOn(fs, 'copySync');

            return fetch(srcDir, appDir).then(function () {
                expect(fs.copySync).not.toHaveBeenCalled();
            });
        });
    });
});
