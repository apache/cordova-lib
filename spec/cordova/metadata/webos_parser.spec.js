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
var webosParser = require('../../../src/cordova/metadata/webos_parser');
var util = require('../../../src/cordova/util');
var path = require('path');
var shell = require('shelljs');
var fs = require('fs');
var config = require('../../../src/cordova/config');
var ConfigParser = require('cordova-common').ConfigParser;

var cfg = new ConfigParser(path.join(__dirname, '..', 'test-config.xml'));
describe('webos project parser', function () {
    var proj = path.join('some', 'path');
    /* eslint-disable no-unused-vars */
    var exists;
    var exec;
    var custom;
    /* eslint-enable no-unused-vars */
    beforeEach(function () {
        exists = spyOn(fs, 'existsSync').and.returnValue(true);
        exec = spyOn(shell, 'exec').and.callFake(function (cmd, opts, cb) {
            cb(0, ''); // eslint-disable-line standard/no-callback-literal
        });
        custom = spyOn(config, 'has_custom_path').and.returnValue(false);
    });

    describe('constructions', function () {
        it('should create an instance with a path', function () {
            expect(function () {
                var p = new webosParser(proj); // eslint-disable-line new-cap
                expect(p.path).toEqual(proj);
            }).not.toThrow();
        });
    });

    describe('instance', function () {
        /* eslint-disable no-unused-vars */
        var p;
        var cp;
        var rm;
        var is_cordova;
        var write;
        var read;
        /* eslint-enable no-unused-vars */
        var wos_proj = path.join(proj, 'platforms', 'webos');
        beforeEach(function () {
            p = new webosParser(wos_proj); // eslint-disable-line new-cap
            cp = spyOn(shell, 'cp');
            rm = spyOn(shell, 'rm');
            is_cordova = spyOn(util, 'isCordova').and.returnValue(proj);
            write = spyOn(fs, 'writeFileSync');
            read = spyOn(fs, 'readFileSync').and.returnValue('');
        });

        describe('update_from_config method', function () {
            beforeEach(function () {
                cfg.name = function () { return 'testname'; };
                cfg.packageName = function () { return 'testpkg'; };
                cfg.version = function () { return '1.0'; };
            });

            /*  it('should write appinfo.json', function() {
                //p.update_from_config(cfg);
                //expect(write.mostRecentCall.args[0]).toEqual('appinfo.json');
            }); */
        });
    });
});
