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

var plugin  = require('../src/cordova/plugin'),
    helpers = require('./helpers'),
    path    = require('path'),
    shell   = require('shelljs');

var testPluginVersions = [
    '0.0.0',
    '0.0.2',
    '0.7.0',
    '1.0.0',
    '1.1.0',
    '1.1.3',
    '1.3.0',
    '1.7.0',
    '1.7.1',
    '2.0.0-rc.1',
    '2.0.0-rc.2',
    '2.0.0',
    '2.3.0'
];

var cordovaVersion = '3.4.2';

var tempDir = helpers.tmpDir('plugin_fetch_spec');
var project = path.join(tempDir, 'project');

var getVersionErrorCallback;

function testEngineWithProject(done, testEngine, testResult) {
    plugin.getFetchVersion(project,
        {
            'engines': { 'cordovaDependencies': testEngine },
            'versions': testPluginVersions
        }, cordovaVersion)
    .then(function(toFetch) {
        expect(toFetch).toBe(testResult);
    })
    .fail(getVersionErrorCallback)
    .fin(done);
}

function createTestProject() {
    // Get the base project
    shell.cp('-R', path.join(__dirname, 'fixtures', 'base'), tempDir);
    shell.mv(path.join(tempDir, 'base'), project);

    // Copy a platform and a plugin to our sample project
    shell.cp('-R',
        path.join(__dirname, 'fixtures', 'platforms', helpers.testPlatform),
        path.join(project, 'platforms'));
    shell.cp('-R',
        path.join(__dirname, 'fixtures', 'plugins', 'android'),
        path.join(project, 'plugins'));
}

function removeTestProject() {
    shell.rm('-rf', tempDir);
}

describe('plugin fetching version selection', function(done) {
    createTestProject();

    beforeEach(function() {
        getVersionErrorCallback = jasmine.createSpy('unexpectedPluginFetchErrorCallback');
    });

    afterEach(function() {
        expect(getVersionErrorCallback).not.toHaveBeenCalled();
    });

    it('should properly handle a mix of upper bounds and single versions', function() {
        var testEngine = {
            '0.0.0' : { 'cordova-android': '1.0.0' },
            '0.0.2' : { 'cordova-android': '>1.0.0' },
            '<1.0.0': { 'cordova-android': '<2.0.0' },
            '1.0.0' : { 'cordova-android': '>2.0.0' },
            '1.7.0' : { 'cordova-android': '>4.0.0' },
            '<2.3.0': { 'cordova-android': '<6.0.0' },
            '2.3.0' : { 'cordova-android': '6.0.0' }
        };

        testEngineWithProject(done, testEngine, '1.3.0');
    });

    it('should properly apply upper bound engine constraints', function(done) {
        var testEngine = {
            '1.0.0' : { 'cordova-android': '>2.0.0' },
            '1.7.0' : { 'cordova-android': '>4.0.0' },
            '<2.3.0': {
                'cordova-android': '<6.0.0',
                'ca.filmaj.AndroidPlugin': '<1.0.0'
            },
            '2.3.0' : { 'cordova-android': '6.0.0' }
        };

        testEngineWithProject(done, testEngine, null);
    });

    it('should ignore upperbounds if no version constraints are given', function(done) {
        var testEngine = {
            '<1.0.0': { 'cordova-android': '<2.0.0' }
        };

        testEngineWithProject(done, testEngine, null);
    });

    it('should apply upper bounds greater than highest version', function(done) {
        var testEngine = {
            '0.0.0' : {},
            '<5.0.0': { 'cordova-android': '<2.0.0' }
        };

        testEngineWithProject(done, testEngine, null);
    });

    it('should treat empty constraints as satisfied', function(done) {
        var testEngine = {
            '1.0.0' : {},
            '1.1.0' : { 'cordova-android': '>5.0.0' }
        };

        testEngineWithProject(done, testEngine, '1.0.0');
    });

    it('should treat an empty engine as not satisfied', function(done) {
        var testEngine = {};

        testEngineWithProject(done, testEngine, null);
    });

    it('should treat a badly formatted semver range as not satisfied', function(done) {
        var testEngine = {
            '1.1.3' : { 'cordova-android': 'badSemverRange' }
        };

        testEngineWithProject(done, testEngine, null);
    });

    it('should respect unreleased versions in constraints', function(done) {
        var testEngine = {
            '1.0.0' : { 'cordova-android': '3.1.0' },
            '1.1.2' : { 'cordova-android': '6.0.0' },
            '1.3.0' : { 'cordova-android': '6.0.0' }
        };

        testEngineWithProject(done, testEngine, '1.1.0');
    });

    it('should respect plugin constraints', function(done) {
        var testEngine = {
            '0.0.0' : { 'ca.filmaj.AndroidPlugin': '1.2.0' },
            '1.1.3' : { 'ca.filmaj.AndroidPlugin': '<5.0.0 || >2.3.0' },
            '2.3.0' : { 'ca.filmaj.AndroidPlugin': '6.0.0' }
        };

        testEngineWithProject(done, testEngine, '2.0.0');
    });

    it('should respect cordova constraints', function(done) {
        var testEngine = {
            '0.0.0' : { 'cordova': '>1.0.0' },
            '1.1.3' : { 'cordova': '<3.0.0 || >4.0.0' },
            '2.3.0' : { 'cordova': '6.0.0' }
        };

        testEngineWithProject(done, testEngine, '1.1.0');
    });

    it('should not include pre-release versions', function(done) {
        var testEngine = {
            '0.0.0' : {},
            '2.0.0' : { 'cordova-android': '>5.0.0' }
        };

        // Should not return 2.0.0-rc.2
        testEngineWithProject(done, testEngine, '1.7.1');
    });

    it('should not fail if there is no engine in the npm info', function(done) {
        plugin.getFetchVersion(project, { versions: testPluginVersions }, cordovaVersion)
        .then(function(toFetch) {
            expect(toFetch).toBe(null);
        })
        .fail(function(err) {
            console.log(err);
            expect(true).toBe(false);
        }).fin(done);
    });

    it('clean up after plugin fetch spec', function() {
        removeTestProject();
    });
});
