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

var Q = require('q');
var superspawn = require('../src/superspawn');

var LS = process.platform === 'win32' ? 'dir' : 'ls';

describe('spawn method', function() {
    var progressSpy, failSpy;

    beforeEach(function () {
        progressSpy = jasmine.createSpy('progress');
        failSpy = jasmine.createSpy('fail');
    });

    it('should return a promise', function () {
        expect(Q.isPromise(superspawn.spawn(LS))).toBe(true);
        expect(Q.isPromise(superspawn.spawn('invalid_command'))).toBe(true);
    });

    it('should notify about stdout "data" events', function (done) {
        superspawn.spawn(LS, [], {stdio: 'pipe'})
        .progress(progressSpy)
        .fin(function () {
            expect(progressSpy).toHaveBeenCalledWith({'stdout': jasmine.any(String)});
            done();
        });
    });

    it('should notify about stderr "data" events', function (done) {
        superspawn.spawn(LS, ['doesnt-exist'], {stdio: 'pipe'})
        .progress(progressSpy)
        .fin(function () {
            expect(progressSpy).toHaveBeenCalledWith({'stderr': jasmine.any(String)});
            done();
        });
    });

});
