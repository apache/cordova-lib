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

var fs = require('fs');
var Parser = require('../../../src/cordova/metadata/parser');
var ParserHelper = require('../../../src/cordova/metadata/parserhelper/ParserHelper');

describe('base parser', function () {

    var parser;

    beforeEach(function () {
        spyOn(fs, 'existsSync');
        parser = new Parser();
    });

    describe('properties', function () {

        it('should have properties named path and platform', function () {
            expect(parser.path).not.toBeUndefined();
            expect(parser.platform).not.toBeUndefined();
        });

        it('should have a property named helper that is an instace of ParserHelper', function () {
            var descriptor = Object.getOwnPropertyDescriptor(parser, 'helper');
            expect(descriptor).not.toBeUndefined();
            expect(descriptor.value instanceof ParserHelper).toBe(true);
        });

        it('should have an immutable helper property', function () {
            var value = 'foo';
            parser.helpers = value;
            expect(parser.helper instanceof ParserHelper).toBe(true);
        });

    });

});
