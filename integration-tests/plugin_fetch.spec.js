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

// TODO: all of these tests should go as unit tests to src/cordova/plugin/add

var plugin = require('../src/cordova/plugin/add');
var helpers = require('../spec/helpers');
var path = require('path');
var events = require('cordova-common').events;
var shell = require('shelljs');

var testPluginVersions = [
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
var warnings = [];

// Used to extract the constraint, the installed version, and the required
// semver range from a warning message
var UNMET_REQ_REGEX = /\s+([^\s]+)[^\d]+(\d+\.\d+\.\d+) in project, (.+) required\)/;

// We generate warnings when we don't fetch latest. Collect them to make sure we
// are making the correct warnings
events.on('warn', function (warning) {
    warnings.push(warning);
});

// Tests a sample engine against the installed platforms/plugins in our test
// project
function testEngineWithProject (done, testEngine, testResult) {
    plugin.getFetchVersion(project,
        {
            'version': '2.3.0',
            'name': 'test-plugin',
            'engines': { 'cordovaDependencies': testEngine },
            'versions': testPluginVersions
        }, cordovaVersion)
        .then(function (toFetch) {
            expect(toFetch).toBe(testResult);
        })
        .fail(getVersionErrorCallback)
        .fin(done);
}

// Checks the warnings that were printed by the CLI to ensure that the code is
// listing the correct reasons for failure. Checks against the global warnings
// object which is reset before each test
function checkUnmetRequirements (requirements) {
    var reqWarnings = [];

    warnings.forEach(function (warning) {
        var extracted = UNMET_REQ_REGEX.exec(warning);
        if (extracted) {
            reqWarnings.push({
                dependency: extracted[1],
                installed: extracted[2],
                required: extracted[3]
            });
        }
    });
    expect(reqWarnings.length).toEqual(requirements.length);

    requirements.forEach(function (requirement) {
        expect(reqWarnings).toContainArray(function (extractedWarning) {
            return extractedWarning.dependency === requirement.dependency.trim() &&
                    extractedWarning.installed === requirement.installed.trim() &&
                    extractedWarning.required === requirement.required.trim();
        }, requirement);
    });
}

// Helper functions for creating the requirements objects taken by
// checkUnmetRequirements()
function getPlatformRequirement (requirement) {
    return {
        dependency: 'cordova-android',
        installed: '3.1.0',
        required: requirement
    };
}

function getCordovaRequirement (requirement) {
    return {
        dependency: 'cordova',
        installed: cordovaVersion,
        required: requirement
    };
}

function getPluginRequirement (requirement) {
    return {
        dependency: 'ca.filmaj.AndroidPlugin',
        installed: '4.2.0',
        required: requirement
    };
}

// Generates a callback that checks warning messages after the test is complete
function getWarningCheckCallback (done, requirements) {
    return function () {
        checkUnmetRequirements(requirements);
        expect(getVersionErrorCallback).not.toHaveBeenCalled();
        done();
    };
}
var fixtures = path.join(__dirname, '..', 'spec', 'cordova', 'fixtures');

function createTestProject () {
    // Get the base project
    shell.cp('-R', path.join(fixtures, 'base'), tempDir);
    shell.mv(path.join(tempDir, 'base'), project);

    // Copy a platform and a plugin to our sample project
    shell.cp('-R',
        path.join(fixtures, 'platforms', helpers.testPlatform),
        path.join(project, 'platforms'));
    shell.cp('-R',
        path.join(fixtures, 'plugins', 'android'),
        path.join(project, 'plugins'));
}

function removeTestProject () {
    shell.rm('-rf', tempDir);
}

