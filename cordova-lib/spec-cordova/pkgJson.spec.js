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
var helpers = require('./helpers'),
    path = require('path'),
    shell = require('shelljs'),
    events = require('cordova-common').events,
    ConfigParser = require('cordova-common').ConfigParser,
    cordova = require('../src/cordova/cordova');

// This group of tests checks if plugins are added and removed as expected from package.json.
describe('plugin end-to-end', function() {
    var pluginId = 'cordova-plugin-device';
    var tmpDir = helpers.tmpDir('plugin_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    events.on('results', function(res) { results = res; });

    beforeEach(function() {
        shell.rm('-rf', project);

        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson'), project);
        // Copy some platform to avoid working on a project with no platforms.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'platforms', helpers.testPlatform), path.join(project, 'platforms'));
        process.chdir(project);
        delete process.env.PWD;
    });

    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
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
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
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
            expect(configPlugin).toEqual({ name: 'cordova-plugin-device', spec: '~1.1.2', variables: {} });
        }).then(function() {
            // And now remove it with --save.
            return cordova.raw.plugin('rm', pluginId, {'save':true, 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Checking that the plugin removed is in not in the pkg.json.
            expect(pkgJson.cordova.plugins[pluginId]).toBeUndefined();
            // Spec should be removed from dependencies.
            expect(pkgJson.dependencies['cordova-plugin-device']).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    });

    it('Test#002 : should NOT add a plugin to package.json if --save is not used', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;

        expect(pkgJsonPath).toExist();

        // Add the camera plugin with --save.
        return cordova.raw.plugin('add', 'cordova-plugin-camera', {'save':true})
        .then(function() {
            // Add a second plugin without save.
            return cordova.raw.plugin('add', pluginId);
        }).then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check the plugin add was successful for the first plugin that had --save.
            expect(pkgJson).not.toBeUndefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            // Expect that the second plugin is not added.
            expect(pkgJson.cordova.plugins[pluginId]).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    });

    it('Test#003 : should NOT remove plugin from package.json if there is no --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        
        expect(pkgJsonPath).toExist();

        // Add the plugin with --save.
        return cordova.raw.plugin('add', pluginId, {'save':true})
        .then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check the platform add was successful.
            expect(pkgJson).not.toBeUndefined();
            expect(pkgJson.cordova.plugins).toBeDefined();
            expect(pkgJson.cordova.plugins[pluginId]).toBeDefined();
        }).then(function() {
            // And now remove it, but without --save.
            return cordova.raw.plugin('rm', 'cordova-plugin-device');
        }).then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // The plugin should still be in package.json.
            expect(pkgJson.cordova.plugins[pluginId]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    });

    it('Test#004 : should successfully add and remove a plugin with variables and save to package.json', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        var someKey = 'someKey';

        expect(pkgJsonPath).toExist();

        // Add the plugin with --save.
        return cordova.raw.plugin('add', pluginId, {'save':true, 'cli_variables': {'someKey':'someValue'}})
        .then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
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
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Checking that the plugin and variables were removed successfully.
            expect(pkgJson.cordova.plugins[pluginId]).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    });
    it('Test#005 : should successfully add and remove multiple plugins with save & fetch', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        // Delete any previous caches of require(package.json).
        delete require.cache[require.resolve(pkgJsonPath)];
        pkgJson = require(pkgJsonPath);
    
        expect(pkgJsonPath).toExist();

        // Add the plugin with --save.
        return cordova.raw.plugin('add', [pluginId,'cordova-plugin-device-motion'], {'save':true, 'fetch':true})
        .then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
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
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Checking that the plugin removed is in not in the platforms.
            expect(pkgJson.cordova.plugins[pluginId]).toBeUndefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-device-motion']).toBeUndefined();
            expect(pkgJson.dependencies[pluginId]).toBeUndefined();
            expect(pkgJson.dependencies['cordova-plugin-device-motion']).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    });
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
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
        // Delete any previous caches of require(package.json).
        delete require.cache[require.resolve(path.join(process.cwd(),'package.json'))];
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
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Checking that the platform removed is in not in the platforms key.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toEqual(-1);
        }).then(emptyPlatformList) // platform ls should be empty too.
        .fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    });

    it('Test#007 : should not remove platforms from package.json when removing without --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        expect(pkgJsonPath).toExist();
        var pkgJson;
        emptyPlatformList().then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Check the platform add was successful.
            pkgJson = require(pkgJsonPath);
            expect(pkgJson.cordova.platforms).not.toBeUndefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
        }).then(fullPlatformList) // Platform should still be in platform ls.
        .then(function() {
            // And now remove it without --save.
            return cordova.raw.platform('rm', [helpers.testPlatform]);
        }).then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check that the platform removed without --save is still in platforms key.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
        }).then(emptyPlatformList)
        .fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    });

    it('Test#008 : should not add platform to package.json when adding without --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        expect(pkgJsonPath).toExist();
        // Delete any previous caches of require(package.json).
        delete require.cache[require.resolve(pkgJsonPath)];
        pkgJson = require(pkgJsonPath);
        // Pkg.json "platforms" should be empty and helpers.testPlatform should not exist in pkg.json.
        expect(pkgJson.cordova).toBeUndefined();
        // Add platform without --save.
        cordova.raw.platform('add',[helpers.testPlatform])
        .then(function() {
            // Check the platform add was successful, reload, skipping cache.
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // PkgJson.cordova should not be defined and helpers.testPlatform should NOT have been added.
            expect(pkgJson.cordova).toBeUndefined();
        }).then(fullPlatformList)
        .fail(function(err) {
            expect(err).toBeUndefined();
        })
        .fin(done);
    });

    it('Test#009 : should only add the platform to package.json with --save', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        var pkgJson;
        var platformNotToAdd = 'ios';
        expect(pkgJsonPath).toExist();

        // Add a platform without --save.
        cordova.raw.platform('add',platformNotToAdd)
        .then(function() {
            // And now add another platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Check the platform add was successful, reload, skipping cache.
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
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
    }, 30000);
    it('Test#010 : two platforms are added and removed correctly with --save --fetch', function(done) {
        var pkgJsonPath = path.join(process.cwd(),'package.json');
        expect(pkgJsonPath).toExist();
        var pkgJson;
        // Delete any previous caches of require(package.json).
        delete require.cache[require.resolve(pkgJsonPath)];
        pkgJson = require(pkgJsonPath);
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
            return cordova.raw.platform('add', ['android@6.1.0', 'ios'], {'save':true, 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check the platform add was successful in platforms list and in dependencies.
            expect(pkgJson.cordova.platforms).toBeDefined();
            expect(pkgJson.cordova.platforms.indexOf('android')).toEqual(0);
            expect(pkgJson.cordova.platforms.indexOf('ios')).toEqual(1);
            expect(pkgJson.dependencies).toBeDefined();
            expect(pkgJson.dependencies['cordova-android']).toBeDefined();
            expect(pkgJson.dependencies['cordova-ios']).toBeDefined();
            // Android platform should have specific version from add.
            expect(pkgJson.dependencies['cordova-android']).toEqual('^6.1.0');

            var cfg3 = new ConfigParser(configXmlPath);
            engines = cfg3.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Check that android and ios were added to config.xml with the correct spec.
            expect(configEngArray.length === 2);
            expect(engines).toEqual([ { name: 'android', spec: '~6.1.0' }, { name: 'ios', spec: '~4.3.0' } ]);

        }).then(fullPlatformList) // Platform should still be in platform ls.
        .then(function() {
            // And now remove it with --save.
            return cordova.raw.platform('rm', ['android', 'ios'], {'save':true, 'fetch':true});
        }).then(function() {
            // Delete any previous caches of require(package.json).
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Checking that the platform removed is in not in the platforms key.
            expect(pkgJson.cordova.platforms.indexOf('android')).toEqual(-1);
            expect(pkgJson.cordova.platforms.indexOf('ios')).toEqual(-1);
            // Dependencies are removed.
            expect(pkgJson.dependencies['cordova-android']).toBeUndefined();
            expect(pkgJson.dependencies['cordova-ios']).toBeUndefined();
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
    }, 30000);
});

