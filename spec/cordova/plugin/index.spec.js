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
// TODO: remove once eslint lands
/* eslint-env jasmine */
/* globals fail */

var rewire = require('rewire');
var plugin = rewire('../../../src/cordova/plugin');
var cordova_util = require('../../../src/cordova/util');

describe('cordova/plugin', function () {
    var projectRoot = '/some/path';
    var hook_mock = function () {};
    var hook_revert_mock; // eslint-disable-line no-unused-vars

    beforeEach(function () {
        spyOn(cordova_util, 'cdProjectRoot').and.returnValue(projectRoot);
        hook_revert_mock = plugin.__set__('HooksRunner', hook_mock);
    });

    describe('error conditions', function () {
        // TODO: what about search cmd?
        it('should require at least one target for add and rm commands', function (done) {
            plugin('add', null).then(function () {
                fail('success handler unexpectedly invoked');
            }).fail(function (e) {
                expect(e.message).toContain('one or more plugins');
            }).done(done);
        });
    });

    describe('handling/massaging of parameters', function () {
        var cmd = 'add';
        beforeEach(function () {
            spyOn(plugin, cmd).and.returnValue(true);
        });

        it('should be able to handle an array of platform targets', function (done) {
            var targets = ['plugin1', 'plugin2', 'plugin3'];
            plugin(cmd, targets)
                .then(function () {
                    expect(plugin[cmd]).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), Object({ options: [ ], plugins: [ 'plugin1', 'plugin2', 'plugin3' ] }));
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });

        it('should be able to handle a single string as a target', function (done) {
            var targets = 'plugin1';
            plugin(cmd, targets)
                .then(function () {
                    expect(plugin[cmd]).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), Object({ options: [ ], plugins: [ 'plugin1' ] }));
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });

        it('should transform targets that start with a dash into options', function (done) {
            var targets = '-plugin1';
            plugin(cmd, targets)
                .then(function () {
                    expect(plugin[cmd]).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), Object({ options: [ '-plugin1' ], plugins: [ ] }));
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });

        it('should also include targets into a plugins property on options', function (done) {
            var options = {save: true};
            var targets = 'plugin1';
            plugin(cmd, targets, options)
                .then(function () {
                    expect(plugin[cmd]).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), Object({ save: true, options: [ ], plugins: [ 'plugin1' ] }));
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });
    });

    describe('happy path', function () {

        it('should direct "add" command to the "add" submodule', function (done) {
            spyOn(plugin, 'add').and.returnValue(true);
            plugin('add', ['cordova-plugin-splashscreen'])
                .then(function () {
                    expect(plugin.add).toHaveBeenCalled();
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });

        it('should direct "rm" and "remove" commands to the "remove" submodule', function (done) {
            spyOn(plugin, 'remove').and.returnValue(true);
            plugin('remove', ['cordova-plugin-splashscreen'])
                .then(function () {
                    expect(plugin.remove).toHaveBeenCalled();
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });

        xit('should direct "search" command to the "search" submodule', function (done) {
            spyOn(plugin, 'search').and.returnValue(true);
            plugin('search')
                .then(function () {
                    expect(plugin.search).toHaveBeenCalled();
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });

        it('should direct "save" command to the "save" submodule', function (done) {
            spyOn(plugin, 'save').and.returnValue(true);
            plugin('save')
                .then(function () {
                    expect(plugin.save).toHaveBeenCalled();
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });

        it('should direct "list", all other commands and no command at all to the "list" submodule', function (done) {
            spyOn(plugin, 'list').and.returnValue(true);
            plugin('list')
                .then(function () {
                    expect(plugin.list).toHaveBeenCalled();
                }).fail(function (e) {
                    expect(e).toBeUndefined();
                    fail('did not expect fail handler to be invoked');
                }).done(done);
        });
    });
});