describe('plugin fetching version selection', function () {
    createTestProject();
    beforeEach(function () {
        jasmine.addMatchers({
            'toContainArray': function () {
                return {
                    compare: function (actual, expected) {
                        var result = {};
                        result.pass = false;
                        for (var i = 0; i < actual.length; i++) {
                            if (expected(actual[i])) {
                                result.pass = true;
                                break;
                            }
                        }
                        return result;
                    }
                };
            }
        });

        warnings = [];
        getVersionErrorCallback = jasmine.createSpy('unexpectedPluginFetchErrorCallback');
    });

    it('Test 001 : should handle a mix of upper bounds and single versions', function (done) {
        var testEngine = {
            '0.0.0': { 'cordova-android': '1.0.0' },
            '0.0.2': { 'cordova-android': '>1.0.0' },
            '<1.0.0': { 'cordova-android': '<2.0.0' },
            '1.0.0': { 'cordova-android': '>2.0.0' },
            '1.7.0': { 'cordova-android': '>4.0.0' },
            '<2.3.0': { 'cordova-android': '<6.1.1' },
            '2.3.0': { 'cordova-android': '6.1.1' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('6.1.1')
        ]);
        testEngineWithProject(after, testEngine, '1.3.0');
    }, 6000);

    it('Test 002 : should apply upper bound engine constraints when there are no unspecified constraints above the upper bound', function (done) {
        var testEngine = {
            '1.0.0': { 'cordova-android': '>2.0.0' },
            '1.7.0': { 'cordova-android': '>4.0.0' },
            '<2.3.0': {
                'cordova-android': '<6.1.1',
                'ca.filmaj.AndroidPlugin': '<1.0.0'
            },
            '2.3.0': { 'cordova-android': '6.1.1' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('6.1.1')
        ]);
        testEngineWithProject(after, testEngine, null);
    });

    it('Test 003 : should apply upper bound engine constraints when there are unspecified constraints above the upper bound', function (done) {
        var testEngine = {
            '0.0.0': {},
            '2.0.0': { 'cordova-android': '~5.0.0' },
            '<1.0.0': { 'cordova-android': '>5.0.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('~5.0.0')
        ]);
        testEngineWithProject(after, testEngine, '1.7.1');

    });

    it('Test 004 : should handle the case where there are no constraints for earliest releases', function (done) {
        var testEngine = {
            '1.0.0': { 'cordova-android': '~5.0.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('~5.0.0')
        ]);
        testEngineWithProject(after, testEngine, '0.7.0');

    });

    it('Test 005 : should handle the case where the lowest version is unsatisfied', function (done) {
        var testEngine = {
            '0.0.2': { 'cordova-android': '~5.0.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('~5.0.0')
        ]);
        testEngineWithProject(after, testEngine, null);

    });

    it('Test 006 : should handle upperbounds if no single version constraints are given', function (done) {
        var testEngine = {
            '<1.0.0': { 'cordova-android': '<2.0.0' }
        };

        var after = getWarningCheckCallback(done, []);

        testEngineWithProject(after, testEngine, '2.3.0');

    });

    it('Test 007 : should apply upper bounds greater than highest version', function (done) {
        var testEngine = {
            '0.0.0': {},
            '<5.0.0': { 'cordova-android': '<2.0.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('<2.0.0')
        ]);

        testEngineWithProject(after, testEngine, null);

    });

    it('Test 008 : should treat empty constraints as satisfied', function (done) {
        var testEngine = {
            '1.0.0': {},
            '1.1.0': { 'cordova-android': '>5.0.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('>5.0.0')
        ]);

        testEngineWithProject(after, testEngine, '1.0.0');

    });

    it('Test 009 : should ignore an empty cordovaDependencies entry', function (done) {
        var testEngine = {};

        var after = getWarningCheckCallback(done, []);

        testEngineWithProject(after, testEngine, null);

    });

    it('Test 010 : should ignore a badly formatted semver range', function (done) {
        var testEngine = {
            '1.1.3': { 'cordova-android': 'badSemverRange' }
        };

        var after = getWarningCheckCallback(done, []);

        testEngineWithProject(after, testEngine, '2.3.0');

    });

    it('Test 011 : should respect unreleased versions in constraints', function (done) {
        var testEngine = {
            '1.0.0': { 'cordova-android': '3.1.0' },
            '1.1.2': { 'cordova-android': '6.1.1' },
            '1.3.0': { 'cordova-android': '6.1.1' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('6.1.1')
        ]);

        testEngineWithProject(after, testEngine, '1.1.0');

    });

    it('Test 012 : should respect plugin constraints', function (done) {
        var testEngine = {
            '0.0.0': { 'ca.filmaj.AndroidPlugin': '1.2.0' },
            '1.1.3': { 'ca.filmaj.AndroidPlugin': '<5.0.0 || >2.3.0' },
            '2.3.0': { 'ca.filmaj.AndroidPlugin': '6.1.1' }
        };

        var after = getWarningCheckCallback(done, [
            getPluginRequirement('6.1.1')
        ]);

        testEngineWithProject(after, testEngine, '2.0.0');

    });

    it('Test 013 : should respect cordova constraints', function (done) {
        var testEngine = {
            '0.0.0': { 'cordova': '>1.0.0' },
            '1.1.3': { 'cordova': '<3.0.0 || >4.0.0' },
            '2.3.0': { 'cordova': '6.1.1' }
        };

        var after = getWarningCheckCallback(done, [
            getCordovaRequirement('6.1.1')
        ]);

        testEngineWithProject(after, testEngine, '1.1.0');

    });

    it('Test 014 : should not include pre-release versions', function (done) {
        var testEngine = {
            '0.0.0': {},
            '2.0.0': { 'cordova-android': '>5.0.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('>5.0.0')
        ]);

        // Should not return 2.0.0-rc.2
        testEngineWithProject(after, testEngine, '1.7.1');

    });

    it('Test 015 : should not fail if there is no engine in the npm info', function (done) {
        plugin.getFetchVersion(project, {
            version: '2.3.0',
            name: 'test-plugin',
            versions: testPluginVersions
        }, cordovaVersion)
            .then(function (toFetch) {
                expect(toFetch).toBe(null);
            })
            .fail(getVersionErrorCallback).fin(done);
    });

    it('Test 016 : should not fail if there is no cordovaDependencies in the engines', function (done) {
        var after = getWarningCheckCallback(done, []);

        plugin.getFetchVersion(project, {
            version: '2.3.0',
            name: 'test-plugin',
            versions: testPluginVersions,
            engines: {
                'node': '>7.0.0',
                'npm': '~2.0.0'
            }
        }, cordovaVersion)
            .then(function (toFetch) {
                expect(toFetch).toBe(null);
            })
            .fail(getVersionErrorCallback).fin(after);

    });

    it('Test 017 : should handle extra whitespace', function (done) {
        var testEngine = {
            '  1.0.0    ': {},
            '2.0.0   ': { ' cordova-android': '~5.0.0   ' },
            ' <  1.0.0\t': { ' cordova-android  ': ' > 5.0.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('~5.0.0')
        ]);

        testEngineWithProject(after, testEngine, '1.7.1');

    });

    it('Test 018 : should ignore badly typed version requirement entries', function (done) {
        var testEngine = {
            '1.1.0': ['cordova', '5.0.0'],
            '1.3.0': undefined,
            '1.7.0': null
        };

        var after = getWarningCheckCallback(done, []);

        testEngineWithProject(after, testEngine, '2.3.0');

    });

    it('Test 019 : should ignore badly typed constraint entries', function (done) {
        var testEngine = {
            '0.0.2': { 'cordova': 1 },
            '0.7.0': { 'cordova': {} },
            '1.0.0': { 'cordova': undefined },
            '1.1.3': { 8: '5.0.0' },
            '1.3.0': { 'cordova': [] },
            '1.7.1': { 'cordova': null }
        };

        var after = getWarningCheckCallback(done, []);

        testEngineWithProject(after, testEngine, '2.3.0');

    });

    it('Test 020 : should ignore bad semver versions', function (done) {
        var testEngine = {
            '0.0.0': { 'cordova-android': '5.0.0' },
            'notAVersion': { 'cordova-android': '3.1.0' },
            '^1.1.2': { 'cordova-android': '3.1.0' },
            '<=1.3.0': { 'cordova-android': '3.1.0' },
            '1.0': { 'cordova-android': '3.1.0' },
            '2': { 'cordova-android': '3.1.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('5.0.0')
        ]);

        testEngineWithProject(after, testEngine, null);
    });

    it('Test 021 : should not fail if there are bad semver versions', function (done) {
        var testEngine = {
            'notAVersion': { 'cordova-android': '3.1.0' },
            '^1.1.2': { 'cordova-android': '3.1.0' },
            '<=1.3.0': { 'cordova-android': '3.1.0' },
            '1.0.0': { 'cordova-android': '~3' }, // Good semver
            '2.0.0': { 'cordova-android': '5.1.0' }, // Good semver
            '1.0': { 'cordova-android': '3.1.0' },
            '2': { 'cordova-android': '3.1.0' }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('5.1.0')
        ]);

        testEngineWithProject(after, testEngine, '1.7.1');
    });

    it('Test 022 : should properly warn about multiple unmet requirements', function (done) {
        var testEngine = {
            '1.7.0': {
                'cordova-android': '>5.1.0',
                'ca.filmaj.AndroidPlugin': '3.1.0',
                'cordova': '3.4.2'
            }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('>5.1.0'),
            getPluginRequirement('3.1.0')
        ]);

        testEngineWithProject(after, testEngine, '1.3.0');
    });

    it('Test 023 : should properly warn about both unmet latest and upper bound requirements', function (done) {
        var testEngine = {
            '1.7.0': { 'cordova-android': '>5.1.0' },
            '<5.0.0': {
                'cordova-android': '>7.1.0',
                'ca.filmaj.AndroidPlugin': '3.1.0'
            }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('>5.1.0 AND >7.1.0'),
            getPluginRequirement('3.1.0')
        ]);

        testEngineWithProject(after, testEngine, null);
    });

    it('Test 024 : should not warn about versions past latest', function (done) {
        var testEngine = {
            '1.7.0': { 'cordova-android': '>5.1.0' },
            '7.0.0': {
                'cordova-android': '>7.1.0',
                'ca.filmaj.AndroidPlugin': '3.1.0'
            }
        };

        var after = getWarningCheckCallback(done, [
            getPlatformRequirement('>5.1.0')
        ]);

        testEngineWithProject(after, testEngine, '1.3.0');
    });

    it('Test 025 : clean up after plugin fetch spec', function () {
        removeTestProject();
    });
});
