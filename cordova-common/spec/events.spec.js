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

var EventEmitter = require('events').EventEmitter;
var common = require('../cordova-common');
var events = require('../src/events');

var fakeEmitter = new EventEmitter();
fakeEmitter.FAKE_PROPERTY = 'fake_property';

describe('events module', function() {
    it('should be exposed as module\'s property', function () {
        expect(common.events).toBeDefined();
        expect(common.events).toEqual(jasmine.any(EventEmitter));
    });

    it('should be exposed via get method when required internally', function () {
        expect(events).toBeDefined();
        expect(events.get()).toEqual(jasmine.any(EventEmitter));
    });

    it('should not be exposed as module\'s exports when required internally', function () {
        expect(events).not.toEqual(jasmine.any(EventEmitter));
        expect(function () { events.emit('fake_event', 'fake_message'); }).toThrow();
    });

    it('should be settable via module\'s property', function () {
        var originalEmitter = common.events;
        common.events = fakeEmitter;

        expect(common.events.FAKE_PROPERTY).toBe('fake_property');

        common.events = originalEmitter;
    });

    it('should be settable via set method, when required internally', function () {
        var originalEmitter = events.get();
        events.set(fakeEmitter);

        expect(events.get().FAKE_PROPERTY).toBe('fake_property');

        events.set(originalEmitter);
    });

    it('should throw if set to non-EventEmitter\'s instance', function () {
        expect(function () { common.events = {}; }).toThrow();
    });

    it('get method should return new instance when set via module\' property', function () {
        var originalEmitter = common.events;
        common.events = fakeEmitter;

        expect(common.events.FAKE_PROPERTY).toBe('fake_property');
        expect(events.get().FAKE_PROPERTY).toBe('fake_property');
        expect(events.get()).toBe(common.events);

        common.events = originalEmitter;
    });

});
