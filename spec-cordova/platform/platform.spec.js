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
/* eslint-env jasmine */

var os = require('os');
var Q = require('q');
var platform = require('../src/cordova/platform');

describe('cordova.platform', function () {
    describe('add function', function () {
        var opts;
        var hooksRunnerMock;
        var projectRoot = os.tmpdir();

        beforeEach(function () {
            opts = {};
            hooksRunnerMock = {
                fire: function () {
                    return Q();
                }
            };
        });

        it('Test 004 : throws if the target list is empty', function (done) {
            var targets = [];
            platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
                expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
                done();
            });
        });

        it('Test 005 : throws if the target list is undefined or null', function (done) {
            // case 1 : target list undefined
            var targets; // = undefined;
            platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
                expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
            });

            // case 2 : target list null
            targets = null;
            platform.add(hooksRunnerMock, projectRoot, targets, opts).fail(function (error) {
                expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
                done();
            });
        });
    });
});
