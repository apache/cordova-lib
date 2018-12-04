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
var util = require('../../src/cordova/util');
var requirements = rewire('../../src/cordova/requirements');

var project_dir = '/some/path';

describe('cordova/requirements', function () {
    beforeEach(function () {
        spyOn(util, 'isCordova').and.returnValue(project_dir);
    });

    describe('main method', function () {
        it('should fail if no platforms are added', function () {
            return requirements([]).then(function () {
            }, function (err) {
                expect(err).toEqual(jasmine.any(Error));
                expect(err.message).toMatch('No platforms added');
            });
        });
    });
});
