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

var browserParser = require('../../src/cordova/metadata/browser_parser'),
    util = require('../../src/cordova/util'),
    path = require('path'),
    shell = require('shelljs'),
    fs = require('fs'),
    Parser = require('../../src/cordova/metadata/parser');

describe('browser project parser', function() {
    var proj = path.join('some', 'path');
    var exists;

    beforeEach(function() {
        exists = spyOn(fs, 'existsSync').andReturn(true);
    });

    describe('constructions', function() {
        it('should create an instance with a path', function() {
            expect(function() {
                var p = new browserParser(proj);
                expect(p.path).toEqual(proj);
            }).not.toThrow();
        });
        it('should be an instance of Parser', function() {
            expect(new browserParser(proj) instanceof Parser).toBe(true);
        });
        it('should call super with the correct arguments', function() {
            var call = spyOn(Parser, 'call');
            var p = new browserParser(proj);
            expect(call).toHaveBeenCalledWith(p, 'browser', proj);
        });
    });

    describe('instance', function() {
        var p, cp, rm, mkdir, is_cordova;
        var browser_proj = path.join(proj, 'platforms', 'browser');

        beforeEach(function() {
            p = new browserParser(browser_proj);
            cp = spyOn(shell, 'cp');
            rm = spyOn(shell, 'rm');
            mkdir = spyOn(shell, 'mkdir');
            is_cordova = spyOn(util, 'isCordova').andReturn(proj);
        });

        describe('www_dir method', function() {
            it('should return /www', function() {
                expect(p.www_dir()).toEqual(path.join(browser_proj, 'www'));
            });
        });

        describe('config_xml method', function() {
            it('should return the location of config.xml', function() {
                expect(p.config_xml()).toEqual(path.join(proj, 'platforms', 'browser', 'config.xml'));
            });
        });

        describe('update_www method', function() {
            it('should rm project-level www and cp in platform agnostic www', function() {
                p.update_www();
                expect(rm).toHaveBeenCalled();
                expect(cp).toHaveBeenCalled();
            });
        });

        describe('update_overrides method', function() {
            it('should do nothing if merges directory does not exist', function() {
                exists.andReturn(false);
                p.update_overrides();
                expect(cp).not.toHaveBeenCalled();
            });

            it('should copy merges path into www', function() {
                p.update_overrides();
                expect(cp).toHaveBeenCalledWith('-rf', path.join(proj, 'merges', 'browser', '*'), path.join(proj, 'platforms', 'browser', 'www'));
            });
        });
    });
});
