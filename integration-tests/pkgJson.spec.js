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
var helpers = require('../spec-cordova/helpers'),
    path = require('path'),
    shell = require('shelljs'),
    events = require('cordova-common').events,
    ConfigParser = require('cordova-common').ConfigParser,
    cordova = require('../src/cordova/cordova'),
    TIMEOUT = 30 * 1000,
    cordova_util = require('../src/cordova/util'),
    semver  = require('semver');

function includeFunc(container, value) {
   var returnValue = false;
   var pos = container.indexOf(value);
   if (pos >= 0) {
       returnValue = true;
   }
   return returnValue;
}
// This group of tests checks if plugins are added and removed as expected from package.json.
describe('plugin end-to-end', function() {
    var pluginId = 'cordova-plugin-device';
    var tmpDir = helpers.tmpDir('plugin_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;
    var testRunRoot = process.cwd();

    events.on('results', function(res) { results = res; });

    beforeEach(function() {
        shell.rm('-rf', project);

        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson'), project);
        // Copy some platform to avoid working on a project with no platforms.
        shell.cp('-R', path.join(__dirname, '..', 'spec-plugman', 'projects', helpers.testPlatform), path.join(project, 'platforms'));
        process.chdir(project);
        delete process.env.PWD;
    });

    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', project);
    });

    it('Test#001 : should successfully add and remove a plugin with save and correct spec', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson = require(pkgJsonPath);
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg = new ConfigParser(configXmlPath);
        var configPlugins = cfg.getPluginIdList();
        var configPlugin = cfg.getPlugin(configPlugins);

        // No plugins in config or pkg.json yet.
        expect(configPlugins.length).toEqual(0);
        expect(pkgJson.cordova).toBeUndefined();
        expect(pkgJsonPath).toExist();

        // Add the plugin with --save.
        return cordova.raw.plugin('add', pluginId+'@1.1.2', {'save':true, 'fetch':true})
        .then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check that the plugin and spec add was successful to pkg.json.
            expect(pkgJson).toBeDefined();
            expect(pkgJson.cordova.plugins).toBeDefined();
            expect(pkgJson.cordova.plugins[pluginId]).toBeDefined();
            expect(pkgJson.dependencies['cordova-plugin-device']).toEqual('^1.1.2');
            // Check that the plugin and spec add was successful to config.xml.
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();
            configPlugin = cfg2.getPlugin(configPlugins);
            expect(configPlugins.length).toEqual(1);
            expect(configPlugin).toEqual({ name: 'cordova-plugin-device', spec: '^1.1.2', variables: {} });
        }).then(function() {
            // And now remove it with --save.
            return cordova.raw.plugin('rm', pluginId, {'save':true, 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Checking that the plugin removed is in not in the pkg.json.
            expect(pkgJson.cordova.plugins[pluginId]).toBeUndefined();
            // Spec should be removed from dependencies.
            expect(pkgJson.dependencies['cordova-plugin-device']).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }, TIMEOUT);

    it('Test#002 : should NOT add a plugin to package.json if --save is not used', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        expect(pkgJsonPath).toExist();

        // Add the geolocation plugin with --save.
        return cordova.raw.plugin('add', 'cordova-plugin-geolocation', {'save':true, 'fetch':true})
        .then(function() {
            // Add a second plugin without save.
            return cordova.raw.plugin('add', pluginId);
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check the plugin add was successful for the first plugin that had --save.
            expect(pkgJson).not.toBeUndefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-geolocation']).toBeDefined();
            // Expect that the second plugin is not added.
            expect(pkgJson.cordova.plugins[pluginId]).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }, TIMEOUT);

    it('Test#003 : should NOT remove plugin from package.json if there is no --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        
        expect(pkgJsonPath).toExist();

        // Add the plugin with --save.
        return cordova.raw.plugin('add', pluginId, {'save':true})
        .then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check the platform add was successful.
            expect(pkgJson).not.toBeUndefined();
            expect(pkgJson.cordova.plugins).toBeDefined();
            expect(pkgJson.cordova.plugins[pluginId]).toBeDefined();
        }).then(function() {
            // And now remove it, but without --save.
            return cordova.raw.plugin('rm', 'cordova-plugin-device');
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // The plugin should still be in package.json.
            expect(pkgJson.cordova.plugins[pluginId]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }, TIMEOUT);

    it('Test#004 : should successfully add and remove a plugin with variables and save to package.json', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        var someKey = 'someKey';

        expect(pkgJsonPath).toExist();

        // Add the plugin with --save.
        return cordova.raw.plugin('add', pluginId, {'save':true, 'cli_variables': {'someKey':'someValue'}})
        .then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check the plugin add was successful and that variables have been added too.
            expect(pkgJson).not.toBeUndefined();
            expect(pkgJson.cordova.plugins).toBeDefined();
            expect(pkgJson.cordova.plugins[pluginId]).toBeDefined();
            expect(pkgJson.cordova.plugins[pluginId][someKey]).toEqual('someValue');
        }).then(function() {
            // And now remove it with --save.
            return cordova.raw.plugin('rm', pluginId, {'save':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Checking that the plugin and variables were removed successfully.
            expect(pkgJson.cordova.plugins[pluginId]).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }, TIMEOUT);

    // CB-12170 : Test is commented out because not promisified correctly in cordova-create script
    xit('Test#005 : should successfully add and remove multiple plugins with save & fetch', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        // Delete any previous caches of require(package.json).
        var pkgJson = cordova_util.requireNoCache(pkgJsonPath);
    
        expect(pkgJsonPath).toExist();

        // Add the plugin with --save.
        return cordova.raw.plugin('add', [pluginId,'cordova-plugin-device-motion'], {'save':true, 'fetch':true})
        .then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check that the plugin add was successful.
            expect(pkgJson).not.toBeUndefined();
            expect(pkgJson.cordova.plugins).not.toBeUndefined();
            expect(pkgJson.cordova.plugins[pluginId]).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-device-motion']).toBeDefined();
            expect(pkgJson.dependencies[pluginId]).toBeDefined();
            expect(pkgJson.dependencies['cordova-plugin-device-motion']).toBeDefined();
        }).then(function() {
            // And now remove it with --save.
            return cordova.raw.plugin('rm', [pluginId,'cordova-plugin-device-motion'], {'save':true, 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Checking that the plugin removed is in not in the platforms.
            expect(pkgJson.cordova.plugins[pluginId]).toBeUndefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-device-motion']).toBeUndefined();
            expect(pkgJson.dependencies[pluginId]).toBeUndefined();
            expect(pkgJson.dependencies['cordova-plugin-device-motion']).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }, TIMEOUT);
    // Test #023 : if pkg.json and config.xml have no platforms/plugins/spec.
    // and --save --fetch is called, use the pinned version or plugin pkg.json version.
    it('Test#023 : use pinned/lastest version if there is no platform/plugin version passed in and no platform/plugin versions in pkg.json or config.xml', function(done) {
        var iosPlatform = 'ios';
        var iosVersion;
        var cwd = process.cwd();
        var iosDirectory = path.join(cwd, 'platforms/ios/cordova/version');
        var iosJsonPath = path.join(cwd, 'platforms/ios/ios.json');
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson = cordova_util.requireNoCache(pkgJsonPath);
        var cfg = new ConfigParser(configXmlPath);
        var engines = cfg.getEngines();
        var engNames;
        var engSpec;
        var configPlugins = cfg.getPluginIdList();
        var configPlugin = cfg.getPlugin(configPlugins);
        var pluginPkgJsonDir = path.join(cwd, 'plugins/cordova-plugin-geolocation/package.json');
        var pluginPkgJsonVersion;

        // Pkg.json has no platform or plugin or specs.
        expect(pkgJson.cordova).toBeUndefined();
        expect(pkgJson.dependencies).toBeUndefined();
        // Config.xml has no platform or plugin or specs.
        expect(engines.length).toEqual(0);
        // Add ios without version.
        return cordova.raw.platform('add', ['ios'], {'save':true, 'fetch':true})
        .then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Pkg.json has ios.
            expect(pkgJson.cordova.platforms).toEqual([iosPlatform]);
            // Config.xml and ios/cordova/version check.
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            // ios platform has been added to config.xml.
            expect(engines.length).toEqual(1);
            // Config.xml has ios platform.
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            expect(engNames).toEqual([ 'ios' ]);
            // delete previous caches of iosVersion;
            iosVersion = cordova_util.requireNoCache(iosDirectory);
            engSpec = engines.map(function(elem) {
                // Check that config and ios/cordova/version versions "satify" each other.
                expect(semver.satisfies(iosVersion.version, elem.spec)).toEqual(true);
            });
        }).then(function() {
            // Add geolocation plugin with --save --fetch.
            return cordova.raw.plugin('add', 'cordova-plugin-geolocation', {'save':true, 'fetch':true});
        }).then(function() {
            var iosJson = cordova_util.requireNoCache(iosJsonPath);
            expect(iosJson.installed_plugins['cordova-plugin-geolocation']).toBeDefined();
            var cfg3 = new ConfigParser(configXmlPath);
            // Check config.xml for plugins and spec.
            configPlugins = cfg3.getPluginIdList();
            configPlugin = cfg3.getPlugin(configPlugins);
            // Delete previous caches of pluginPkgJson.
            pluginPkgJsonVersion = cordova_util.requireNoCache(pluginPkgJsonDir);
            // Check that version in plugin pkg.json and config version "satisfy" each other.
            expect(semver.satisfies(pluginPkgJsonVersion.version, configPlugin.spec)).toEqual(true);
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check that pkg.json and plugin pkg.json versions "satisfy".
            expect(semver.satisfies(pluginPkgJsonVersion.version, pkgJson.dependencies['cordova-ios']));
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },60000);
    
    // Test#025: has a pkg.json. Checks if local path is added to pkg.json for platform and plugin add.
    it('Test#025 : if you add a platform/plugin with local path, pkg.json gets updated', function (done) {

        var cwd = process.cwd();
        var platformPath = path.join(testRunRoot,'spec-cordova/fixtures/platforms/cordova-browser');
        var pluginPath = path.join(testRunRoot,'spec-cordova/fixtures/plugins/cordova-lib-test-plugin');
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson;
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg = new ConfigParser(configXmlPath);
        var engines = cfg.getEngines();
        var engNames;
        var engSpec;

        cordova_util.requireNoCache(pkgJsonPath);
        // Run cordova platform add local path --save --fetch.
        return cordova.raw.platform('add', platformPath, {'save':true, 'fetch':true})
        .then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Pkg.json has browser.
            expect(pkgJson.cordova.platforms).toEqual(['browser']);

            // Check that the value here exists
            expect(pkgJson.dependencies['cordova-browser']).toBeDefined();

            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            // browser platform and spec have been added to config.xml.
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            engSpec = engines.map(function(elem) {  
                if (elem.name === 'browser') {
                    var result = includeFunc(elem.spec , platformPath);
                    expect(result).toEqual(true);
                }
            });
        }).then(function() {
            // Run cordova plugin add local path --save --fetch.
            return cordova.raw.plugin('add', pluginPath, {'save':true, 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Pkg.json has geolocation plugin.
            expect(pkgJson.cordova.plugins['cordova-lib-test-plugin']).toBeDefined();

            // Check that the value here EXISTS
            expect(pkgJson.dependencies['cordova-lib-test-plugin']).toBeDefined();

            var cfg3 = new ConfigParser(configXmlPath);
            engines = cfg3.getEngines();
            // Check that browser and spec have been added to config.xml
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            engSpec = engines.map(function(elem) {  
                if (elem.name === 'browser') {
                    var result = includeFunc(elem.spec , platformPath);
                    expect(result).toEqual(true);
                }
            });
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    },60000);
});

// This group of tests checks if platforms are added and removed as expected from package.json.
describe('platform end-to-end with --save', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);

        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
        // Delete any previous caches of require(package.json).
        cordova_util.requireNoCache(path.join(process.cwd(),'package.json'));
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    // Factoring out some repeated checks.
    function emptyPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms:\n  (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBe(-1);
        });
    }
    function fullPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms:\n  (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
        });
    }

    it('Test#006 : platform is added and removed correctly with --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        expect(pkgJsonPath).toExist();
        var pkgJson;

        // Check there are no platforms yet.
        emptyPlatformList().then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Check the platform add was successful.
            pkgJson = require(pkgJsonPath);
            expect(pkgJson.cordova.platforms).not.toBeUndefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toEqual(0);
        }).then(fullPlatformList) // Platform should still be in platform ls.
        .then(function() {
            // And now remove it with --save.
            return cordova.raw.platform('rm', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Checking that the platform removed is in not in the platforms key.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toEqual(-1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }, TIMEOUT);

    it('Test#007 : should not remove platforms from package.json when removing without --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        expect(pkgJsonPath).toExist();
        var pkgJson = cordova_util.requireNoCache(pkgJsonPath);

        emptyPlatformList().then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Check the platform add was successful.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            expect(pkgJson.cordova.platforms).not.toBeUndefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
        }).then(fullPlatformList) // Platform should still be in platform ls.
        .then(function() {
            // And now remove it without --save.
            return cordova.raw.platform('rm', [helpers.testPlatform]);
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check that the platform removed without --save is still in platforms key.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
        }).then(emptyPlatformList)
        .fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }, TIMEOUT);

    it('Test#008 : should not add platform to package.json when adding without --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        expect(pkgJsonPath).toExist();
        // Delete any previous caches of require(package.json).
        var pkgJson = cordova_util.requireNoCache(pkgJsonPath);
        // Pkg.json "platforms" should be empty and helpers.testPlatform should not exist in pkg.json.
        expect(pkgJson.cordova).toBeUndefined();
        // Add platform without --save.
        cordova.raw.platform('add',[helpers.testPlatform])
        .then(function() {
            // Check the platform add was successful, reload, skipping cache.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // PkgJson.cordova should not be defined and helpers.testPlatform should NOT have been added.
            expect(pkgJson.cordova).toBeUndefined();
        }).then(fullPlatformList)
        .fail(function(err) {
            expect(err).toBeUndefined();
        })
        .fin(done);
    }, TIMEOUT);

    it('Test#009 : should only add the platform to package.json with --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        var platformNotToAdd = 'browser';
        expect(pkgJsonPath).toExist();

        // Add a platform without --save.
        cordova.raw.platform('add',platformNotToAdd)
        .then(function() {
            // And now add another platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Check the platform add was successful, reload, skipping cache.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Beware empty/missing cordova object.
            var pkgJsonCordova = pkgJson.cordova || {platforms:[]};
            // Check that only the platform added with --save was added to package.json.
            expect(pkgJsonCordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            expect(pkgJsonCordova.platforms.indexOf(platformNotToAdd)).toEqual(-1);
        })
        .fail(function(err) {
            expect(err).toBeUndefined();
        })
        .fin(done);
    }, TIMEOUT);

    it('Test#010 : two platforms are added and removed correctly with --save --fetch', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        expect(pkgJsonPath).toExist();
        var pkgJson;
        // Delete any previous caches of require(package.json).
        pkgJson = cordova_util.requireNoCache(pkgJsonPath);
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg = new ConfigParser(configXmlPath);
        var engines = cfg.getEngines();
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();

        // No platforms in config or pkg.json yet.
        expect(pkgJson.cordova).toBeUndefined();
        expect(configEngArray.length === 0);
        // Check there are no platforms yet.
        emptyPlatformList().then(function() {
            // Add the testing platform with --save and add specific version to android platform.
            return cordova.raw.platform('add', ['android@6.1.0', 'browser@4.1.0'], {'save':true, 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check the platform add was successful in platforms list and in dependencies.
            expect(pkgJson.cordova.platforms).toBeDefined();
            expect(pkgJson.cordova.platforms.indexOf('android')).toEqual(0);
            expect(pkgJson.cordova.platforms.indexOf('browser')).toEqual(1);
            expect(pkgJson.dependencies).toBeDefined();
            expect(pkgJson.dependencies['cordova-android']).toBeDefined();
            expect(pkgJson.dependencies['cordova-browser']).toBeDefined();
            // Android platform should have specific version from add.
            expect(pkgJson.dependencies['cordova-android']).toEqual('^6.1.0');

            var cfg3 = new ConfigParser(configXmlPath);
            engines = cfg3.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Check that android and browser were added to config.xml with the correct spec.
            expect(configEngArray.length === 2);
            expect(engines).toEqual([ { name: 'android', spec: '~6.1.0' }, { name: 'browser', spec: '~4.1.0' } ]);

        }).then(fullPlatformList) // Platform should still be in platform ls.
        .then(function() {
            // And now remove it with --save.
            return cordova.raw.platform('rm', ['android', 'browser'], {'save':true, 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Checking that the platform removed is in not in the platforms key.
            expect(pkgJson.cordova.platforms.indexOf('android')).toEqual(-1);
            expect(pkgJson.cordova.platforms.indexOf('browser')).toEqual(-1);
            // Dependencies are removed.
            expect(pkgJson.dependencies['cordova-android']).toBeUndefined();
            expect(pkgJson.dependencies['cordova-browser']).toBeUndefined();
            // Platforms are removed from config.xml.
            var cfg4 = new ConfigParser(configXmlPath);
            engines = cfg4.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Platforms are removed from config.xml.
            expect(configEngArray.length === 0);
        }).then(emptyPlatformList) // platform ls should be empty too.
        .fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }, TIMEOUT);
});

// Test #020 : use basePkgJson15 as pkg.json contains platform/spec and plugin/spec and config.xml does not.
describe('During add, if pkg.json has a platform/plugin spec, use that one.', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);

        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson15'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson15'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
        // Delete any previous caches of require(package.json).
        cordova_util.requireNoCache(path.join(process.cwd(),'package.json'));
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    // Factoring out some repeated checks.
    function emptyPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms:\n  (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBe(-1);
        });
    }

    /** Test#020 will check that pkg.json, config.xml, platforms.json, and cordova platform ls
    *   are updated with the correct (platform and plugin) specs from pkg.json.
    */
    it('Test#020 : During add, if pkg.json has a spec, use that one.', function(done) {
        var iosPlatform = 'ios';
        var iosVersion;
        var cwd = process.cwd();
        var iosDirectory = path.join(cwd, 'platforms/ios/cordova/version');
        var platformsFolderPath = path.join(cwd,'platforms/platforms.json');
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson = cordova_util.requireNoCache(pkgJsonPath);
        var cfg = new ConfigParser(configXmlPath);
        var engines = cfg.getEngines();
        var engNames;
        var engSpec;
        var platformsJson;
        var configPlugins = cfg.getPluginIdList();
        var pluginPkgJsonDir = path.join(cwd, 'plugins/cordova-plugin-splashscreen/package.json');
        var pluginPkgJsonVersion;

        // Pkg.json has ios and spec '^4.2.1' and splashscreen '^3.2.2'.
        expect(pkgJson.cordova.platforms).toEqual([ iosPlatform ]);
        expect(pkgJson.dependencies).toEqual({ 'cordova-plugin-splashscreen' : '^3.2.2', 'cordova-ios' : '^4.2.1' });
        // Config.xml has no platforms or plugins yet.
        expect(engines.length).toEqual(0);
        expect(configPlugins.length).toEqual(0);

        emptyPlatformList().then(function() {
            // Add ios with --save and --fetch.
            return cordova.raw.platform('add', [iosPlatform], {'save':true , 'fetch':true});
        }).then(function() {
            // Require platformsFolderPath, ios and spec should be in there.
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            // Delete any previous caches of require(package.json).
            // ios has been added.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // No change to pkg.json platforms or spec for ios.
            expect(pkgJson.cordova.platforms).toEqual([iosPlatform]);
            // Config.xml and ios/cordova/version check.
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            // ios platform has been added to config.xml.
            expect(engines.length).toEqual(1);
            engNames = engines.map(function(elem) {
                // ios is added to config
                expect(elem.name).toEqual(iosPlatform);
                return elem.name;
            });
            engSpec = engines.map(function(elem) {
                // Check that config and ios/cordova/version versions "satify" each other.
                iosVersion = cordova_util.requireNoCache(iosDirectory);
                expect(semver.satisfies(iosVersion.version, elem.spec)).toEqual(true);
                // Check that config and platforms.json "satisfy".
                expect(semver.satisfies(platformsJson[iosPlatform], elem.spec)).toEqual(true);
            });
            // Config.xml added ios platform.
            expect(engNames).toEqual([ 'ios' ]);
            // Check that pkg.json and ios/cordova/version versions "satisfy" each other.
            expect(semver.satisfies(iosVersion.version, pkgJson.dependencies['cordova-ios'])).toEqual(true);
            // Check that pkg.json and platforms.json "satisfy".
            expect(semver.satisfies(platformsJson[iosPlatform], pkgJson.dependencies['cordova-ios'])).toEqual(true);
        }).then(function() {
            // Add splashscreen plugin with --save --fetch.
            return cordova.raw.plugin('add', 'cordova-plugin-splashscreen', {'save':true, 'fetch':true});
        }).then(function() {
            pluginPkgJsonVersion = cordova_util.requireNoCache(pluginPkgJsonDir);
            // Check that pkg.json version and plugin pkg.json version "satisfy" each other.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            expect(semver.satisfies(pluginPkgJsonVersion.version, pkgJson.dependencies['cordova-plugin-splashscreen'])).toEqual(true);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },60000); 
});

// Test #021 : use basePkgJson16 as config.xml contains platform/spec and plugin/spec pkg.json does not.
describe('During add, if config.xml has a platform/plugin spec and pkg.json does not, use config.', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);

        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson16'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson16'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
        // Delete any previous caches of require(package.json).
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    // Factoring out some repeated checks.
    function emptyPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms:\n  (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBe(-1);
        });
    }

    /** Test#021 during add, this test will check that pkg.json, config.xml, platforms.json, 
    *   and cordova platform ls are updated with the correct platform/plugin spec from config.xml.
    */
    it('Test#021 : If config.xml has a spec (and none was specified and pkg.json does not have one), use config.', function(done) {
        var iosPlatform = 'ios';
        var iosVersion;
        var cwd = process.cwd();
        var iosDirectory = path.join(cwd, 'platforms/ios/cordova/version');
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        var cfg = new ConfigParser(configXmlPath);
        var pkgJson;
        var engines = cfg.getEngines();
        var engNames;
        var engSpec;
        var configPlugins = cfg.getPluginIdList();
        var configPlugin = cfg.getPlugin(configPlugins);
        var pluginPkgJsonDir = path.join(cwd, 'plugins/cordova-plugin-splashscreen/package.json');
        var pluginPkgJsonVersion;

        // Pkg.json does not have platform or spec yet. Config.xml has ios and spec '~4.2.1'.
        // Remove for testing purposes so platform is not pre-installed.
        cordova.raw.platform('rm', [iosPlatform], {'save':true});
        emptyPlatformList().then(function() {
            // Add ios with --save and --fetch.
            return cordova.raw.platform('add', [iosPlatform], {'save':true , 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // pkg.json has new platform.
            expect(pkgJson.cordova.platforms).toEqual([iosPlatform]);
            // Config.xml and ios/cordova/version check.
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            // ios platform is in config.xml.
            expect(engines.length).toEqual(1);
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            // Config.xml has ios platform.
            expect(engNames).toEqual([ 'ios' ]);
            engSpec = engines.map(function(elem) {
                iosVersion = cordova_util.requireNoCache(iosDirectory);
                // Config and ios/cordova/version versions "satisfy" each other.
                expect(semver.satisfies(iosVersion.version, elem.spec)).toEqual(true);
            });
        }).then(function() {
            // Add splashscreen with --save --fetch.
            return cordova.raw.plugin('add', 'cordova-plugin-splashscreen', {'save':true, 'fetch':true});
        }).then(function() {
            var cfg3 = new ConfigParser(configXmlPath);
            // Check config.xml for plugins and spec.
            configPlugins = cfg3.getPluginIdList();
            configPlugin = cfg3.getPlugin(configPlugins);
            expect(configPlugins.length).toEqual(1);
            // Splashscreen plugin and spec added.
            expect(configPlugin.name).toEqual('cordova-plugin-splashscreen');
            pluginPkgJsonVersion = cordova_util.requireNoCache(pluginPkgJsonDir);
            // Check that version in plugin pkg.json and config version "satisfy" each other.
            expect(semver.satisfies(pluginPkgJsonVersion.version, configPlugin.spec)).toEqual(true);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },60000); 
});

// Test #022 : use basePkgJson17 (config.xml and pkg.json each have ios platform with different specs).
describe('During add, if add specifies a platform spec, use that one regardless of what is in pkg.json or config.xml', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson17'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson17'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
        // Delete any previous caches of require(package.json).
        cordova_util.requireNoCache(path.join(process.cwd(),'package.json'));
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    // Factoring out some repeated checks.
    function emptyPlatformList() {
        return cordova.raw.platform('list').then(function() {
            var installed = results.match(/Installed platforms:\n  (.*)/);
            expect(installed).toBeDefined();
            expect(installed[1].indexOf(helpers.testPlatform)).toBe(-1);
        });
    }

    /** Test#022 : when adding with a specific platform version, always use that one
    *   regardless of what is in package.json or config.xml.
    */
    it('Test#022 : when adding with a specific platform version, always use that one.', function(done) {
        var iosPlatform = 'ios';
        var iosVersion;
        var cwd = process.cwd();
        var iosDirectory = path.join(cwd, 'platforms/ios/cordova/version');
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson = cordova_util.requireNoCache(pkgJsonPath);
        var cfg = new ConfigParser(configXmlPath);
        var engines = cfg.getEngines();
        var engNames;
        var configPlugins = cfg.getPluginIdList();
        var configPlugin = cfg.getPlugin(configPlugins);
        var pluginPkgJsonDir = path.join(cwd, 'plugins/cordova-plugin-splashscreen/package.json');
        var pluginPkgJsonVersion;

        // Pkg.json has ios and spec '^4.2.1'.
        expect(pkgJson.cordova.platforms).toEqual([ iosPlatform ]);
        expect(pkgJson.dependencies).toEqual({ 'cordova-ios' : '^4.2.1', 'cordova-plugin-splashscreen' : '~3.2.2' });
        // Config.xml has ios and spec ~4.2.1.
        expect(engines.length).toEqual(1);
        expect(engines).toEqual([ { name: 'ios', spec: '~4.2.1' } ]);
        emptyPlatformList().then(function() {
            // Add ios with --save and --fetch.
            return cordova.raw.platform('add', ['ios@4.3.0'], {'save':true , 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Pkg.json has ios.
            expect(pkgJson.cordova.platforms).toEqual([iosPlatform]);
            // Config.xml and ios/cordova/version check.
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            // ios platform has been added to config.xml.
            expect(engines.length).toEqual(1);
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            // Config.xml has ios platform.
            expect(engNames).toEqual([ 'ios' ]);
            // delete previous caches of iosVersion;
            iosVersion = cordova_util.requireNoCache(iosDirectory);
            // Check that pkg.json and ios/cordova/version versions "satisfy" each other.
            expect(semver.satisfies(iosVersion.version, pkgJson.dependencies['cordova-ios'])).toEqual(true);
        }).then(function() {
            // Add splashscreen with --save --fetch.
            return cordova.raw.plugin('add', 'cordova-plugin-splashscreen@4.0.0', {'save':true, 'fetch':true});
        }).then(function() {
            var cfg3 = new ConfigParser(configXmlPath);
            // Check config.xml for plugins and spec.
            configPlugins = cfg3.getPluginIdList();

            configPlugin = cfg3.getPlugin(configPlugins);
            // Delete previous caches of pluginPkgJson.
            pluginPkgJsonVersion = cordova_util.requireNoCache(pluginPkgJsonDir);
            // Check that version in plugin pkg.json and config version "satisfy" each other.
            expect(semver.satisfies(pluginPkgJsonVersion.version, configPlugin.spec)).toEqual(true);
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check that pkg.json and plugin pkg.json versions "satisfy".
            expect(semver.satisfies(pluginPkgJsonVersion.version, pkgJson.dependencies['cordova-ios']));
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },60000); 
});

// No pkg.json included in test file.
describe('local path is added to config.xml without pkg.json', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;
    var testRunRoot = process.cwd();


    beforeEach(function() {
        shell.rm('-rf', tmpDir);

        // cp then mv because we need to copy everything, but that means it'll copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson13'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson13'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    // Test#026: has NO pkg.json. Checks if local path is added to config.xml and has no errors.
    it('Test#026 : if you add a platform with local path, config.xml gets updated', function (done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg = new ConfigParser(configXmlPath);
        var engines = cfg.getEngines();
        var engNames;
        var engSpec;
        var platformPath = path.join(testRunRoot,'spec-cordova/fixtures/platforms/cordova-browser');

        // Run cordova platform add local path --save --fetch.
        return cordova.raw.platform('add', platformPath, {'save':true, 'fetch':true})
        .then(function() {
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            // ios platform and spec have been added to config.xml.
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            engSpec = engines.map(function(elem) {  
                if (elem.name === 'browser') {
                    var result = includeFunc(elem.spec , platformPath);
                    expect(result).toEqual(true);
                }
            });
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    },60000);

    // Test#027: has NO pkg.json. Checks if local path is added to config.xml and has no errors.
    it('Test#027 : if you add a plugin with local path, config.xml gets updated', function (done) {
        var cwd = process.cwd();
        var pluginPath = path.join(testRunRoot,'spec-cordova/fixtures/plugins/cordova-lib-test-plugin');
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg = new ConfigParser(configXmlPath);
        var configPlugins = cfg.getPluginIdList();
        var configPlugin = cfg.getPlugin(configPlugins);
        // Run platform add with local path.
        return cordova.raw.plugin('add', pluginPath, {'save':true, 'fetch':true})
        .then(function() {
            var cfg2 = new ConfigParser(configXmlPath);
            // Check config.xml for plugins and spec.
            configPlugins = cfg2.getPluginIdList();
            configPlugin = cfg2.getPlugin(configPlugins[1]);
            // Plugin is added.
            expect(configPlugin.name).toEqual('cordova-lib-test-plugin');
            // Spec for geolocation plugin is added.
            var result = includeFunc(configPlugin.spec , pluginPath);
            expect(result).toEqual(true);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    },60000);
});
