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

var path = require('path'),
    fs = require('fs'),
    events = require('cordova-common').events,
    preferences = require('../../../src/cordova/metadata/parserhelper/preferences'),
    ConfigParser = require('cordova-common').ConfigParser;

// Create a real config object before mocking out everything.
var xml = path.join(__dirname, '..', '..', 'test-config.xml');
var cfg = new ConfigParser(xml);

describe('preferences', function() {

    describe('properties', function() {

        it('should define global orientation constants', function() {
            expect(preferences.ORIENTATION_DEFAULT).toEqual('default');
            expect(preferences.ORIENTATION_PORTRAIT).toEqual('portrait');
            expect(preferences.ORIENTATION_LANDSCAPE).toEqual('landscape');
            expect(preferences.ORIENTATION_GLOBAL_ORIENTATIONS).toEqual([ 'default', 'portrait', 'landscape' ]);
        });

    });

    describe('methods', function() {

        var readFile, emit;

        beforeEach(function() {
            readFile = spyOn(fs, 'readFileSync');
            emit = spyOn(events, 'emit');
        });

        describe('isDefaultOrientation', function() {

            it('should return true if an orientation is the default orientation', function() {
                expect(preferences.isDefaultOrientation('default')).toBe(true);
            });
            it('should return false if an orientation is not the default orientation', function() {
                expect(preferences.isDefaultOrientation('some-orientation')).toBe(false);
            });

        });

        describe('isGlobalOrientation', function() {

            it('should return true if an orientation is a global orientation', function() {
                expect(preferences.isGlobalOrientation('portrait')).toBe(true);
            });
            it('should return false if an orientation is a global orientation', function() {
                expect(preferences.isGlobalOrientation('some-orientation')).toBe(false);
            });

        });

        describe('getOrientation', function() {

            it('should handle no platform', function() {
                expect(preferences.getOrientation(cfg)).toEqual('portrait');
                expect(emit).not.toHaveBeenCalled();
            });
            it('should handle undefined platform-specific orientation', function() {
                expect(preferences.getOrientation(cfg, 'ios')).toEqual('portrait');
                expect(emit).not.toHaveBeenCalled();
            });
            it('should handle platform-specific orientation', function() {
                expect(preferences.getOrientation(cfg, 'android')).toEqual('landscape');
            });
            it('should handle no orientation', function() {
                var configXml = '<?xml version="1.0" encoding="UTF-8"?><widget></widget>';
                readFile.andReturn(configXml);
                var configParser = new ConfigParser(xml);
                expect(preferences.getOrientation(configParser)).toEqual('');
                expect(emit).not.toHaveBeenCalled();
            });
            it('should handle invalid global orientation', function() {
                var configXml = '<?xml version="1.0" encoding="UTF-8"?><widget><preference name="orientation" value="foobar" /></widget>';
                readFile.andReturn(configXml);
                var configParser = new ConfigParser(xml);
                expect(preferences.getOrientation(configParser)).toEqual('default');
                expect(emit).toHaveBeenCalledWith('warn', 'Unsupported global orientation: foobar');
                expect(emit).toHaveBeenCalledWith('warn', 'Defaulting to value: default');
            });
            it('should handle custom platform-specific orientation', function() {
                var configXml = '<?xml version="1.0" encoding="UTF-8"?><widget><platform name="some-platform"><preference name="orientation" value="foobar" /></platform></widget>';
                readFile.andReturn(configXml);
                var configParser = new ConfigParser(xml);
                expect(preferences.getOrientation(configParser, 'some-platform')).toEqual('foobar');
            });

        });

    });

});
