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
var fs = require('fs');
var os = require('os');
var path = require('path');
var shell = require('shelljs');
var realrm = shell.rm;
// xml_helpers = require('../src/util/xml-helpers'),
var metadata = require('../src/plugman/util/metadata');
var temp = path.join(os.tmpdir(), 'plugman', 'fetch');
var plugins_dir = path.join(__dirname, '..', 'spec', 'plugman', 'plugins');
var test_plugin = path.join(plugins_dir, 'org.test.plugins.childbrowser');
var test_pkgjson_plugin = path.join(plugins_dir, 'pkgjson-test-plugin');
var test_plugin_searchpath = path.join(test_plugin, '..');
// test_plugin_with_space = path.join(__dirname, 'folder with space', 'plugins', 'org.test.plugins.childbrowser'),
// test_plugin_xml = xml_helpers.parseElementtreeSync(path.join(test_plugin, 'plugin.xml')),
var test_plugin_id = 'org.test.plugins.childbrowser';
var test_plugin_version = '0.6.0';
var Q = require('q');

describe('fetch', function () {
    /*
     * Taking out the following test. Fetch has a copyPlugin method that uses existsSync to see if a plugin already exists in the plugins folder. If the plugin exists in the plugins directory for the cordova project, it won't be copied over. This test fails now due it always returning true for existsSync.
    describe('plugin in a dir with spaces', function() {
        it('should copy locally-available plugin to plugins directory when spaces in path', function(done) {
            // XXX: added this because plugman tries to fetch from registry when plugin folder does not exist
            spyOn(fs,'existsSync').andReturn(true);
            spyOn(xml_helpers, 'parseElementtreeSync').andReturn(test_plugin_xml);
            spyOn(shell, 'rm');
            spyOn(metadata, 'save_fetch_metadata');
            var cp = spyOn(shell, 'cp');
            fetch(test_plugin_with_space, temp).then(function() {
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_plugin_with_space, '*'), path.join(temp, test_plugin_id));
            });
        });
    });
*/
    describe('local plugins', function () {
        /* eslint-disable no-unused-vars */
        var rm;
        var sym;
        var cp;
        var save_metadata;
        var revertLocal;
        var revertFetch;
        var fetchCalls = 0;
        /* eslint-enable no-unused-vars */
        beforeEach(function () {
            rm = spyOn(shell, 'rm');
            sym = spyOn(fs, 'symlinkSync');
            cp = spyOn(shell, 'cp').and.callThrough();
            save_metadata = spyOn(metadata, 'save_fetch_metadata');
            realrm('-rf', temp);
            revertLocal = fetch.__set__('localPlugins', null);
            revertFetch = fetch.__set__('fetch', function (pluginDir) {
                fetchCalls++;
                return Q(pluginDir);
            });
        });

        afterEach(function () {
            revertLocal();
            revertFetch();
            fetchCalls = 0;
        });

        it('Test 001 : should copy locally-available plugin to plugins directory', function () {
            return fetch(test_plugin, temp).then(function () {
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_plugin, '*'), path.join(temp, test_plugin_id));
            });
        });
        it('Test 002 : should copy locally-available plugin to plugins directory when adding a plugin with searchpath argument', function () {
            return fetch(test_plugin_id, temp, { searchpath: test_plugin_searchpath }).then(function () {
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_plugin, '*'), path.join(temp, test_plugin_id));
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
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_pkgjson_plugin, '*'), path.join(temp, 'pkgjson-test-plugin'));
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
            return Q(pluginDir);
        });

        it('Test 021 : should skip copy to avoid recursive error', function () {

            var cp = spyOn(shell, 'cp').and.callFake(function () {});

            return fetch(srcDir, appDir).then(function () {
                expect(cp).not.toHaveBeenCalled();
            });
        });
    });
});
