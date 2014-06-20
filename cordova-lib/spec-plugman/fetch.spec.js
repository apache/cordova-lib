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
var fetch   = require('../src/plugman/fetch'),
    fs      = require('fs'),
    os      = require('osenv'),
    path    = require('path'),
    shell   = require('shelljs'),
    xml_helpers = require('../src/util/xml-helpers'),
    metadata = require('../src/plugman/util/metadata'),
    temp    = path.join(os.tmpdir(), 'plugman'),
    test_plugin = path.join(__dirname, 'plugins', 'ChildBrowser'),
    test_plugin_with_space = path.join(__dirname, 'folder with space', 'plugins', 'ChildBrowser'),
    plugins = require('../src/plugman/util/plugins'),
    Q = require('q'),
    registry = require('../src/plugman/registry/registry');

describe('fetch', function() {
    function wrapper(p, done, post) {
        p.then(post, function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }

    describe('local plugins', function() {
        var xml, rm, sym, mkdir, cp, save_metadata;
        beforeEach(function() {
            xml = spyOn(xml_helpers, 'parseElementtreeSync').andReturn({
                getroot:function() { return {attrib:{id:'id', version:'version'}};}
            });
            rm = spyOn(shell, 'rm');
            sym = spyOn(fs, 'symlinkSync');
            mkdir = spyOn(shell, 'mkdir');
            cp = spyOn(shell, 'cp');
            save_metadata = spyOn(metadata, 'save_fetch_metadata');
        });

        it('should copy locally-available plugin to plugins directory', function(done) {
            wrapper(fetch(test_plugin, temp), done, function() {
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_plugin, '*'), path.join(temp, 'id'));
            });
        });
        it('should copy locally-available plugin to plugins directory when spaces in path', function(done) {
            //XXX: added this because plugman tries to fetch from registry when plugin folder does not exist
            spyOn(fs,'existsSync').andReturn(true);
            wrapper(fetch(test_plugin_with_space, temp), done, function() {
                expect(cp).toHaveBeenCalledWith('-R', path.join(test_plugin_with_space, '*'), path.join(temp, 'id'));
            });
        });
        it('should create a symlink if used with `link` param', function(done) {
            wrapper(fetch(test_plugin, temp, { link: true }), done, function() {
                expect(sym).toHaveBeenCalledWith(test_plugin, path.join(temp, 'id'), 'dir');
            });
        });
        it('should fail when the expected ID doesn\'t match', function(done) {
            fetch(test_plugin, temp, { expected_id: 'wrongID' })
            .then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(''+err).toContain('Expected fetched plugin to have ID "wrongID" but got "id".');
            }).fin(done);
        });
        it('should succeed when the expected ID is correct', function(done) {
            wrapper(fetch(test_plugin, temp, { expected_id: 'id' }), done, function() {
                expect(1).toBe(1);
            });
        });
        it('should fail when the expected ID with version specified doesn\'t match', function(done) {
            fetch(test_plugin, temp, { expected_id: 'id@wrongVersion' })
            .then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(''+err).toContain('Expected fetched plugin to have ID "id@wrongVersion" but got "id@version".');
            }).fin(done);
        });
        it('should succeed when the plugin version specified is correct', function(done) {
            wrapper(fetch(test_plugin, temp, { expected_id: 'id@version' }), done, function() {
                expect(1).toBe(1);
            });
        });
    });
    describe('git plugins', function() {
        var clone, save_metadata, done, xml;

        function fetchPromise(f) {
            f.then(function() { done = true; }, function(err) { done = err; });
        }

        beforeEach(function() {
            clone = spyOn(plugins, 'clonePluginGitRepo').andReturn(Q('somedir'));
            save_metadata = spyOn(metadata, 'save_fetch_metadata');
            done = false;
            xml = spyOn(xml_helpers, 'parseElementtreeSync').andReturn({
                getroot:function() { return {attrib:{id:'id', version:'version'}};}
            });
        });
        it('should call clonePluginGitRepo for https:// and git:// based urls', function() {
            var url = "https://github.com/bobeast/GAPlugin.git";
            runs(function() {
                fetchPromise(fetch(url, temp));
            });
            waitsFor(function() { return done; }, 'fetch promise never resolved', 250);
            runs(function() {
                expect(done).toBe(true);
                expect(clone).toHaveBeenCalledWith(url, temp, '.', undefined);
                expect(save_metadata).toHaveBeenCalledWith('somedir', jasmine.any(Object));
            });
        });
        it('should call clonePluginGitRepo with subdir if applicable', function() {
            var url = "https://github.com/bobeast/GAPlugin.git";
            var dir = 'fakeSubDir';
            runs(function() {
                fetchPromise(fetch(url, temp, { subdir: dir }));
            });
            waitsFor(function() { return done; }, 'fetch promise never resolved', 250);
            runs(function() {
                expect(clone).toHaveBeenCalledWith(url, temp, dir, undefined);
                expect(save_metadata).toHaveBeenCalledWith('somedir', jasmine.any(Object));
            });
        });
        it('should call clonePluginGitRepo with subdir and git ref if applicable', function() {
            var url = "https://github.com/bobeast/GAPlugin.git";
            var dir = 'fakeSubDir';
            var ref = 'fakeGitRef';
            runs(function() {
                fetchPromise(fetch(url, temp, { subdir: dir, git_ref: ref }));
            });
            waitsFor(function() { return done; }, 'fetch promise never resolved', 250);
            runs(function() {
                expect(clone).toHaveBeenCalledWith(url, temp, dir, ref);
                expect(save_metadata).toHaveBeenCalledWith('somedir', jasmine.any(Object));
            });
        });
        it('should extract the git ref from the URL hash, if provided', function() {
            var url = "https://github.com/bobeast/GAPlugin.git#fakeGitRef";
            var baseURL = "https://github.com/bobeast/GAPlugin.git";
            runs(function() {
                fetchPromise(fetch(url, temp, {}));
            });
            waitsFor(function() { return done; }, 'fetch promise never resolved', 250);
            runs(function() {
                expect(clone).toHaveBeenCalledWith(baseURL, temp, '.', 'fakeGitRef');
                expect(save_metadata).toHaveBeenCalledWith('somedir', jasmine.any(Object));
            });
        });
        it('should extract the subdir from the URL hash, if provided', function() {
            var url = "https://github.com/bobeast/GAPlugin.git#:fakeSubDir";
            var baseURL = "https://github.com/bobeast/GAPlugin.git";
            runs(function() {
                fetchPromise(fetch(url, temp, {}));
            });
            waitsFor(function() { return done; }, 'fetch promise never resolved', 250);
            runs(function() {
                expect(clone).toHaveBeenCalledWith(baseURL, temp, 'fakeSubDir', undefined);
                expect(save_metadata).toHaveBeenCalledWith('somedir', jasmine.any(Object));
            });
        });
        it('should extract the git ref and subdir from the URL hash, if provided', function() {
            var url = "https://github.com/bobeast/GAPlugin.git#fakeGitRef:/fake/Sub/Dir/";
            var baseURL = "https://github.com/bobeast/GAPlugin.git";
            runs(function() {
                fetchPromise(fetch(url, temp, {}));
            });
            waitsFor(function() { return done; }, 'fetch promise never resolved', 250);
            runs(function() {
                expect(clone).toHaveBeenCalledWith(baseURL, temp, 'fake/Sub/Dir', 'fakeGitRef');
                expect(save_metadata).toHaveBeenCalledWith('somedir', jasmine.any(Object));
            });
        });
        it('should throw if used with url and `link` param', function() {
            runs(function() {
                fetch("https://github.com/bobeast/GAPlugin.git", temp, {link:true}).then(null, function(err) { done = err; });
            });
            waitsFor(function() { return done; }, 'fetch promise never resolved', 250);
            runs(function() {
                expect(''+done).toContain('--link is not supported for git URLs');
            });
        });
        it('should fail when the expected ID doesn\'t match', function(done) {
            fetch('https://github.com/bobeast/GAPlugin.git', temp, { expected_id: 'wrongID' })
            .then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(''+err).toContain('Expected fetched plugin to have ID "wrongID" but got "id".');
            }).fin(done);
        });
        it('should fail when the expected ID with version specified doesn\'t match', function(done) {
            fetch('https://github.com/bobeast/GAPlugin.git', temp, { expected_id: 'id@wrongVersion' })
            .then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(''+err).toContain('Expected fetched plugin to have ID "id@wrongVersion" but got "id@version".');
            }).fin(done);
        });
        it('should succeed when the expected ID is correct', function(done) {
            wrapper(fetch('https://github.com/bobeast/GAPlugin.git', temp, { expected_id: 'id' }), done, function() {
                expect(1).toBe(1);
            });
        });
        it('should succeed when the plugin version specified is correct', function(done) {
            wrapper(fetch('https://github.com/bobeast/GAPlugin.git', temp, { expected_id: 'id@version' }), done, function() {
                expect(1).toBe(1);
            });
        });
    });
    describe('registry plugins', function() {
        var pluginId = 'dummyplugin', sFetch;
        var xml, rm, sym, mkdir, cp, save_metadata;
        beforeEach(function() {
            xml = spyOn(xml_helpers, 'parseElementtreeSync').andReturn({
                getroot:function() { return {attrib:{id:'id', version:'version'}};}
            });
            rm = spyOn(shell, 'rm');
            sym = spyOn(fs, 'symlinkSync');
            mkdir = spyOn(shell, 'mkdir');
            cp = spyOn(shell, 'cp');
            save_metadata = spyOn(metadata, 'save_fetch_metadata');
            sFetch = spyOn(registry, 'fetch').andReturn(Q('somedir'));
        });

        it('should get a plugin from registry and set the right client when argument is not a folder nor URL', function(done) {
            wrapper(fetch(pluginId, temp, {client: 'plugman'}), done, function() {
                expect(sFetch).toHaveBeenCalledWith([pluginId], 'plugman');
            });
        });
        it('should fail when the expected ID doesn\'t match', function(done) {
            fetch(pluginId, temp, { expected_id: 'wrongID' })
            .then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(''+err).toContain('Expected fetched plugin to have ID "wrongID" but got "id".');
            }).fin(done);
        });
        it('should fail when the expected ID with version specified doesn\'t match', function(done) {
            fetch(pluginId, temp, { expected_id: 'id@wrongVersion' })
            .then(function() {
                expect('this call').toBe('fail');
            }, function(err) {
                expect(''+err).toContain('Expected fetched plugin to have ID "id@wrongVersion" but got "id@version".');
            }).fin(done);
        });
        it('should succeed when the expected ID is correct', function(done) {
            wrapper(fetch(pluginId, temp, { expected_id: 'id' }), done, function() {
                expect(1).toBe(1);
            });
        });
        it('should succeed when the plugin version specified is correct', function(done) {
            wrapper(fetch(pluginId, temp, { expected_id: 'id@version' }), done, function() {
                expect(1).toBe(1);
            });
        });
    });
});
