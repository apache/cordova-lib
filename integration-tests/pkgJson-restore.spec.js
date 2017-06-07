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
    cordova_util = require('../src/cordova/util'),
    TIMEOUT = 60 * 1000;

/** Testing will check if "cordova prepare" is restoring platforms and plugins as expected.
*   Uses different basePkgJson files depending on testing expecations of what (platforms/plugins/variables)
*   should initially be in pkg.json and/or config.xml.
*/

// Use basePkgJson
describe('tests platform/spec restore with --save', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson2');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', project);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson'), project);
        process.chdir(project);
        delete process.env.PWD;
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#000 will check that when a platform is added with a spec, it will 
    *   add to pkg.json with a '^' and to config.xml with a '~'. When prepare is run,
    *   pkg.json will have no change and config.xml (first char) will change from a '~' to a '^'.
    */
    it('Test#000 : tests that the spec (~,^) is added and updated as expected in config.xml', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var pkgJson;
        var androidPlatform = 'android';
        var configXmlPath = path.join(cwd, 'config.xml');
        var firstCharConfig;
        var engines;
        var engNames;
        var engSpec;

        emptyPlatformList().then(function() {
            // Add platform with save, fetch
            return cordova.raw.platform('add', androidPlatform, {'save':true , 'fetch':true});
        }).then(function() {
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Added platform properly to pkg.json
            expect(pkgJson.cordova.platforms).toBeDefined();
            expect(pkgJson.cordova.platforms.indexOf(androidPlatform)).toBeGreaterThan(-1);
            // When spec is added to pkg.json, first char is '^'.
            expect(pkgJson.dependencies['cordova-'+androidPlatform].charAt(0)).toEqual('^');

            var cfg = new ConfigParser(configXmlPath);
            engines = cfg.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            engSpec = engines.map(function(elem) {
                return elem.spec;
            });
            // Only android platform added to config.xml
            expect(engNames).toEqual([ androidPlatform ]);
            expect(engines.length === 1);
            // When spec is added to config.xml, first char is '~'.
            firstCharConfig = engSpec[0].charAt(0);
            expect(firstCharConfig === '~');
        }).then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // No changes to pkg.json spec for android.
            expect(pkgJson.dependencies['cordova-'+androidPlatform].charAt(0)).toEqual('^');
            expect(pkgJson.cordova.platforms.indexOf(androidPlatform)).toBeGreaterThan(-1);
            // Config.xml spec (first char) should change from '~' to '^'.
            var cfg1 = new ConfigParser(configXmlPath);
            engines = cfg1.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            engSpec = engines.map(function(elem) {
                return elem.spec;
            });
            firstCharConfig = engSpec[0].charAt(0);
            // When spec is added to config.xml, first char is '~'.
            expect(firstCharConfig === '^');
            expect(engNames).toEqual([ androidPlatform ]);
            expect(engines.length === 1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },300000);

    /** Test#017
    *   When platform is added with url and fetch and restored with fetch, 
    *   pkg.json and config.xml would add it to their files properly.
    *   When prepare is run with fetch, platform should be installed.
    */
    it('Test#017 : test to make sure that platform url is added and restored properly', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson;
        var platformsFolderPath = path.join(cwd,'platforms/platforms.json');
        var platformsJson;
        var configXmlPath = path.join(cwd, 'config.xml');
        var bPlatform = 'browser';
        var engines;
        var engNames;
        var engSpec;

        emptyPlatformList().then(function() {
            // Add platform with save and fetch
            return cordova.raw.platform('add', 'https://github.com/apache/cordova-browser', {'save':true, 'fetch':true});
        }).then(function() {
            // Check that platform was added to config.xml successfully.
            var cfg = new ConfigParser(configXmlPath);
            engines = cfg.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            engSpec = engines.map(function(elem) {
                return elem.spec;
            });
            expect(engNames).toEqual([bPlatform]);
            expect(engSpec).toEqual([ 'https://github.com/apache/cordova-browser' ]);
            // Check that platform was added to pkg.json successfully.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            expect(pkgJson.cordova.platforms.indexOf('browser')).toBeDefined();
            expect(pkgJson.dependencies['cordova-browser']).toEqual('git+https://github.com/apache/cordova-browser.git');
            // Check that platform was added to platforms list successfully.
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            expect(platformsJson[bPlatform]).toBeDefined();
        }).then(function() {
            // Remove platform without --save.
            return cordova.raw.platform('rm', bPlatform, {'fetch':true});
        }).then(function() {
            // Platform in pkg.json should still be there.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            expect(pkgJson.cordova.platforms.indexOf('browser')).toBeDefined();
            expect(pkgJson.dependencies['cordova-browser']).toEqual('git+https://github.com/apache/cordova-browser.git');
            // Platform in platforms.json should not be there.
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            expect(platformsJson[bPlatform]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare
            return cordova.raw.prepare({'fetch':true});
        }).then(function() {
            // Check config.xml for spec modification.
            var cfg3 = new ConfigParser(configXmlPath);
            engines = cfg3.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            engSpec = engines.map(function(elem) {
                return elem.spec;
            });
            expect(engNames).toEqual([ 'browser' ]);
            expect(engSpec).toEqual([ 'git+https://github.com/apache/cordova-browser.git' ]);
            // No change to pkg.json.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            expect(pkgJson.cordova.platforms.indexOf('browser')).toBeDefined();
            expect(pkgJson.dependencies['cordova-browser']).toEqual('git+https://github.com/apache/cordova-browser.git');
            // Check that platform was restored to platform.json list successfully.
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            expect(platformsJson[bPlatform]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);

    /** Test#018
    *   When plugin is added with url and fetch and restored with fetch, 
    *   pkg.json and config.xml would add it to their files properly.
    *   When prepare is run with fetch, plugin should be installed.
    */
    it('Test#018 : test to make sure that plugin url is added and restored properly', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson;
        var pluginsFolderPath = path.join(cwd,'plugins');
        var configXmlPath = path.join(cwd, 'config.xml');
        var configPlugins;
        var configPlugin;

        emptyPlatformList().then(function() {
            // Add plugin with save and fetch.
            return cordova.raw.plugin('add', ['https://github.com/apache/cordova-plugin-splashscreen'], {'save':true, 'fetch':true});
        }).then(function() {
            // Plugin id and spec were added to config.xml successfully.
            var cfg = new ConfigParser(configXmlPath);
            configPlugins = cfg.getPluginIdList();
            configPlugin = cfg.getPlugin(configPlugins);
            expect(configPlugin.spec).toEqual('https://github.com/apache/cordova-plugin-splashscreen');
            expect(configPlugin.name).toEqual('cordova-plugin-splashscreen');
            // Plugin was added to pkg.json successfully in plugin list and dependencies.   
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            expect(pkgJson.dependencies).toEqual({ 'cordova-plugin-splashscreen': 'git+https://github.com/apache/cordova-plugin-splashscreen.git' });
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
            // Plugin was added to installed plugin list successfully.
            expect(path.join(pluginsFolderPath, 'cordova-plugin-splashscreen')).toExist();
        }).then(function() {
            // Remove plugin without --save.
            return cordova.raw.plugin('rm', 'cordova-plugin-splashscreen', {'fetch':true});
        }).then(function() {
            // Plugin id and spec are still in config.xml.
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();
            configPlugin = cfg2.getPlugin(configPlugins);
            expect(configPlugin.spec).toEqual('https://github.com/apache/cordova-plugin-splashscreen');
            expect(configPlugin.name).toEqual('cordova-plugin-splashscreen');
            // Plugin still in pkg.json plugin list and dependencies.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            expect(pkgJson.dependencies).toEqual({ 'cordova-plugin-splashscreen': 'git+https://github.com/apache/cordova-plugin-splashscreen.git' });
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
            // Plugin was removed from the installed plugin list successfully.
            expect(path.join(pluginsFolderPath, 'cordova-plugin-splashscreen')).not.toExist();
        }).then(function() {
            // Add platform (so that prepare can run).
            return cordova.raw.platform('add', 'browser', {'save':true});
        }).then(function() {
            // Run cordova prepare with fetch.
            return cordova.raw.prepare({'fetch':true});
        }).then(function() {
            // Config.xml spec is modified.
            var cfg3 = new ConfigParser(configXmlPath);
            configPlugins = cfg3.getPluginIdList();
            configPlugin = cfg3.getPlugin(configPlugins);
            expect(configPlugin.spec).toEqual('git+https://github.com/apache/cordova-plugin-splashscreen.git');
            expect(configPlugin.name).toEqual('cordova-plugin-splashscreen');
            // Pkg.json splashscreen dependency has no changes.
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            expect (pkgJson.dependencies['cordova-plugin-splashscreen']).toEqual('git+https://github.com/apache/cordova-plugin-splashscreen.git');
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
            // Plugin was restored and added to installed plugin list successfully.
            expect(path.join(pluginsFolderPath, 'cordova-plugin-splashscreen')).toExist();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson
describe('tests platform/spec restore with --save', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson2');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#003 will add two platforms to package.json - one with the 'save' flag and one
    *   without the 'save' flag. It will remove both platforms without a 'save' flag.
    *   After running cordova prepare, only the platform added with the 'save' flag is restored
    *   in platforms.json.
    */
    it('Test#003 : should NOT restore platform that was not saved and removed', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson;
        var platformsFolderPath = path.join(cwd,'platforms/platforms.json');
        var secondPlatformAdded = 'browser';
        var platformsJson;

        emptyPlatformList().then(function() {
            // Add 'browser' platform to project without --save
            return cordova.raw.platform('add', secondPlatformAdded);
        }).then(function() {
            // Add helpers.testPlatform to project with --save
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platformsJson)
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            // Check the platform add of only helpers.testPlatform was successful in package.json.
            expect(pkgJson.cordova.platforms).toBeDefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            expect(pkgJson.cordova.platforms.indexOf(secondPlatformAdded)).toEqual(-1);
            // Expect both platforms to be installed platform list in platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
            expect(platformsJson[secondPlatformAdded]).toBeDefined();
        }).then(fullPlatformList) // Platforms should still be in platform ls.
        .then(function() {
            // Remove helpers.testPlatform without --save.
            return cordova.raw.platform('rm', [helpers.testPlatform]);
        }).then(function() {
            // Remove secondPlatformAdded without --save.
            return cordova.raw.platform('rm', secondPlatformAdded);
        }).then(function() {
            // Delete any previous caches of require(pkgJson) and (platformsJson)
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check that the platform that was added with --save is still in package.json.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            // Check that both platforms were removed from the platforms.json.
            expect(platformsJson[secondPlatformAdded]).toBeUndefined();
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of platformsJson
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list.
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
            // Expect that 'browser' will not be in platforms.json and has not been restored.
            expect(platformsJson[secondPlatformAdded]).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson6 because pkg.json and config.xml contain only android
describe('files should not be modified if their platforms are identical', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        // Use basePkgJson6 because pkg.json and config.xml contain only android
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson6'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson6'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#004 will check the platform list in package.json and config.xml. 
    *   When both files contain the same platforms and cordova prepare is run, 
    *   neither file is modified.
    */
    it('Test#004 : if pkg.json and config.xml have the same platforms, do not modify either file', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg1 = new ConfigParser(configXmlPath);
        var engines = cfg1.getEngines();
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson;
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();
        // Pkg.json and config.xml contain only android at this point (basePkgJson6).
        emptyPlatformList().then(function() {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Expect android to be in both pkg.json and config.xml.
            expect(pkgJson.cordova.platforms.indexOf('android')).toBeGreaterThan(-1);
            expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
            // Expect pkg.json and config.xml to have only 1 element each.
            expect(configEngArray.length === 1);
            expect(pkgJson.cordova.platforms.length === 1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use a new basePkgJson5 as config.xml contains android/browser and pkg.json contains android
describe('update pkg.json to include platforms in config.xml', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson5'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson5'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#005 will check the platform list in package.json and config.xml. 
    *   When config.xml has 'android and browser' and pkg.json only contains 'android', run cordova
    *   and pkg.json is updated to include 'browser'. This test will also check that pkg.json
    *   is updated with the correct spec/dependencies when restored. Checks that specs are
    *   added properly, too.
    */
    it('Test#005 : if config.xml has android & browser platforms and pkg.json has android, update pkg.json to also include browser with spec', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg = new ConfigParser(configXmlPath);
        var engines = cfg.getEngines();
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var pkgJson = require(pkgJsonPath);
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();
        var androidPlatform = 'android';
        var browserPlatform = 'browser';

        // Config.xml contains(android & browser) and pkg.json contains android (basePkgJson5).
        expect(configEngArray.indexOf(androidPlatform)).toBeGreaterThan(-1);
        expect(configEngArray.indexOf(browserPlatform)).toBeGreaterThan(-1);
        // pkg.json should not contain 'browser' platform before cordova prepare.
        expect(pkgJson.cordova.platforms.indexOf(browserPlatform)).toEqual(-1);
        expect(pkgJson.cordova.platforms.indexOf(androidPlatform)).toBeGreaterThan(-1);
        // pkg.json browser/android specs should be undefined.
        expect(pkgJson.dependencies[browserPlatform]).toBeUndefined();
        expect(pkgJson.dependencies[androidPlatform]).toBeUndefined();
        emptyPlatformList().then(function() {
            return cordova.raw.prepare();
        }).then(function() {
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Expect 'browser' to be added to pkg.json.
            expect(pkgJson.cordova.platforms.indexOf(browserPlatform)).toBeGreaterThan(-1);
            // Expect 'android' to still be there in pkg.json.
            expect(pkgJson.cordova.platforms.indexOf(androidPlatform)).toBeGreaterThan(-1);
            // Expect both pkg.json and config.xml to each have both platforms in their arrays.
            expect(configEngArray.length === 2);
            expect(pkgJson.cordova.platforms.length === 2);
            // No changes to config.xml.
            expect(configEngArray.indexOf(androidPlatform)).toBeGreaterThan(-1);
            expect(configEngArray.indexOf(browserPlatform)).toBeGreaterThan(-1);
            // Platform specs from config.xml have been added to pkg.json.
            expect(pkgJson.dependencies['cordova-browser']).toEqual('^4.1.0');
            expect(pkgJson.dependencies['cordova-android']).toEqual('6.1.1');
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson3 as it has 'android' in config.xml and pkg.json (no cordova key).
describe('update empty package.json to match config.xml', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson3'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson3'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#006 will check if pkg.json has a cordova key and platforms installed already.
     *   If it does not and config.xml has a platform(s) installed already, run cordova prepare
     *   and it will add a cordova key and the platform(s) from config.xml to package.json.
     */
     it('Test#006 : if pkg.json exists without cordova key, create one with same platforms in config.xml ', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var cfg1 = new ConfigParser(configXmlPath);
        var engines = cfg1.getEngines();
        var pkgJson = require(pkgJsonPath);
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();

        // Expect that pkg.json exists without a cordova key.
        expect(pkgJson).toBeDefined();
        expect(pkgJson.cordova).toBeUndefined();
        // Expect that config.xml contains only android at this point.
        expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
        expect(configEngArray.length === 1);
        // Run cordova prepare.
        cordova.raw.prepare();
        emptyPlatformList().then(function() {
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Expect no change to config.xml.
            expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
            // Expect cordova key and 'android' platform to be added to pkg.json.
            expect(pkgJson.cordova.platforms.indexOf('android')).toBeGreaterThan(-1);
            // Expect both pkg.json and config.xml to each have (only) android in their arrays.
            expect(configEngArray.length === 1);
            expect(pkgJson.cordova.platforms.length === 1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
 });

// Use a new basePkgJson4 as pkg.json contains android/browser and config.xml contains android.
describe('update config.xml to include platforms in pkg.json', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson4'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson4'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#007 will check the platform list in package.json and config.xml. 
    *   When package.json has 'android and browser' and config.xml only contains 'android', run cordova
    *   and config.xml is updated to include 'browser'. Also, if there is a specified spec in pkg.json,
    *   it should be added to config.xml during restore.
    */
    it('Test#007 : if pkgJson has android & browser platforms and config.xml has android, update config to also include browser and spec', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg1 = new ConfigParser(configXmlPath);
        var engines = cfg1.getEngines();
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var pkgJson = require(pkgJsonPath);
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();

        // Expect that config.xml contains only android at this point (basePjgJson4)
        expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
        expect(configEngArray.indexOf('browser')).toEqual(-1);
        expect(configEngArray.length === 1);
        // Pkg.json has cordova-browser in its dependencies.
        expect(pkgJson.dependencies).toEqual({ 'cordova-android' : '^3.1.0', 'cordova-browser' : '^4.1.0' });
        emptyPlatformList().then(function() {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Expect 'browser' to be added to config.xml.
            expect(configEngArray.indexOf('browser')).toBeGreaterThan(-1);
            // Expect 'android' to still be in config.xml.
            expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
            // Expect config.xml array to have 2 elements (platforms).
            expect(configEngArray.length === 2);
            // Check to make sure that 'browser' spec was added properly.
            expect(engines).toEqual([ { name: 'android', spec: '^3.1.0' },{ name: 'browser', spec: '^4.1.0' } ]);
            // No change to pkg.json dependencies.
            expect(pkgJson.dependencies).toEqual({ 'cordova-android' : '^3.1.0', 'cordova-browser' : '^4.1.0' });
            expect(pkgJson.dependencies['cordova-android']).toEqual('^3.1.0');
            expect(pkgJson.dependencies['cordova-browser']).toEqual('^4.1.0');
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Plugin testing begins here.

// Use basePkgJson8 as pkg.json contains 1 plugin and 1 variable and config contains 1 plugin 1 var
// Same variable, different values... pkg.json should win
describe('update config.xml to use the variable found in pkg.json', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson8'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson8'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#011 will check the plugin/variable list in package.json and config.xml. 
    *   When pkg.json and config.xml have the same variables, but different values,
    *   pkg.json should win and that value will be used and replaces config's value.
    */
    it('Test#011 : if pkg.Json has 1 plugin and 1 variable, update config.xml to include these variables', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var configPlugin = cfg1.getPlugin(configPlugins);
        var configPluginVariables = configPlugin.variables;
        var pkgJson = require(pkgJsonPath);
        var pluginsFolderPath = path.join(cwd,'plugins');

        // Expect that pkg.json exists with 1 plugin, 1 variable, and a different value ('json').
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 1);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'json' });
        // Expect that config.xml exists with 1 plugin, 1 variable, but a different value ('config').
        expect(configPlugin.name).toEqual('cordova-plugin-camera');
        expect(configPluginVariables).toEqual({ variable_1: 'config' });
        expect(Object.keys(configPlugin).length === 1);

        emptyPlatformList().then(function() {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();
            configPlugin = cfg2.getPlugin(configPlugins);
            configPluginVariables = configPlugin.variables;
            // Expect that pkg.json exists with 1 plugin, 1 variable, and the pkg.json value.
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(Object.keys(pkgJson.cordova.plugins).length === 1);
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'json' });
            // Expect that config.xml exists with 1 plugin, 1 variable and pkg.json's value.
            expect(configPlugin.name).toEqual('cordova-plugin-camera');
            expect(configPluginVariables).toEqual({ variable_1: 'json' });
            expect(Object.keys(configPlugin).length === 1);
            // Expect that the camera plugin is restored.
            expect(path.join(pluginsFolderPath, 'cordova-plugin-camera')).toExist();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson9 as config contains 1 plugin and 1 variable and pkg.json contains 1 plugin 0 var
describe('update pkg.json to include plugin and variable found in config.xml', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson9'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson9'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#012 will check the plugin/variable list in package.json and config.xml. 
    *   When config.xml has a 'camera plugin and 1 variable' and pkg.json has 1 plugins/0 variables,
    *   cordova prepare runs and will update pkg.json to match config.xml's plugins/variables.
    */
    it('Test#012 : if pkg.Json has 1 plugin and 2 variables, update config.xml to include these plugins/variables', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        // Delete any previous caches of require(package.json).
        cordova_util.requireNoCache(pkgJsonPath);
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var configPlugin = cfg1.getPlugin(configPlugins);
        var configPluginVariables = configPlugin.variables;
        var pkgJson = require(pkgJsonPath);
        var pluginsFolderPath12 = path.join(cwd,'plugins');

        // Expect that pkg.json exists with 1 plugin without a variable.
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 1);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
        expect(pkgJson.cordova.plugins).toEqual({ 'cordova-plugin-camera': {} });

        // Expect that config.xml exists with 1 plugin and 1 variable with value_1.
        expect(configPlugin.name).toEqual('cordova-plugin-camera');
        expect(configPluginVariables).toEqual({ variable_1: 'value_1' });
        expect(Object.keys(configPlugin).length === 1);

        emptyPlatformList().then(function() {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();
            configPlugin = cfg2.getPlugin(configPlugins);
            configPluginVariables = configPlugin.variables;
            // Expect that pkg.json exists with 1 plugin, 1 variable, and 1 value.
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(Object.keys(pkgJson.cordova.plugins).length === 1);
            expect(pkgJson.cordova.plugins).toEqual({ 'cordova-plugin-camera': { variable_1: 'value_1' } });
            // Expect that config.xml exists with 1 plugin, 1 variable and 1 value.
            expect(configPlugin.name).toEqual('cordova-plugin-camera');
            expect(configPluginVariables).toEqual({ variable_1: 'value_1' });
            expect(Object.keys(configPlugin).length === 1);
            //Expect camera to be restored and in the installed plugin list.
            expect(path.join(pluginsFolderPath12, 'cordova-plugin-camera')).toExist();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson10 as pkg.json contains (camera plugin: var 1/var 2, splashscreen plugin). 
// and config contains (camera plugin: var 3, value 1, device plugin).
describe('update pkg.json AND config.xml to include all plugins and merge unique variables', function () {
    var tmpDir = helpers.tmpDir('plugin_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson10'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson10'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#013 will check the plugin/variable list in package.json and config.xml. 
    *   For plugins that are the same, it will merge their variables together for the final list.
    *   Plugins that are unique to that file, will be copied over to the file that is missing it.
    *   Config.xml and pkg.json will have identical plugins and variables after cordova prepare.
    */
    it('Test#013 : update pkg.json AND config.xml to include all plugins and merge unique variables', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var pkgJson = require(pkgJsonPath);
        var configPlugin;
        var configPluginVariables;
        var pluginsFolderPath13 = path.join(cwd,'plugins');

        // Config.xml has 2 plugins and does not have device plugin yet.
        expect(Object.keys(configPlugins).length === 2);
        expect(configPlugins.indexOf('cordova-plugin-device')).toEqual(-1);
        expect(configPlugins.indexOf('cordova-plugin-camera')).toEqual(0);
        expect(configPlugins.indexOf('cordova-plugin-splashscreen')).toEqual(1);
        // Config.xml camera plugin has var_3,value_3 and splashscreen has 0 variables.
        for (var i = 0; i < configPlugins.length; i++) {
            configPlugin = cfg1.getPlugin(configPlugins[i]);
            configPluginVariables = configPlugin.variables;
            if(configPlugin.name === 'cordova-plugin-camera') {
                expect(configPluginVariables).toEqual({ variable_3: 'value_3'});
            }
            if(configPlugin.name === 'cordova-plugin-splashscreen') {
                expect(configPluginVariables).toEqual({});
            }
        }
        // Expect that pkg.json exists with 3 plugins (camera, device, and splashscreen)
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 3);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
        expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
        expect(pkgJson.cordova.plugins['cordova-plugin-device']).toBeDefined();
        // Splashscreen has no variables and camera has var_1 and var_2 and device has var_1, val_1.
        expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toEqual({});
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: ' ', variable_2: ' ' });
        expect(pkgJson.cordova.plugins['cordova-plugin-device']).toEqual({ variable_1: 'value_1' });

        emptyPlatformList().then(function() {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();
            // Check to make sure that variables were added as expected.
            for (var i = 0; i < configPlugins.length; i++) {
                configPlugin = cfg2.getPlugin(configPlugins[i]);
                configPluginVariables = configPlugin.variables;
                // Config.xml camera variables have been merged, no duplicates.
                if(configPlugin.name === 'cordova-plugin-camera') {
                    expect(configPluginVariables).toEqual({ variable_1: ' ', 
                        variable_2: ' ', variable_3: 'value_3' });
                }
                // Expect that device has var1, val1 and splashscreen has 0 var.
                if(configPlugin.name === 'cordova-plugin-device') {
                    expect(configPluginVariables).toEqual({ variable_1: 'value_1'});
                }
                if(configPlugin.name === 'cordova-plugin-splashscreen') {
                    expect(configPluginVariables).toEqual({});
                }
            }
            // Expect pkg.json to have the variables from config.xml.
            expect(Object.keys(pkgJson.cordova.plugins).length === 3);
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-device']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: ' ', variable_2: ' ', variable_3: 'value_3' });
            // Expect config.xml to have the plugins from pkg.json.
            expect(Object.keys(configPlugins).length === 3);
            expect(configPlugins.indexOf('cordova-plugin-camera')).toEqual(0);
            expect(configPlugins.indexOf('cordova-plugin-device')).toEqual(1);
            expect(configPlugins.indexOf('cordova-plugin-splashscreen')).toEqual(2);
            // Expect all 3 plugins to be restored.
            expect(path.join(pluginsFolderPath13, 'cordova-plugin-device')).toExist();
            expect(path.join(pluginsFolderPath13, 'cordova-plugin-camera')).toExist();
            expect(path.join(pluginsFolderPath13, 'cordova-plugin-splashscreen')).toExist();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson11 as pkg.json contains(splashscreen plugin, camera plugin: var1, value1, var2, value2) and
// config.xml contains (device plugin, camera plugin: var1, value 1, var2, value 2).
describe('update pkg.json AND config.xml to include all plugins/merge variables and check for duplicates', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson11'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson11'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#014 will check the plugin/variable list in package.json and config.xml. 
    *   If either file is missing a plugin, it will be added with the correct variables.
    *   If there is a matching plugin name, the variables will be merged and then added
    *   to config and pkg.json. 
    */
    it('Test#014 : update pkg.json AND config.xml to include all plugins and merge variables (no dupes)', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var pkgJson = require(pkgJsonPath);
        var configPlugin;
        var configPluginVariables;
        var pluginsFolderPath14 = path.join(cwd,'plugins');

        // Config.xml initially has the camera and device plugin and NO splashscreen
        expect(Object.keys(configPlugins).length === 2);
        expect(configPlugins.indexOf('cordova-plugin-splashscreen')).toEqual(-1);
        expect(configPlugins.indexOf('cordova-plugin-camera')).toEqual(0);
        expect(configPlugins.indexOf('cordova-plugin-device')).toEqual(1);
        // Config.xml camera initially has var1,val1 and var2, val2 and device has no variables
        for (var i = 0; i < configPlugins.length; i++) {
            configPlugin = cfg1.getPlugin(configPlugins[i]);
            configPluginVariables = configPlugin.variables;
            if(configPlugin.name === 'cordova-plugin-camera') {
                expect(configPluginVariables).toEqual({ variable_1: 'value_1', variable_2: 'value_2' });
                // Config.xml camera plugin has the spec ~2.2.0
                expect(configPlugin.spec).toEqual('~2.2.0');
            }
            if(configPlugin.name === 'cordova-plugin-device') {
                expect(configPluginVariables).toEqual({});
                // Config.xml device plugin has the spec ~1.0.0
                expect(configPlugin.spec).toEqual('~1.0.0');
            }
        }
        // Expect that pkg.json exists with 2 plugins
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 2);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
        // Pkg.json camera plugin's spec is ^2.3.0
        expect(pkgJson.dependencies['cordova-plugin-camera']).toEqual('^2.3.0');
        expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
        // Pkg.json does not have device yet
        expect(pkgJson.cordova.plugins['cordova-plugin-device']).toBeUndefined();
        // Pkg.json camera plugin has var1, value 1 and var3, value 3
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'value_1', variable_3: 'value_3' });
        // Pkg.json splashscreen has no variables
        expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toEqual({});

        emptyPlatformList().then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of require(package.json)
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();

            // Check to make sure that variables were added as expected
            for (var i = 0; i < configPlugins.length; i++) {
                configPlugin = cfg2.getPlugin(configPlugins[i]);
                configPluginVariables = configPlugin.variables;
                // Config.xml camera variables have been merged, no duplicates
                if(configPlugin.name === 'cordova-plugin-camera') {
                    expect(configPluginVariables).toEqual({ variable_1: 'value_1',
                        variable_3: 'value_3', variable_2: 'value_2' });
                    // Config.xml plugin spec should be updated to ^2.3.0
                    expect(configPlugin.spec).toEqual('^2.3.0');
                }
                // Expect that splashscreen and device have 0 variables
                if(configPlugin.name === 'cordova-plugin-device') {
                    expect(configPluginVariables).toEqual({});
                    // Config.xml device plugin still has the spec ~1.0.0
                    expect(configPlugin.spec).toEqual('~1.0.0');
                }
                if(configPlugin.name === 'cordova-plugin-splashscreen') {
                    expect(configPluginVariables).toEqual({});
                }
            }
            // Config.xml now has the camera, splashscreen, and device plugin
            expect(Object.keys(configPlugins).length === 3);
            expect(configPlugins.indexOf('cordova-plugin-camera')).toEqual(0);
            expect(configPlugins.indexOf('cordova-plugin-splashscreen')).toEqual(1);
            expect(configPlugins.indexOf('cordova-plugin-device')).toEqual(2);
            // Pkg.json has all 3 plugins with the correct specs
            expect(Object.keys(pkgJson.cordova.plugins).length === 3);
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(pkgJson.dependencies['cordova-plugin-camera']).toEqual('^2.3.0');
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-device']).toBeDefined();
            expect(pkgJson.dependencies['cordova-plugin-device']).toEqual('~1.0.0');
            // Expect that splashscreen and device have 0 variables
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toEqual({});
            expect(pkgJson.cordova.plugins['cordova-plugin-device']).toEqual({});
            // Expect that the variables from config have been merged with the variables 
            // from pkg.json to the camera plugin
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'value_1',
                variable_3: 'value_3', variable_2: 'value_2' });
            // Expect that all 3 plugins are restored and in the installed list.
            expect(path.join(pluginsFolderPath14, 'cordova-plugin-camera')).toExist();
            expect(path.join(pluginsFolderPath14, 'cordova-plugin-splashscreen')).toExist();
            expect(path.join(pluginsFolderPath14, 'cordova-plugin-device')).toExist();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson12 as config.xml has 0 plugins and pkg.json has 1.
describe('update config.xml to include the plugin that is in pkg.json', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson12'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson12'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#015 will check the plugin/variable list in package.json and config.xml. 
    *   When config has 0 plugins and is restored, the plugins will be restored with the 
    *   pkg.json plugins and with the spec from pkg.json dependencies.
    */
    it('Test#015 : update config.xml to include all plugins/variables from pkg.json', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var cfg = new ConfigParser(configXmlPath);
        var configPlugins = cfg.getPluginIdList();
        var configPluginSpecs = cfg.getPlugin(configPlugins);
        var pkgJson = require(pkgJsonPath);
        var configPlugin;
        var configPluginVariables;
        var pluginsFolderPath15 = path.join(cwd,'plugins');

        // Config.xml is initially empty and has no plugins.
        expect(Object.keys(configPlugins).length === 0);
        // Expect that pkg.json exists with 1 plugin.
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 1);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
        // Pkg.json camera plugin has var_1, val_1.
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'value_1' });
        // Pkg.json has '^2.3.0' spec for camera plugin.
        expect(pkgJson.dependencies).toEqual({ 'cordova-plugin-camera': '^2.3.0' });

        emptyPlatformList().then(function() {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of require(package.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();
            configPluginSpecs = cfg2.getPlugin(configPlugins);

            // Check to make sure that the variables were added as expected to config.xml.
            for (var i = 0; i < configPlugins.length; i++) {
                configPlugin = cfg2.getPlugin(configPlugins[i]);
                configPluginVariables = configPlugin.variables;
                // Pkg.json dependencies should be the same.
                expect(pkgJson.dependencies).toEqual({ 'cordova-plugin-camera': '^2.3.0' });
                // Config.xml camera variables have been added.
                if(configPlugin.name === 'cordova-plugin-camera') {
                    expect(configPluginVariables).toEqual({ variable_1: 'value_1' });
                    // Check that the camera plugin has the correct spec and has been updated in config.xml
                    expect(configPlugin.spec).toEqual('^2.3.0');
                }
            }
            // Check to make sure that the config.xml spec was overwritten by the pkg.json one.
            expect(configPluginSpecs).toEqual( { name: 'cordova-plugin-camera',spec: '^2.3.0',variables: { variable_1: 'value_1' } });
            // Camera plugin gets added to config.xml.
            expect(Object.keys(configPlugins).length === 1);
            expect(configPlugins.indexOf('cordova-plugin-camera')).toEqual(0);
            // No changes to pkg.json.
            expect(Object.keys(pkgJson.cordova.plugins).length === 1);
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'value_1' });
            // Check if the camera plugin is in the installed list.
            expect(path.join(pluginsFolderPath15, 'cordova-plugin-camera')).toExist();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson13 - does NOT have a package.json
describe('platforms and plugins should be restored with config.xml even without a pkg.json', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        // Use basePkgJson6 because pkg.json and config.xml contain only android
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson13'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson13'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#016 will check that cordova prepare will still restore the correct
    *   platforms and plugins even without package.json file.
    */
    it('Test#016 : platforms and plugins should be restored with config.xml even without a pkg.json', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg1 = new ConfigParser(configXmlPath);
        var engines = cfg1.getEngines();
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();
        var configPlugins = cfg1.getPluginIdList();
        var platformsFolderPath1 = path.join(cwd,'platforms/platforms.json');
        var pluginsFolderPath16 = path.join(cwd,'plugins');
        var platformsJson;
        var androidPlatform = 'android';
        var browserPlatform = 'browser';

        // Pkg.json does not exist.
        expect(path.join(cwd,'package.json')).not.toExist();
        // Config.xml contains only contains 'android' at this point (basePkgJson13).
        expect(configEngArray.length === 1);
        // Config.xml contains only 1 plugin at this point.
        expect(Object.keys(configPlugins).length === 1);

        emptyPlatformList().then(function() {
            // Run platform add.
            return cordova.raw.platform('add', browserPlatform, {'save':true});
        }).then(function () {
            // Android and browser are in config.xml.
            var cfg3 = new ConfigParser(configXmlPath);
            engines = cfg3.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            expect(configEngArray.length === 2);
            // Delete previouc caches of (pkg.json).
            platformsJson = cordova_util.requireNoCache(platformsFolderPath1);
            // Browser should be installed
            expect(platformsJson).toBeDefined();
            expect(platformsJson[androidPlatform]).not.toBeDefined();
            expect(platformsJson[browserPlatform]).toBeDefined();
            // Package.json should be auto-created.
            expect(path.join(cwd,'package.json')).toExist();
            var pkgJsonPath = path.join(cwd,'package.json');
            delete require.cache[require.resolve(pkgJsonPath)];
            var pkgJson = require(pkgJsonPath);
            // Expect that pkgJson name, version, and displayName should use
            // config.xml's id, version, and name.
            expect(pkgJson.name).toEqual(cfg3.packageName().toLowerCase());
            expect(pkgJson.version).toEqual(cfg3.version());
            expect(pkgJson.displayName).toEqual(cfg3.name());
            // Remove android without --save.
            return cordova.raw.platform('rm', [browserPlatform]);
        }).then(function () {
            // Android should not be in the installed list (only browser).
            platformsJson = cordova_util.requireNoCache(platformsFolderPath1);
            expect(platformsJson).toBeDefined();
            expect(platformsJson[browserPlatform]).toBeUndefined();
            expect(platformsJson[androidPlatform]).not.toBeDefined();
        }).then(function () {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Config.xml should have android and browser.
            expect(configEngArray.indexOf(androidPlatform)).toBeGreaterThan(-1);
            expect(configEngArray.indexOf(browserPlatform)).toBeGreaterThan(-1);
            expect(configEngArray.length === 2);
            // Expect that android and browser were restored.
            platformsJson = cordova_util.requireNoCache(platformsFolderPath1);
            expect(platformsJson[androidPlatform]).toBeDefined();
            expect(platformsJson[browserPlatform]).toBeDefined();
        }).then(function () {
            //Check plugins.
            var cfg5 = new ConfigParser(configXmlPath);
            engines = cfg5.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Config.xml contains only one plugin.
            expect(Object.keys(configPlugins).length === 1);
            expect(configPlugins.indexOf('cordova-plugin-device')).toEqual(0);
            // Expect device plugin to be in the installed list.
            expect(path.join(pluginsFolderPath16, 'cordova-plugin-device')).toExist();
        }).then(function () {
            // Remove plugin without save.
            return cordova.raw.plugin('rm', 'cordova-plugin-device');
        }).then(function () {
            var cfg4 = new ConfigParser(configXmlPath);
            engines = cfg4.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Config.xml plugins are the same.
            expect(Object.keys(configPlugins).length === 1);
            expect(configPlugins.indexOf('cordova-plugin-device')).toEqual(0);
            // Plugin should be removed from the installed list.
            expect(path.join(pluginsFolderPath16, 'cordova-plugin-device')).not.toExist();
        }).then(function () {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function () {
        //  Plugin should be restored and returned to the installed list.
        expect(path.join(pluginsFolderPath16, 'cordova-plugin-device')).toExist();
    }).fail(function(err) {
        expect(err).toBeUndefined();
    }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});

// Use basePkgJson
describe('tests platform/spec restore with --save', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson2');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, '..', 'spec-cordova', 'fixtures', 'basePkgJson'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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

    /** Test#001 will add a platform to package.json with the 'save' flag.
    *   It will remove it from platforms.json without the save flag.
    *   After running cordova prepare, that platform should be restored in the
    *   installed platform list in platforms.json.
    */
    it('Test#001 : should restore platform that has been removed from project', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        cordova_util.requireNoCache(pkgJsonPath);
        var pkgJson;
        var platformsFolderPath = path.join(cwd,'platforms/platforms.json');
        var platformsJson;

        emptyPlatformList().then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', 'android', {'save':true});
        }).then(function() {
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Require platformsFolderPath
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            // Check the platform add was successful in package.json.
            expect(pkgJson.cordova.platforms).toBeDefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            // Expect that "helpers.testPlatform" in the installed platform list in platforms.json
            expect(platformsJson).toBeDefined();
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
        }).then(fullPlatformList) // Platform should still be in platform ls.
        .then(function() {
            // And now remove helpers.testPlatform without --save.
            return cordova.raw.platform('rm', [helpers.testPlatform]);
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platforms.json)
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check that the platform removed without --save is still in platforms key.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            // Check that the platform was removed from the platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of platforms.json.
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list in platforms.json.
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);

    /** Test#002 will add two platforms to package.json with the 'save' flag.
    *   It will remove one platform from pkg.json without the 'save' flag and remove
    *   the other platform with the 'save' flag. After running cordova prepare, 
    *   the platform removed with the 'save' flag should NOT be restored in platforms.json.
    */
    it('Test#002 : should NOT restore platform that was removed with --save', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        var pkgJson;
        var platformsFolderPath = path.join(cwd,'platforms/platforms.json');
        var platformsJson;
        var secondPlatformAdded = 'browser';

        emptyPlatformList().then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Add the 'browser' platform with --save
            return cordova.raw.platform('add',secondPlatformAdded, {'save':true});
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platforms.json).
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            // Check the platform add of both platforms (to pkg.Json) was successful.
            expect(pkgJson.cordova.platforms).toBeDefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toEqual(0);
            expect(pkgJson.cordova.platforms.indexOf(secondPlatformAdded)).toEqual(1);
            // Expect that "helpers.testPlatform" in the installed platform list in platforms.json.
            expect(platformsJson).toBeDefined();
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
            expect(platformsJson[secondPlatformAdded]).toBeDefined();
        }).then(fullPlatformList) // Platform should still be in platform ls.
        .then(function() {
            // Remove helpers.testPlatform with --save.
            return cordova.raw.platform('rm', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Remove secondPlatformAdded without --save.
            return cordova.raw.platform('rm', secondPlatformAdded);
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platformsJson).
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
            // Check that ONLY the platform removed without --save is still in (pkg.json) platforms key.
            expect(pkgJson.cordova.platforms.indexOf(secondPlatformAdded)).toEqual(0);
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toEqual(-1);
            // Check that both platforms were removed from the platforms.json list.
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
            expect(platformsJson[secondPlatformAdded]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare.
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of platformsJson.
            platformsJson = cordova_util.requireNoCache(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list in platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
            // Expect 'browser' not to be in platforms.json and has not been restored.
            expect(platformsJson[secondPlatformAdded]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },TIMEOUT);
});
