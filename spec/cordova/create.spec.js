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

var helpers = require('../helpers');
var path = require('path');
var shell = require('shelljs');
var Q = require('q');
var events = require('cordova-common').events;
var ConfigParser = require('cordova-common').ConfigParser;
var cordova = require('../../src/cordova/cordova');

var tmpDir = helpers.tmpDir('create_test');
var appName = 'TestBase';
var appId = 'org.testing';
var project = path.join(tmpDir, appName);

var configBasic = {
    lib: {
        www: {
            template: false
        }
    }
};

describe('cordova create checks for valid-identifier', function () {
    it('Test 001 : should reject reserved words from start of id', function () {
        return cordova.create('projectPath', 'int.bob', 'appName', {}, events)
            .then(function () {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err.message).toBe('App id contains a reserved word, or is not a valid identifier.');
            });
    });

    it('Test 002 : should reject reserved words from end of id', function () {
        return cordova.create('projectPath', 'bob.class', 'appName', {}, events)
            .then(function () {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err.message).toBe('App id contains a reserved word, or is not a valid identifier.');
            });
    });
});

describe('create basic test (see more in cordova-create)', function () {
    // this.timeout(240000);

    beforeEach(function () {
        shell.rm('-rf', project);
        shell.mkdir('-p', tmpDir);
    });

    afterEach(function () {
        process.chdir(path.join(__dirname, '..')); // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    function checkProject () {
        // Check if top level dirs exist.
        var dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function (d) {
            expect(path.join(project, d)).toExist();
        });

        expect(path.join(project, 'hooks', 'README.md')).toExist();

        // Check if www files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();

        // Check that config.xml was updated.
        var configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);

        // TODO (kamrik): check somehow that we got the right config.xml from the fixture and not some place else.
        // expect(configXml.name()).toEqual('TestBase');
    }

    it('Test 003 : should successfully run', function () {
        return Q()
            .then(function () {
                // Create a real project
                return cordova.create(project, appId, appName, configBasic, events);
            })
            .then(checkProject);
    }, 60000);

});
