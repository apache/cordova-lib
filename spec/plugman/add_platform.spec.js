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
var platform = require('../../src/plugman/platform');
var Q = require('q');
var fs = require('fs');

describe('platform add/remove', function () {
    it('Test 001 : should call platform add', function () {
        var sPlatformA = spyOn(platform, 'add').and.returnValue(Q());
        var sPlatformR = spyOn(platform, 'remove').and.returnValue(Q());
        platform.add();
        expect(sPlatformA).toHaveBeenCalled();
        platform.remove();
        expect(sPlatformR).toHaveBeenCalled();
    });
});

describe('platform add', function () {
    beforeEach(function () {
        spyOn(fs, 'existsSync').and.returnValue(false);
    });
    it('Test 002 : should error on non existing plugin.xml', function () {
        return platform.add().then(function () {
            fail('Expected promise to be rejected');
        }, function (err) {
            expect(err).toEqual(jasmine.any(Error));
            expect(err.message).toContain('can\'t find a plugin.xml.  Are you in the plugin?');
        });
    }, 6000);
});

describe('platform remove', function () {
    beforeEach(function () {
        spyOn(fs, 'existsSync').and.returnValue(false);
    });
    it('Test 003 : should error on non existing plugin.xml', function () {
        return platform.remove().then(function () {
            fail('Expected promise to be rejected');
        }, function (err) {
            expect(err).toEqual(jasmine.any(Error));
            expect(err.message).toContain('can\'t find a plugin.xml.  Are you in the plugin?');
        });
    }, 6000);
});
