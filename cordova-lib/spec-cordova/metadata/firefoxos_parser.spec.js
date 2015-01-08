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
var platforms = require('../../src/cordova/platforms'),
    util = require('../../src/cordova/util'),
    path = require('path'),
    shell = require('shelljs'),
    fs = require('fs'),
    _ = require('underscore'),
    config = require('../../src/cordova/config'),
    Parser = require('../../src/cordova/metadata/parser'),
    ConfigParser = require('../../src/configparser/ConfigParser');

var cfg = new ConfigParser(path.join(__dirname, '..', 'test-config.xml'));

var MANIFEST_JSON = {
    "launch_path": "/index.html", "installs_allowed_from": [ "*" ], "version": "0.0.1", "name": "HelloCordova",
    "description": "A sample Apache Cordova application that responds to the deviceready event.",
    "developer": { "name": "Apache Cordova Team", "url": "http://cordova.io" },
    "orientation": [ "portrait" ], "icons": { "60": "/icon/icon-60.png", "128": "/icon/icon-128.png" }
};

describe('firefoxos project parser', function() {
    var proj = path.join('some', 'path');
    var exists, exec, custom;
    beforeEach(function() {
        exists = spyOn(fs, 'existsSync').andReturn(true);
        exec = spyOn(shell, 'exec').andCallFake(function(cmd, opts, cb) {
            cb(0, '');
        });
        custom = spyOn(config, 'has_custom_path').andReturn(false);
    });

    describe('constructions', function() {
        it('should create an instance with a path', function() {
            expect(function() {
                var p = new platforms.firefoxos.parser(proj);
                expect(p.path).toEqual(proj);
                expect(p.config_path).toEqual(path.join(proj, 'config.xml'));
                expect(p.manifest_path).toEqual(path.join(p.www_dir(), 'manifest.webapp'));
            }).not.toThrow();
        });
        it('should be an instance of Parser', function() {
            expect(new platforms.firefoxos.parser(proj) instanceof Parser).toBeTruthy();
        });
    });

    describe('instance', function() {
        var p, cp, rm, is_cordova, write, read;
        var ff_proj = path.join(proj, 'platforms', 'firefoxos');
        beforeEach(function() {
            p = new platforms.firefoxos.parser(ff_proj);
            cp = spyOn(shell, 'cp');
            rm = spyOn(shell, 'rm');
            is_cordova = spyOn(util, 'isCordova').andReturn(proj);
            write = spyOn(fs, 'writeFileSync');
            read = spyOn(fs, 'readFileSync');

            spyOn(JSON, 'parse').andCallFake(function (path) {
                if (/manifest.webapp$/.exec(path)) {
                    return _.extend({}, MANIFEST_JSON);
                } else {
                    throw new CordovaError('Unexpected JSON.parse(): ' + path);
                }
            });
        });

        describe('update_from_config method', function() {
            beforeEach(function() {
                cfg.name = function() { return 'testname'; };
                cfg.packageName = function() { return 'testpkg'; };
                cfg.version = function() { return '1.0'; };
                read.andReturn(p.manifest_path);
            });

            it('should write manifest.webapp', function() {
                p.update_from_config(cfg);
                expect(write.mostRecentCall.args[0]).toEqual(p.manifest_path);
            });
        });

        describe('www_dir method', function() {
            it('should return www assets dir', function() {
                expect(p.www_dir()).toEqual(path.join(ff_proj, 'www'));
            });
        });

    });
});
