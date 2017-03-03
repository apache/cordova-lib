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

/* jshint boss:true */

/**
var windowsParser = require('../../src/cordova/metadata/windows_parser'),
    util = require('../../src/cordova/util'),
    path = require('path'),
    shell = require('shelljs'),
    child_process = require('child_process'),
    xmlHelpers = require('cordova-common').xmlHelpers,
    et = require('elementtree'),
    Q = require('q'),
    fs = require('fs'),
    config = require('../../src/cordova/config'),
    Parser = require('../../src/cordova/metadata/parser'),
    ConfigParser = require('cordova-common').ConfigParser,
    HooksRunner = require('../../src/hooks/HooksRunner');

var cfg = new ConfigParser(path.join(__dirname, '..', 'test-config.xml'));

describe('windows project parser', function() {

    var proj = '/some/path';
    var exists, exec, custom, readdir, config_read;
    var winXml;
    beforeEach(function() {
        exists = spyOn(fs, 'existsSync').and.returnValue(true);
        exec = spyOn(child_process, 'exec').and.callFake(function(cmd, opts, cb) {
            if (!cb) cb = opts;
            cb(null, '', '');
        });
        custom = spyOn(config, 'has_custom_path').and.returnValue(false);
        config_read = spyOn(config, 'read').and.callFake(function() {
            return custom() ? {
                lib: {
                    windows: {
                        url: custom()
                    }
                }
            }
            : ({});
        });
        readdir = spyOn(fs, 'readdirSync').and.returnValue(['TestApp.projitems']);
        winXml = null;
        spyOn(xmlHelpers, 'parseElementtreeSync').and.callFake(function(path) {
            return winXml = new et.ElementTree(et.XML('<foo><Application/><Identity/><VisualElements><a/></VisualElements><Capabilities><a/></Capabilities></foo>'));
        });
    });

    function wrapper(promise, done, post) {
        promise.then(post, function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }

    function errorWrapper(promise, done, post) {
        promise.then(function() {
            expect('this call').toBe('fail');
        }, post).fin(done);
    }

    describe('constructions', function() {
        it('should throw if provided directory does not contain a projitems file', function() {
            readdir.and.returnValue([]);
            expect(function() {
                new windowsParser(proj);
            }).toThrow();
        });
        it('should create an instance with path property', function() {
            expect(function() {
                var parser = new windowsParser(proj);
                expect(parser.projDir).toEqual(proj);
            }).not.toThrow();
        });
        it('should be an instance of Parser', function() {
            expect(new windowsParser(proj) instanceof Parser).toBe(true);
        });
        it('should call super with the correct arguments', function() {
            var call = spyOn(Parser, 'call');
            var p = new windowsParser(proj);
            expect(call).toHaveBeenCalledWith(p, 'windows', proj);
        });
    });

    describe('instance', function() {
        var parser, cp, rm, is_cordova, write, read, mv, mkdir;
        var windows_proj = path.join(proj, 'platforms', 'windows');
        beforeEach(function() {
            parser = new windowsParser(windows_proj);
            cp = spyOn(shell, 'cp');
            rm = spyOn(shell, 'rm');
            mv = spyOn(shell, 'mv');
            mkdir = spyOn(shell, 'mkdir');
            is_cordova = spyOn(util, 'isCordova').and.returnValue(proj);
            write = spyOn(fs, 'writeFileSync');
            read = spyOn(fs, 'readFileSync').and.returnValue('');
        });

        describe('update_from_config method', function() {
            it('should throw if the platform does not contain prepare script', function() {
                expect(function() {
                    parser.update_from_config(cfg);
                }).toThrow();
            });
        });

        describe('www_dir method', function() {
            it('should return www', function() {
                expect(parser.www_dir()).toEqual(path.join(windows_proj, 'www'));
            });
        });
        describe('update_www method', function() {
            var update_project;
            beforeEach(function() {
                update_project = spyOn(parser, 'update_project');
            });
            it('should rm project-level www and cp in platform agnostic www', function() {
                parser.update_www(path.join('lib','dir'));
                expect(rm).toHaveBeenCalled();
                expect(cp).toHaveBeenCalled();
            });
        });
        describe('update_project method', function() {
            var config, www, svn, fire, shellls;
            beforeEach(function() {
                config = spyOn(parser, 'update_from_config');
                www = spyOn(parser, 'update_www');
                shellls = spyOn(shell, 'ls').and.returnValue([]);
                svn = spyOn(util, 'deleteSvnFolders');
                exists.and.returnValue(false);
                fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
            });
            it('should call update_from_config', function() {
                parser.update_project();
                expect(config).toHaveBeenCalled();
            });
            it('should throw if update_from_config throws', function(done) {
                var err = new Error('uh oh!');
                config.and.callFake(function() { throw err; });
                errorWrapper(parser.update_project({}), done, function(err) {
                    expect(err).toEqual(err);
                });
            });
            it('should call deleteSvnFolders', function(done) {
                wrapper(parser.update_project(), done, function() {
                    expect(svn).toHaveBeenCalled();
                });
            });
        });
    });
});

*/
