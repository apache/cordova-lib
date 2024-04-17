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

const fs = require('node:fs');
const create = require('../../src/plugman/create');

describe('plugman/create', () => {
    it('Test 002 : should be successful', function () {
        spyOn(fs, 'existsSync').and.returnValue(false);
        spyOn(fs, 'mkdirSync');
        spyOn(fs, 'writeFileSync');

        return create('name', 'org.plugin.id', '0.0.0', '.', [])
            .then(function (result) {
                expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
            });
    }, 6000);

    it('Test 003 : should fail due to an existing plugin.xml', function () {
        spyOn(fs, 'existsSync').and.returnValue(true);

        return expectAsync(
            create('name', 'org.plugin.id', '0.0.0', '.', [])
        ).toBeRejectedWithError(
            'plugin.xml already exists. Are you already in a plugin?'
        );
    }, 6000);
});
