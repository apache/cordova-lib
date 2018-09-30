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

var os = require('os');
var platform = require('../../../src/cordova/platform');

describe('cordova.platform', function () {
    // TODO: all these tests below can be moved to addHelper.spec.js, under the "it should require specifying at least one platform" test.
    describe('add function', function () {
        var opts;
        var hooksRunnerMock;
        var projectRoot = os.tmpdir();

        const NO_PLATFORMS_MSG = 'No platform specified. Please specify a platform to add. See `cordova platform list`.';

        beforeEach(function () {
            opts = {};
            hooksRunnerMock = {
                fire: function () {
                    return Promise.resolve();
                }
            };
        });

        it('Test 004 : throws if the target list is empty', function () {
            var targets = [];
            return platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err).toEqual(jasmine.any(Error));
                expect(err.message).toBe(NO_PLATFORMS_MSG);
            });
        });

        it('Test 005 : throws if the target list is undefined', function () {
            var targets; // = undefined;
            return platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err).toEqual(jasmine.any(Error));
                expect(err.message).toBe(NO_PLATFORMS_MSG);
            });
        });

        it('Test 006 : throws if the target list is null', function () {
            const targets = null;
            return platform.add(hooksRunnerMock, projectRoot, targets, opts).then(function () {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err).toEqual(jasmine.any(Error));
                expect(err.message).toBe(NO_PLATFORMS_MSG);
            });
        });
    });
});
