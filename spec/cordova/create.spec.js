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

var fs = require('fs-extra');
var helpers = require('../helpers');
var path = require('path');
var events = require('cordova-common').events;
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

describe('create basic test (see more in cordova-create)', function () {
    beforeEach(function () {
        fs.emptyDirSync(tmpDir);
    });

    afterEach(function () {
        process.chdir(path.join(__dirname, '..')); // Needed to rm the dir on Windows.
        fs.removeSync(tmpDir);
    });

    it('Test 003 : should successfully run', function () {
        return cordova.create(project, appId, appName, configBasic, events);
    });

});
