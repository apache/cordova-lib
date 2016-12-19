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

var events = require('../src/events');

describe('forwardEventsTo method', function () {
    afterEach(function() {
        events.forwardEventsTo(null);
    });
    it('Test 001 : should not go to infinite loop when trying to forward to self', function () {
        expect(function() {
            events.forwardEventsTo(events);
            events.emit('log', 'test message');
        }).not.toThrow();
    });
    it('Test 002 : should reset forwarding after trying to forward to self', function () {
        var EventEmitter = require('events').EventEmitter;
        var anotherEventEmitter = new EventEmitter();
        var logSpy = jasmine.createSpy('logSpy');
        anotherEventEmitter.on('log', logSpy);

        events.forwardEventsTo(anotherEventEmitter);
        events.emit('log', 'test message #1');
        expect(logSpy).toHaveBeenCalled();

        logSpy.calls.reset();

        events.forwardEventsTo(events);
        events.emit('log', 'test message #2');
        expect(logSpy).not.toHaveBeenCalled();
    });
});
