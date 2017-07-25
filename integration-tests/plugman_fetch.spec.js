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
var TIMEOUT = 60 * 1000;
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
var plugins = require('../src/plugman/util/plugins');
var Q = require('q');
var registry = require('../src/plugman/registry/registry');

describe('fetch', function () {

    function wrapper (p, done, post) {
        p.then(post, function (err) {
            expect(err).toBeUndefined('Unexpected exception' + err.stack);
        }).fin(done);
    }
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
            wrapper(fetch(test_plugin_with_space, temp), done, function() {
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

        it('Test 001 : should copy locally-available plugin to plugins directory', function (done) {
            wrapper(fetch(test_plugin, temp), done, function () {
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_plugin, '*'), path.join(temp, test_plugin_id));
            });
        });
        it('Test 002 : should copy locally-available plugin to plugins directory when adding a plugin with searchpath argument', function (done) {
            wrapper(fetch(test_plugin_id, temp, { searchpath: test_plugin_searchpath }), done, function () {
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_plugin, '*'), path.join(temp, test_plugin_id));
            });
        });
        it('Test 003 : should create a symlink if used with `link` param', function (done) {
            wrapper(fetch(test_plugin, temp, { link: true }), done, function () {
                expect(sym).toHaveBeenCalledWith(test_plugin, path.join(temp, test_plugin_id), 'dir');
            });
        });

        it('Test 004 : should fail when the expected ID doesn\'t match', function (done) {
            fetch(test_plugin, temp, { expected_id: 'wrongID' })
                .then(function () {
                    expect('this call').toBe('fail');
                }, function (err) {
                    expect('' + err).toContain('Expected plugin to have ID "wrongID" but got');
                }).fin(done);
        });

        it('Test 005 : should succeed when the expected ID is correct', function (done) {
            wrapper(fetch(test_plugin, temp, { expected_id: test_plugin_id }), done, function () {
                expect(1).toBe(1);
            });
        });
        it('Test 006 : should fail when the expected ID with version specified doesn\'t match', function (done) {
            fetch(test_plugin, temp, { expected_id: test_plugin_id + '@wrongVersion' })
                .then(function () {
                    expect('this call').toBe('fail');
                }, function (err) {
                    expect('' + err).toContain('to satisfy version "wrongVersion" but got');
                }).fin(done);
        });
        it('Test 007 : should succeed when the plugin version specified is correct', function (done) {
            var exp_id = test_plugin_id + '@' + test_plugin_version;
            wrapper(fetch(test_plugin, temp, { expected_id: exp_id }), done, function () {
                expect(1).toBe(1);
            });
        });
        it('Test 027 : should copy locally-available plugin to plugins directory', function (done) {
            wrapper(fetch(test_pkgjson_plugin, temp, {fetch: true}), done, function () {
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_pkgjson_plugin, '*'), path.join(temp, 'pkgjson-test-plugin'));
                expect(fetchCalls).toBe(1);
            });
        });
        it('Test 028 : should fail when locally-available plugin is missing pacakge.json', function (done) {
            fetch(test_plugin, temp, {fetch: true})
                .then(function () {
                    expect(false).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeDefined();
                    expect(err.message).toContain('needs a valid package.json');
                    done();
                });
        });
    });
    describe('git plugins', function () {
        var clone;
        var save_metadata;
        var done; // eslint-disable-line no-unused-vars

        beforeEach(function () {
            clone = spyOn(plugins, 'clonePluginGitRepo').and.returnValue(Q(test_plugin));
            save_metadata = spyOn(metadata, 'save_fetch_metadata');
            done = false;
        });
        it('Test 008 : should call clonePluginGitRepo for https:// and git:// based urls', function (done) {
            var url = 'https://github.com/bobeast/GAPlugin.git';
            fetch(url, temp).then(function () {
                expect(save_metadata).toHaveBeenCalled();
                expect(clone).toHaveBeenCalledWith(url, temp, '.', undefined, undefined);
                done();
            });
        }, 6000);

        it('Test 009 : should call clonePluginGitRepo with subdir if applicable', function (done) {
            var url = 'https://github.com/bobeast/GAPlugin.git';
            var dir = 'fakeSubDir';
            fetch(url, temp, { subdir: dir }).then(function () {
                expect(clone).toHaveBeenCalledWith(url, temp, dir, undefined, undefined);
                expect(save_metadata).toHaveBeenCalled();
                done();
            });
        }, 6000);

        it('Test 010 : should call clonePluginGitRepo with subdir and git ref if applicable', function (done) {
            var url = 'https://github.com/bobeast/GAPlugin.git';
            var dir = 'fakeSubDir';
            var ref = 'fakeGitRef';
            fetch(url, temp, { subdir: dir, git_ref: ref }).then(function () {
                expect(clone).toHaveBeenCalledWith(url, temp, dir, ref, undefined);
                expect(save_metadata).toHaveBeenCalled();
                done();
            });
        }, 6000);

        it('Test 011 : should extract the git ref from the URL hash, if provided', function (done) {
            var url = 'https://github.com/bobeast/GAPlugin.git#fakeGitRef';
            var baseURL = 'https://github.com/bobeast/GAPlugin.git';
            fetch(url, temp, {}).then(function () {
                expect(clone).toHaveBeenCalledWith(baseURL, temp, '.', 'fakeGitRef', undefined);
                expect(save_metadata).toHaveBeenCalled();
                done();
            });
        }, 6000);

        it('Test 012 : should extract the subdir from the URL hash, if provided', function (done) {
            var url = 'https://github.com/bobeast/GAPlugin.git#:fakeSubDir';
            var baseURL = 'https://github.com/bobeast/GAPlugin.git';
            fetch(url, temp, {}).then(function (result) {
                expect(clone).toHaveBeenCalledWith(baseURL, temp, 'fakeSubDir', undefined, undefined);
                expect(save_metadata).toHaveBeenCalled();
                done();
            });
        }, 6000);

        it('Test 013 : should extract the git ref and subdir from the URL hash, if provided', function (done) {
            var url = 'https://github.com/bobeast/GAPlugin.git#fakeGitRef:/fake/Sub/Dir/';
            var baseURL = 'https://github.com/bobeast/GAPlugin.git';
            fetch(url, temp, {}).then(function (result) {
                expect(clone).toHaveBeenCalledWith(baseURL, temp, 'fake/Sub/Dir', 'fakeGitRef', undefined);
                expect(save_metadata).toHaveBeenCalled();
                done();
            });
        }, 6000);

        it('Test 014 : should fail when the expected ID doesn\'t match', function (done) {
            fetch('https://github.com/bobeast/GAPlugin.git', temp, { expected_id: 'wrongID' })
                .then(function () {
                    expect('this call').toBe('fail');
                }, function (err) {
                    expect('' + err).toContain('Expected plugin to have ID "wrongID" but got');
                }).fin(done);
        });

        it('Test 015 : should fail when the expected ID with version specified doesn\'t match', function (done) {
            fetch('https://github.com/bobeast/GAPlugin.git', temp, { expected_id: 'id@wrongVersion' })
                .then(function () {
                    expect('this call').toBe('fail');
                }, function (err) {
                    expect('' + err).toContain('Expected plugin to have ID "id" but got');
                }).fin(done);
        });

        it('Test 016 : should succeed when the expected ID is correct', function (done) {
            wrapper(fetch('https://github.com/bobeast/GAPlugin.git', temp, { expected_id: test_plugin_id }), done, function () {
                expect(1).toBe(1);
            });
        });
    });

    describe('github plugins', function () {
        // these tests actually pull a plugin from github
        beforeEach(function () {
            realrm('-rf', temp);
        });

        // this commit uses the new id
        it('Test 017 : should fetch from a commit-sha', function (done) {
            wrapper(fetch('http://github.com/apache/cordova-plugin-device.git#ad5f1e7bfd05ef98c01df549a0fa98036a5625db', temp, { expected_id: 'cordova-plugin-device' }), done, function () {
                expect(1).toBe(1);
                done();
            });
        }, TIMEOUT);
        // this branch uses the old id
        it('Test 018 : should fetch from a branch', function (done) {
            wrapper(fetch('http://github.com/apache/cordova-plugin-device.git#cdvtest', temp, { expected_id: 'org.apache.cordova.device' }), done, function () {
                expect(1).toBe(1);
                done();
            });
        }, TIMEOUT);
        // this tag uses the new id
        it('Test 019 : should fetch from a tag', function (done) {
            wrapper(fetch('http://github.com/apache/cordova-plugin-device.git#r1.0.0', temp, { expected_id: 'cordova-plugin-device' }), done, function () {
                expect(1).toBe(1);
                done();
            });
        }, TIMEOUT);
    });

    describe('fetch recursive error CB-8809', function () {

        var srcDir = path.join(plugins_dir, 'recursivePlug');
        var appDir = path.join(plugins_dir, 'recursivePlug', 'demo');

        if (/^win/.test(process.platform)) {
            it('Test 020 : should copy all but the /demo/ folder', function (done) {
                var cp = spyOn(shell, 'cp');
                wrapper(fetch(srcDir, appDir), done, function () {
                    expect(cp).toHaveBeenCalledWith('-R', path.join(srcDir, 'asset.txt'), path.join(appDir, 'test-recursive'));
                    expect(cp).not.toHaveBeenCalledWith('-R', srcDir, path.join(appDir, 'test-recursive'));
                });
            });
        } else {
            it('Test 021 : should skip copy to avoid recursive error', function (done) {

                var cp = spyOn(shell, 'cp').and.callFake(function () {});

                wrapper(fetch(srcDir, appDir), done, function () {
                    expect(cp).not.toHaveBeenCalled();
                });
            });
        }

    });

    describe('registry plugins', function () {
        /* eslint-disable no-unused-vars */
        var pluginId = 'dummyplugin';
        var sFetch;
        var rm;
        var sym;
        var save_metadata;
        /* eslint-enable no-unused-vars */
        beforeEach(function () {
            rm = spyOn(shell, 'rm');
            sym = spyOn(fs, 'symlinkSync');
            save_metadata = spyOn(metadata, 'save_fetch_metadata');
            sFetch = spyOn(registry, 'fetch').and.returnValue(Q(test_plugin));
            realrm('-rf', temp);
        });

        it('Test 022 : should fail when the expected ID with version specified doesn\'t match', function (done) {
            // fetch(pluginId, temp, { expected_id: test_plugin_id + '@wrongVersion' })
            fetch(pluginId, temp, { expected_id: 'wrongID' })
                .then(function () {
                    expect('this call').toBe('fail');
                }, function (err) {
                    expect('' + err).toContain('Expected plugin to have ID "wrongID" but got');
                }).fin(done);
        });

        it('Test 023 : should succeed when the expected ID is correct', function (done) {
            wrapper(fetch(pluginId, temp, { expected_id: test_plugin_id }), done, function () {
                expect(1).toBe(1);
            });
        });
        it('Test 024 : should succeed when the plugin version specified is correct', function (done) {
            wrapper(fetch(pluginId, temp, { expected_id: test_plugin_id + '@' + test_plugin_version }), done, function () {
                expect(1).toBe(1);
            });
        });
        it('Test 025 : should fetch plugins that are scoped packages', function (done) {
            var scopedPackage = '@testcope/dummy-plugin';
            wrapper(fetch(scopedPackage, temp, { expected_id: test_plugin_id }), done, function () {
                expect(sFetch).toHaveBeenCalledWith([scopedPackage]);
            });
        });
        it('Test 026 : should fetch plugins that are scoped packages and have versions specified', function (done) {
            var scopedPackage = '@testcope/dummy-plugin@latest';
            wrapper(fetch(scopedPackage, temp, { expected_id: test_plugin_id }), done, function () {
                expect(sFetch).toHaveBeenCalledWith([scopedPackage]);
            });
        });
    });
});
