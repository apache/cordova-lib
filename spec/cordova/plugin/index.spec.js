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
var plugin = rewire('../../../src/cordova/plugin');
var cordova_util = require('../../../src/cordova/util');

describe('cordova/plugin', function () {
    var projectRoot = '/some/path';
    var hook_mock = function () {};

    beforeEach(function () {
        spyOn(cordova_util, 'cdProjectRoot').and.returnValue(projectRoot);
        plugin.__set__('HooksRunner', hook_mock);
    });

    describe('error conditions', function () {
        // TODO: what about search cmd?
        it('should require at least one target for add and rm commands', function () {
            return plugin('add', null).then(function () {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err).toEqual(jasmine.any(Error));
                expect(err.message).toContain('one or more plugins');
            });
        });
    });

    describe('handling/massaging of parameters', function () {
        var cmd = 'add';
        beforeEach(function () {
            spyOn(plugin, cmd).and.returnValue(true);
        });

        it('should be able to handle an array of platform targets', function () {
            var targets = ['plugin1', 'plugin2', 'plugin3'];
            return plugin(cmd, targets)
                .then(function () {
                    expect(plugin[cmd]).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), Object({ options: [ ], plugins: [ 'plugin1', 'plugin2', 'plugin3' ] }));
                });
        });

        it('should be able to handle a single string as a target', function () {
            var targets = 'plugin1';
            return plugin(cmd, targets)
                .then(function () {
                    expect(plugin[cmd]).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), Object({ options: [ ], plugins: [ 'plugin1' ] }));
                });
        });

        it('should transform targets that start with a dash into options', function () {
            var targets = '-plugin1';
            return plugin(cmd, targets)
                .then(function () {
                    expect(plugin[cmd]).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), Object({ options: [ '-plugin1' ], plugins: [ ] }));
                });
        });

        it('should also include targets into a plugins property on options', function () {
            var options = {save: true};
            var targets = 'plugin1';
            return plugin(cmd, targets, options)
                .then(function () {
                    expect(plugin[cmd]).toHaveBeenCalledWith(projectRoot, jasmine.any(Object), Object({ save: true, options: [ ], plugins: [ 'plugin1' ] }));
                });
        });
    });

    describe('happy path', function () {

        it('should direct "add" command to the "add" submodule', function () {
            spyOn(plugin, 'add').and.returnValue(true);
            return plugin('add', ['cordova-plugin-splashscreen'])
                .then(function () {
                    expect(plugin.add).toHaveBeenCalled();
                });
        });

        it('should direct "rm" and "remove" commands to the "remove" submodule', function () {
            spyOn(plugin, 'remove').and.returnValue(true);
            return plugin('remove', ['cordova-plugin-splashscreen'])
                .then(function () {
                    expect(plugin.remove).toHaveBeenCalled();
                });
        });

        it('should direct "search" command to the "search" submodule', function () {
            spyOn(plugin, 'search').and.returnValue(true);
            return plugin('search')
                .then(function () {
                    expect(plugin.search).toHaveBeenCalled();
                });
        });

        it('should direct "save" command to the "save" submodule', function () {
            spyOn(plugin, 'save').and.returnValue(true);
            return plugin('save')
                .then(function () {
                    expect(plugin.save).toHaveBeenCalled();
                });
        });

        it('should direct "list", all other commands and no command at all to the "list" submodule', function () {
            spyOn(plugin, 'list').and.returnValue(true);
            return plugin('list')
                .then(function () {
                    expect(plugin.list).toHaveBeenCalled();
                });
        });
    });
});
