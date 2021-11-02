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
const platform = require('../../src/plugman/platform');
const fs = require('fs-extra');

describe('plugman/platform', () => {
    describe('add', function () {
        beforeEach(function () {
            spyOn(fs, 'existsSync').and.returnValue(false);
        });
        it('Test 002 : should error on non existing plugin.xml', function () {
            return expectAsync(
                platform.add()
            ).toBeRejectedWithError(
                'can\'t find a plugin.xml.  Are you in the plugin?'
            );
        }, 6000);
    });

    describe('remove', function () {
        beforeEach(function () {
            spyOn(fs, 'existsSync').and.returnValue(false);
        });
        it('Test 003 : should error on non existing plugin.xml', function () {
            return expectAsync(
                platform.remove()
            ).toBeRejectedWithError(
                'can\'t find a plugin.xml.  Are you in the plugin?'
            );
        }, 6000);
    });
});
