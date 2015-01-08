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
    ParserHelper = require('../../../src/cordova/metadata/parserhelper/ParserHelper'),
    ConfigParser = require('../../../src/configparser/ConfigParser');

// Create a real config object before mocking out everything.
var xml = path.join(__dirname, '..', '..', 'test-config.xml');
var cfg = new ConfigParser(xml);

describe('ParserHelper', function() {

    describe('constructions', function() {

        it('should pass platform name as a constructor parameter', function() {
            var ph = new ParserHelper();
            expect(ph.platform).toEqual('');
            ph = new ParserHelper('some-platform');
            expect(ph.platform).toEqual('some-platform');
        });

    });

    describe('instance', function() {

        var parserHelper;

        beforeEach(function() {
            parserHelper = new ParserHelper();
        });

        describe('getOrientation method', function() {

            it('should return the global orientation value', function() {
                expect(parserHelper.getOrientation(cfg)).toEqual('portrait');
            });
            it('should return the platform-specific orientation value', function() {
                var parserHelperAndroid = new ParserHelper('android');
                expect(parserHelperAndroid.getOrientation(cfg)).toEqual('landscape');
            });

        });

    });

});
