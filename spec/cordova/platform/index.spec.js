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
var platform = rewire('../../../src/cordova/platform');
var cordova_util = require('../../../src/cordova/util');

describe('cordova/platform', function () {
    var hooksRunnerRevert;
    var projectRoot = 'somepath';
    beforeEach(function () {
        // TODO: if we can change HooksRunner from a prototypal class to a function or object,
        // we could eliminate the need for rewire here and use just jasmine spies.
        hooksRunnerRevert = platform.__set__('HooksRunner', function () {});
        spyOn(cordova_util, 'cdProjectRoot').and.returnValue(projectRoot);
    });

    afterEach(function () {
        hooksRunnerRevert();
    });

    describe('main module function', function () {
        describe('error/warning conditions', function () {
            // TODO: what about other commands? update? save?
            it('should require at least one platform for add and remove commands', function () {
                // targets = empty array
                return platform('add', [])
                    .then(function () {
                        fail('should not succeed without targets');
                    }, function (err) {
                        expect(err).toMatch(/You need to qualify.* with one or more platforms/gi);
                    })
                    .then(function () {
                        // targets = null
                        return platform('remove', null);
                    })
                    .then(function () {
                        fail('should not succeed without targets');
                    }, function (err) {
                        expect(err).toMatch(/You need to qualify.* with one or more platforms/gi);
                    });
            });
        });
        describe('handling of targets parameter', function () {
            var cmd = 'add';
            beforeEach(function () {
                spyOn(platform, cmd).and.returnValue(true);
            });
            it('should be able to handle an array of platform targets', function () {
                var targets = ['nokia brick', 'HAM radio', 'nintendo wii'];
                return platform(cmd, targets)
                    .then(function () {
                        expect(platform[cmd]).toHaveBeenCalledWith(jasmine.any(Object), projectRoot, targets, jasmine.any(Object));
                    });
            });
            it('should be able to handle a single platform target string', function () {
                var target = 'motorola razr';
                return platform(cmd, target)
                    .then(function () {
                        expect(platform[cmd]).toHaveBeenCalledWith(jasmine.any(Object), projectRoot, [target], jasmine.any(Object));
                    });
            });
        });
        describe('happy path (success conditions)', function () {
            it('should direct `add` commands to the `add` method/module', function () {
                spyOn(platform, 'add').and.returnValue(true);
                return platform('add', ['android'])
                    .then(function () {
                        expect(platform.add).toHaveBeenCalled();
                    });
            });
            it('should direct `remove` + `rm` commands to the `remove` method/module', function () {
                spyOn(platform, 'remove').and.returnValue(true);
                return platform('remove', ['android'])
                    .then(function () {
                        expect(platform.remove).toHaveBeenCalled();
                    }).then(function () {
                        platform.remove.calls.reset(); // reset spy counter
                        return platform('rm', ['android']);
                    }).then(function () {
                        expect(platform.remove).toHaveBeenCalled();
                    });
            });
            it('should direct `update` + `up` commands to the `update` method/module', function () {
                spyOn(platform, 'update').and.returnValue(true);
                return platform('update', ['android'])
                    .then(function () {
                        expect(platform.update).toHaveBeenCalled();
                    }).then(function () {
                        platform.update.calls.reset(); // reset spy counter
                        return platform('up', ['android']);
                    }).then(function () {
                        expect(platform.update).toHaveBeenCalled();
                    });
            });
            it('should direct `check` commands to the `check` method/module', function () {
                spyOn(platform, 'check').and.returnValue(true);
                return platform('check', ['android'])
                    .then(function () {
                        expect(platform.check).toHaveBeenCalled();
                    });
            });
            it('should direct `list`, all other commands and no command at all to the `list` method/module', function () {
                spyOn(platform, 'list').and.returnValue(true);
                // test the `list` command directly
                return platform('list')
                    .then(function () {
                        expect(platform.list).toHaveBeenCalled();
                    }).then(function () {
                        platform.list.calls.reset(); // reset spy counter
                        // test the list catch-all
                        return platform('please give me the list command');
                    }).then(function () {
                        expect(platform.list).toHaveBeenCalled();
                    }).then(function () {
                        platform.list.calls.reset(); // reset spy counter
                        // test the lack of providing an argument.
                        return platform();
                    }).then(function () {
                        expect(platform.list).toHaveBeenCalled();
                    });
            });
        });
    });
});
