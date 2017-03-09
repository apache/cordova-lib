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

    it('Test 001 : should return a promise', function () {
        expect(Q.isPromise(superspawn.spawn(LS))).toBe(true);
        expect(Q.isPromise(superspawn.spawn('invalid_command'))).toBe(true);
    });

    it('Test 002 : should notify about stdout "data" events', function (done) {
        superspawn.spawn(LS, [], {stdio: 'pipe'})
        .progress(progressSpy)
        .fin(function () {
            expect(progressSpy).toHaveBeenCalledWith({'stdout': jasmine.any(String)});
            done();
        });
    });

    it('Test 003 : should notify about stderr "data" events', function (done) {
        superspawn.spawn(LS, ['doesnt-exist'], {stdio: 'pipe'})
        .progress(progressSpy)
        .fin(function () {
            expect(progressSpy).toHaveBeenCalledWith({'stderr': jasmine.any(String)});
            done();
        });
    });

    it('Test 004 : reject handler should pass in Error object with stdout and stderr properties', function(done) {
        var cp = require('child_process');
        spyOn(cp, 'spawn').and.callFake(function(cmd, args, opts) {
            return {
                stdout:{
                    setEncoding: function(){},
                    on: function(evt, handler) {
                        // some sample stdout output
                        handler('business as usual');
                    }
                },
                stderr:{
                    setEncoding: function(){},
                    on: function(evt, handler) {
                        // some sample stderr output
                        handler('mayday mayday');
                    }
                },
                on: function(evt, handler) {
                    // What's passed to handler here is the exit code, so we can control
                    // resolve/reject flow via this argument.
                    handler(1); // this will trigger error flow
                },
                removeListener: function() {}
            };
        });
        superspawn.spawn('this aggression', ['will', 'not', 'stand', 'man'], {})
        .catch(function(err) {
            expect(err).toBeDefined();
            expect(err.stdout).toContain('usual');
            expect(err.stderr).toContain('mayday');
            done();
        });
    });

});
