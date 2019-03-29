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

var fs = require('fs-extra');
var pluginAdd = require('../src/cordova/plugin/add');
var helpers = require('../spec/helpers');
var path = require('path');
var events = require('cordova-common').events;

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

function getFetchVersion (plugin) {
    return pluginAdd.getFetchVersion(project, plugin, cordovaVersion);
}

var warnings = [];

// Used to extract the constraint, the installed version, and the required
// semver range from a warning message
var UNMET_REQ_REGEX = /\s+([^\s]+)[^\d]+(\d+\.\d+\.\d+) in project, (.+) required\)/;

// We generate warnings when we don't fetch latest. Collect them to make sure we
// are making the correct warnings
events.on('warn', function (warning) {
    warnings.push(warning);
});

// Checks the warnings that were printed by the CLI to ensure that the code is
// listing the correct reasons for failure. Checks against the global warnings
// object which is reset before each test
function expectUnmetRequirements (requirements) {
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

    expect(reqWarnings).toEqual(jasmine.arrayWithExactContents(requirements));
}

// Helper functions for creating the requirements objects taken by
// expectUnmetRequirements()
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

describe('plugin fetching version selection', function () {
    beforeAll(() => {
        const fixtures = path.join(__dirname, '../spec/cordova/fixtures');

        // Copy the base project as our test project
        fs.copySync(path.join(fixtures, 'base'), project);

        // Copy a platform and a plugin to our test project
        fs.copySync(
            path.join(fixtures, 'platforms', helpers.testPlatform),
            path.join(project, 'platforms', helpers.testPlatform));
        fs.copySync(
            path.join(fixtures, 'plugins/android'),
            path.join(project, 'plugins/android'));
    });

    afterAll(() => {
        process.chdir(__dirname);
        fs.removeSync(tempDir);
    });

    let testPlugin;
    beforeEach(function () {
        warnings = [];

        testPlugin = {
            'version': '2.3.0',
            'name': 'test-plugin',
            'engines': { 'cordovaDependencies': {} },
            'versions': testPluginVersions
        };
    });

    it('Test 001 : should handle a mix of upper bounds and single versions', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.0': { 'cordova-android': '1.0.0' },
            '0.0.2': { 'cordova-android': '>1.0.0' },
            '<1.0.0': { 'cordova-android': '<2.0.0' },
            '1.0.0': { 'cordova-android': '>2.0.0' },
            '1.7.0': { 'cordova-android': '>4.0.0' },
            '<2.3.0': { 'cordova-android': '<6.1.1' },
            '2.3.0': { 'cordova-android': '6.1.1' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.3.0');
            expectUnmetRequirements([ getPlatformRequirement('6.1.1') ]);
        });
    });

    it('Test 002 : should apply upper bound engine constraints when there are no unspecified constraints above the upper bound', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.0.0': { 'cordova-android': '>2.0.0' },
            '1.7.0': { 'cordova-android': '>4.0.0' },
            '<2.3.0': {
                'cordova-android': '<6.1.1',
                'ca.filmaj.AndroidPlugin': '<1.0.0'
            },
            '2.3.0': { 'cordova-android': '6.1.1' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe(null);
            expectUnmetRequirements([ getPlatformRequirement('6.1.1') ]);
        });
    });

    it('Test 003 : should apply upper bound engine constraints when there are unspecified constraints above the upper bound', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.0': {},
            '2.0.0': { 'cordova-android': '~5.0.0' },
            '<1.0.0': { 'cordova-android': '>5.0.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.7.1');
            expectUnmetRequirements([ getPlatformRequirement('~5.0.0') ]);
        });
    });

    it('Test 004 : should handle the case where there are no constraints for earliest releases', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.0.0': { 'cordova-android': '~5.0.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('0.7.0');
            expectUnmetRequirements([ getPlatformRequirement('~5.0.0') ]);
        });
    });

    it('Test 005 : should handle the case where the lowest version is unsatisfied', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.2': { 'cordova-android': '~5.0.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe(null);
            expectUnmetRequirements([ getPlatformRequirement('~5.0.0') ]);
        });
    });

    it('Test 006 : should handle upperbounds if no single version constraints are given', function () {
        testPlugin.engines.cordovaDependencies = {
            '<1.0.0': { 'cordova-android': '<2.0.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('2.3.0');
            expectUnmetRequirements([]);
        });
    });

    it('Test 007 : should apply upper bounds greater than highest version', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.0': {},
            '<5.0.0': { 'cordova-android': '<2.0.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe(null);
            expectUnmetRequirements([ getPlatformRequirement('<2.0.0') ]);
        });
    });

    it('Test 008 : should treat empty constraints as satisfied', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.0.0': {},
            '1.1.0': { 'cordova-android': '>5.0.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.0.0');
            expectUnmetRequirements([ getPlatformRequirement('>5.0.0') ]);
        });
    });

    it('Test 009 : should ignore an empty cordovaDependencies entry', function () {
        testPlugin.engines.cordovaDependencies = {};

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe(null);
            expectUnmetRequirements([]);
        });
    });

    it('Test 010 : should ignore a badly formatted semver range', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.1.3': { 'cordova-android': 'badSemverRange' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('2.3.0');
            expectUnmetRequirements([]);
        });
    });

    it('Test 011 : should respect unreleased versions in constraints', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.0.0': { 'cordova-android': '3.1.0' },
            '1.1.2': { 'cordova-android': '6.1.1' },
            '1.3.0': { 'cordova-android': '6.1.1' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.1.0');
            expectUnmetRequirements([ getPlatformRequirement('6.1.1') ]);
        });
    });

    it('Test 012 : should respect plugin constraints', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.0': { 'ca.filmaj.AndroidPlugin': '1.2.0' },
            '1.1.3': { 'ca.filmaj.AndroidPlugin': '<5.0.0 || >2.3.0' },
            '2.3.0': { 'ca.filmaj.AndroidPlugin': '6.1.1' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('2.0.0');
            expectUnmetRequirements([ getPluginRequirement('6.1.1') ]);
        });
    });

    it('Test 013 : should respect cordova constraints', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.0': { 'cordova': '>1.0.0' },
            '1.1.3': { 'cordova': '<3.0.0 || >4.0.0' },
            '2.3.0': { 'cordova': '6.1.1' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.1.0');
            expectUnmetRequirements([ getCordovaRequirement('6.1.1') ]);
        });
    });

    it('Test 014 : should not include pre-release versions', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.0': {},
            '2.0.0': { 'cordova-android': '>5.0.0' }
        };

        // Should not return 2.0.0-rc.2
        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.7.1');
            expectUnmetRequirements([ getPlatformRequirement('>5.0.0') ]);
        });
    });

    it('Test 015 : should not fail if there is no engine in the npm info', function () {
        return pluginAdd.getFetchVersion(project, {
            version: '2.3.0',
            name: 'test-plugin',
            versions: testPluginVersions
        }, cordovaVersion)
            .then(function (toFetch) {
                expect(toFetch).toBe(null);
            });
    });

    it('Test 016 : should not fail if there is no cordovaDependencies in the engines', function () {

        return pluginAdd.getFetchVersion(project, {
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
                expectUnmetRequirements([]);
            });
    });

    it('Test 017 : should handle extra whitespace', function () {
        testPlugin.engines.cordovaDependencies = {
            '  1.0.0    ': {},
            '2.0.0   ': { ' cordova-android': '~5.0.0   ' },
            ' <  1.0.0\t': { ' cordova-android  ': ' > 5.0.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.7.1');
            expectUnmetRequirements([ getPlatformRequirement('~5.0.0') ]);
        });
    });

    it('Test 018 : should ignore badly typed version requirement entries', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.1.0': ['cordova', '5.0.0'],
            '1.3.0': undefined,
            '1.7.0': null
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('2.3.0');
            expectUnmetRequirements([]);
        });
    });

    it('Test 019 : should ignore badly typed constraint entries', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.2': { 'cordova': 1 },
            '0.7.0': { 'cordova': {} },
            '1.0.0': { 'cordova': undefined },
            '1.1.3': { 8: '5.0.0' },
            '1.3.0': { 'cordova': [] },
            '1.7.1': { 'cordova': null }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('2.3.0');
            expectUnmetRequirements([]);
        });
    });

    it('Test 020 : should ignore bad semver versions', function () {
        testPlugin.engines.cordovaDependencies = {
            '0.0.0': { 'cordova-android': '5.0.0' },
            'notAVersion': { 'cordova-android': '3.1.0' },
            '^1.1.2': { 'cordova-android': '3.1.0' },
            '<=1.3.0': { 'cordova-android': '3.1.0' },
            '1.0': { 'cordova-android': '3.1.0' },
            '2': { 'cordova-android': '3.1.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe(null);
            expectUnmetRequirements([ getPlatformRequirement('5.0.0') ]);
        });
    });

    it('Test 021 : should not fail if there are bad semver versions', function () {
        testPlugin.engines.cordovaDependencies = {
            'notAVersion': { 'cordova-android': '3.1.0' },
            '^1.1.2': { 'cordova-android': '3.1.0' },
            '<=1.3.0': { 'cordova-android': '3.1.0' },
            '1.0.0': { 'cordova-android': '~3' }, // Good semver
            '2.0.0': { 'cordova-android': '5.1.0' }, // Good semver
            '1.0': { 'cordova-android': '3.1.0' },
            '2': { 'cordova-android': '3.1.0' }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.7.1');
            expectUnmetRequirements([ getPlatformRequirement('5.1.0') ]);
        });
    });

    it('Test 022 : should properly warn about multiple unmet requirements', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.7.0': {
                'cordova-android': '>5.1.0',
                'ca.filmaj.AndroidPlugin': '3.1.0',
                'cordova': '3.4.2'
            }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.3.0');
            expectUnmetRequirements([
                getPlatformRequirement('>5.1.0'),
                getPluginRequirement('3.1.0')
            ]);
        });
    });

    it('Test 023 : should properly warn about both unmet latest and upper bound requirements', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.7.0': { 'cordova-android': '>5.1.0' },
            '<5.0.0': {
                'cordova-android': '>7.1.0',
                'ca.filmaj.AndroidPlugin': '3.1.0'
            }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe(null);
            expectUnmetRequirements([
                getPlatformRequirement('>5.1.0 AND >7.1.0'),
                getPluginRequirement('3.1.0')
            ]);
        });
    });

    it('Test 024 : should not warn about versions past latest', function () {
        testPlugin.engines.cordovaDependencies = {
            '1.7.0': { 'cordova-android': '>5.1.0' },
            '7.0.0': {
                'cordova-android': '>7.1.0',
                'ca.filmaj.AndroidPlugin': '3.1.0'
            }
        };

        return getFetchVersion(testPlugin).then(version => {
            expect(version).toBe('1.3.0');
            expectUnmetRequirements([ getPlatformRequirement('>5.1.0') ]);
        });
    });
});
