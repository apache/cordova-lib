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

/** Testing will check if "cordova prepare" is restoring platforms and plugins as expected.
*   Uses different basePkgJson files depending on testing expecations of what (platforms/plugins/variables)
*   should initially be in pkg.json and/or config.xml.
*/

// Use basePkgJson
describe('platform end-to-end with --save', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#001 will add a platform to package.json with the 'save' flag.
    *   It will remove it from platforms.json without the save flag.
    *   After running cordova prepare, that platform should be restored in the
    *   installed platform list in platforms.json.
    */
    it('Test#001 : should restore platform that has been removed from project', function(done) {
        var cwd = process.cwd();
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var pkgJson;
        var platformsFolderPath = path.join(cwd,'platforms/platforms.json');
        var platformsJson;

        emptyPlatformList().then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Require platformsFolderPath
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
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
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check that the platform removed without --save is still in platforms key.
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toBeGreaterThan(-1);
            // Check that the platform was removed from the platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of platforms.json
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list in platforms.json.
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);

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
        var secondPlatformAdded = 'ios';
    
        emptyPlatformList().then(function() {
            // Add the testing platform with --save.
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Add the 'ios' platform with --save
            return cordova.raw.platform('add',secondPlatformAdded, {'save':true});
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platforms.json)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Check the platform add of both platforms (to pkg.Json) was successful.
            expect(pkgJson.cordova.platforms).toBeDefined();
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toEqual(0);
            expect(pkgJson.cordova.platforms.indexOf(secondPlatformAdded)).toEqual(1);
            // Expect that "helpers.testPlatform" in the installed platform list in platforms.json
            expect(platformsJson).toBeDefined();
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
            expect(platformsJson[secondPlatformAdded]).toBeDefined();
        }).then(fullPlatformList) // Platform should still be in platform ls.
          .then(function() {
            // Remove helpers.testPlatform with --save.
            return cordova.raw.platform('rm', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Remove secondPlatformAdded without --save
            return cordova.raw.platform('rm', secondPlatformAdded);
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platformsJson)
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Check that ONLY the platform removed without --save is still in (pkg.json) platforms key.
            expect(pkgJson.cordova.platforms.indexOf(secondPlatformAdded)).toEqual(0);
            expect(pkgJson.cordova.platforms.indexOf(helpers.testPlatform)).toEqual(-1);
            // Check that both platforms were removed from the platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
            expect(platformsJson[secondPlatformAdded]).toBeUndefined();
        }).then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of platformsJson
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list in platforms.json
            expect(platformsJson[helpers.testPlatform]).toBeUndefined();
            // Expect 'ios' not to be in platforms.json and has not been restored.
            expect(platformsJson[secondPlatformAdded]).toBeDefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);

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
        var secondPlatformAdded = 'ios';
        var platformsJson;

        emptyPlatformList().then(function() {
            // Add 'ios' platform to project without --save
            return cordova.raw.platform('add', secondPlatformAdded);
        }).then(function() {
            // Add helpers.testPlatform to project with --save
            return cordova.raw.platform('add', [helpers.testPlatform], {'save':true});
        }).then(function() {
            // Delete any previous caches of require(package.json) and (platformsJson)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
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
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
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
            delete require.cache[require.resolve(platformsFolderPath)];
            platformsJson = require(platformsFolderPath);
            // Expect "helpers.testPlatform" to be in the installed platforms list.
            expect(platformsJson[helpers.testPlatform]).toBeDefined();
            // Expect that 'ios' will not be in platforms.json and has not been restored.
            expect(platformsJson[secondPlatformAdded]).toBeUndefined();
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
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
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson6'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson6'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
        // Pkg.json and config.xml contain only android at this point (basePkgJson6)
        emptyPlatformList().then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Expect android to be in both pkg.json and config.xml
            expect(pkgJson.cordova.platforms.indexOf('android')).toBeGreaterThan(-1);
            expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
            // Expect pkg.json and config.xml to have only 1 element each
            expect(configEngArray.length === 1);
            expect(pkgJson.cordova.platforms.length === 1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
});

// Use a new basePkgJson5 as config.xml contains android/ios and pkg.json contains android
describe('update pkg.json to include platforms in config.xml', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson5'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson5'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#005 will check the platform list in package.json and config.xml. 
    *   When config.xml has 'android and ios' and pkg.json only contains 'android', run cordova
    *   and pkg.json is updated to include 'ios'.
    */
    it('Test#005 : if config.xml has android & ios platforms and pkg.json has android, update pkg.json to also include ios', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg = new ConfigParser(configXmlPath);
        var engines = cfg.getEngines();
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var pkgJson = require(pkgJsonPath);
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();
       
        // Config.xml contains(android & ios) and pkg.json contains android (basePkgJson5)
        expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
        expect(configEngArray.indexOf('ios')).toBeGreaterThan(-1);
        // pkg.json should not contain 'ios' platform before cordova prepare
        expect(pkgJson.cordova.platforms.indexOf('ios')).toEqual(-1);
        expect(pkgJson.cordova.platforms.indexOf('android')).toBeGreaterThan(-1);
        emptyPlatformList().then(function() {
            return cordova.raw.prepare();
        }).then(function() {
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Expect 'ios' to be added to pkg.json
            expect(pkgJson.cordova.platforms.indexOf('ios')).toBeGreaterThan(-1);
            // Expect 'android' to still be there in pkg.json
            expect(pkgJson.cordova.platforms.indexOf('android')).toBeGreaterThan(-1);
            // Expect both pkg.json and config.xml to each have both platforms in their arrays
            expect(configEngArray.length === 2);
            expect(pkgJson.cordova.platforms.length === 2);
            // No changes to config.xml
            expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
            expect(configEngArray.indexOf('ios')).toBeGreaterThan(-1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
});

// Use basePkgJson3 as it has 'android' in config.xml
describe('update empty package.json to match config.xml', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson3'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson3'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#006 will check if pkg.json has a cordova key and platforms installed already.
     *   If it does not and config.xml has a platform(s) installed already, run cordova prepare
     *   and it will add a cordova key and the platform(s) from config.xml to package.json.
     */
    it('Test#006 : if pkg.json exists without cordova key, create one with same platforms in config.xml ', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var cfg1 = new ConfigParser(configXmlPath);
        var engines = cfg1.getEngines();
        var pkgJson = require(pkgJsonPath);
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();
    
        // Expect that pkg.json exists without a cordova key
        expect(pkgJson).toBeDefined();
        expect(pkgJson.cordova).toBeUndefined();
        // Expect that config.xml contains only android at this point
        expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
        expect(configEngArray.length === 1);
        // Run cordova prepare
        cordova.raw.prepare();
        emptyPlatformList().then(function() {
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Delete any previous caches of require(package.json)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            // Expect no change to config.xml
            expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
            // Expect cordova key and 'android' platform to be added to pkg.json
            expect(pkgJson.cordova.platforms.indexOf('android')).toBeGreaterThan(-1);
            // Expect both pkg.json and config.xml to each have (only) android in their arrays
            expect(configEngArray.length === 1);
            expect(pkgJson.cordova.platforms.length === 1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
});

// Use a new basePkgJson4 as pkg.json contains android/ios and config.xml contains android
describe('update config.xml to include platforms in pkg.json', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson4'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson4'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#007 will check the platform list in package.json and config.xml. 
    *   When packge.json has 'android and ios' and config.xml only contains 'android', run cordova
    *   and config.xml is updated to include 'ios'.
    */
    it('Test#007 : if pkgJson has android & ios platforms and config.xml has android, update config to also include ios', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var cfg1 = new ConfigParser(configXmlPath);
        var engines = cfg1.getEngines();
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var pkgJson = require(pkgJsonPath);
        var engNames = engines.map(function(elem) {
            return elem.name;
        });
        var configEngArray = engNames.slice();

        // Expect that config.xml contains only android at this point (basePjgJson4)
        expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
        expect(configEngArray.indexOf('ios')).toEqual(-1);
        expect(configEngArray.length === 1);
       
        emptyPlatformList().then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            engines = cfg2.getEngines();
            engNames = engines.map(function(elem) {
                return elem.name;
            });
            configEngArray = engNames.slice();
            // Expect 'ios' to be added to config.xml
            expect(configEngArray.indexOf('ios')).toBeGreaterThan(-1);
            // Expect 'android' to still be in config.xml
            expect(configEngArray.indexOf('android')).toBeGreaterThan(-1);
            // Expect config.xml array to have 2 elements (platforms);
            expect(configEngArray.length === 2);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
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
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson8'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson8'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#011 will check the plugin/variable list in package.json and config.xml. 
    *   When pkg.json and config.xml have the same variables, but different values,
    *   pkg.json should win and that value will be used and replaces config's value.
    */
    it('Test#011 : if pkg.Json has 1 plugin and 1 variable, update config.xml to include these variables', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var configPlugin = cfg1.getPlugin(configPlugins);
        var configPluginVariables = configPlugin.variables;
        var pkgJson = require(pkgJsonPath);

        // Expect that pkg.json exists with 1 plugin, 1 variable, and a different value (json)
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 1);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'json' });
        // Expect that config.xml exists with 1 plugin, 1 variable, but a different value (config)
        expect(configPlugin.name).toEqual('cordova-plugin-camera');
        expect(configPluginVariables).toEqual({ variable_1: 'config' });
        expect(Object.keys(configPlugin).length === 1);

        emptyPlatformList().then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // // Delete any previous caches of require(package.json)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();
            configPlugin = cfg2.getPlugin(configPlugins);
            configPluginVariables = configPlugin.variables;
            // Expect that pkg.json exists with 1 plugin, 1 variable, and the pkg.json value
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(Object.keys(pkgJson.cordova.plugins).length === 1);
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'json' });
            // Expect that config.xml exists with 1 plugin, 1 variable and pkg.json's value
            expect(configPlugin.name).toEqual('cordova-plugin-camera');
            expect(configPluginVariables).toEqual({ variable_1: 'json' });
            expect(Object.keys(configPlugin).length === 1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
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
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson9'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson9'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#012 will check the plugin/variable list in package.json and config.xml. 
    *   When config.xml has a 'camera plugin and 1 variable' and pkg.json has 1 plugins/0 variables,
    *   cordova prepare runs and will update pkg.json to match config.xml's plugins/variables.
    */
    it('Test#012 : if pkg.Json has 1 plugin and 2 variables, update config.xml to include these plugins/variables', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var configPlugin = cfg1.getPlugin(configPlugins);
        var configPluginVariables = configPlugin.variables;
        var pkgJson = require(pkgJsonPath);

        // Expect that pkg.json exists with 1 plugin
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 1);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
        expect(pkgJson.cordova.plugins).toEqual({ 'cordova-plugin-camera': {} });

        // Expect that config.xml exists with 1 plugin and 1 variable
        expect(configPlugin.name).toEqual('cordova-plugin-camera');
        expect(configPluginVariables).toEqual({ variable_1: 'value_1' });
        expect(Object.keys(configPlugin).length === 1);

        emptyPlatformList().then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of require(package.json)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();
            configPlugin = cfg2.getPlugin(configPlugins);
            configPluginVariables = configPlugin.variables;
            // Expect that pkg.json exists with 1 plugin, 1 variable, and 1 value
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(Object.keys(pkgJson.cordova.plugins).length === 1);
            expect(pkgJson.cordova.plugins).toEqual({ 'cordova-plugin-camera': { variable_1: 'value_1' } });
            // Expect that config.xml exists with 1 plugin, 1 variable and 1 value
            expect(configPlugin.name).toEqual('cordova-plugin-camera');
            expect(configPluginVariables).toEqual({ variable_1: 'value_1' });
            expect(Object.keys(configPlugin).length === 1);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
});

// Use basePkgJson10 as pkg.json contains (camera plugin: var 1/var 2, splashscreen plugin) 
// and config contains (camera plugin: var 3, value 1, device plugin)
describe('update pkg.json AND config.xml to include all plugins and merge variables', function () {
    var tmpDir = helpers.tmpDir('plugin_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson10'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson10'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#013 will check the plugin/variable list in package.json and config.xml. 
    *   For plugins that are the same, it will merge their variables together for the final list.
    *   Plugins that are unique to that file, will be copied over to the file that is missing it.
    *   Config.xml and pkg.json will have identical plugins and variables after cordova prepare.
    */
    it('Test#013 : update pkg.json AND config.xml to include all plugins and merge unique variables', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var pkgJson = require(pkgJsonPath);
        var configPlugin;
        var configPluginVariables;

        // Config.xml has 2 plugins and does not have device yet
        expect(Object.keys(configPlugins).length === 2);
        expect(configPlugins.indexOf('cordova-plugin-device')).toEqual(-1);
        expect(configPlugins.indexOf('cordova-plugin-camera')).toEqual(0);
        expect(configPlugins.indexOf('cordova-plugin-splashscreen')).toEqual(1);
        // Config.xml camera plugin has var_3,value_3 and splashscreen has 0 variables
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
        // Splashscreen has no variables and camera has var 1 and var 2 and device has var1, value1
        expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toEqual({});
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: ' ', variable_2: ' ' });
        expect(pkgJson.cordova.plugins['cordova-plugin-device']).toEqual({ variable_1: 'value_1' });

        emptyPlatformList().then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
         }).then(function() {
            // Delete any previous caches of require(package.json)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();

            // Check to make sure that variables were added as expected
            for (var i = 0; i < configPlugins.length; i++) {
                configPlugin = cfg2.getPlugin(configPlugins[i]);
                configPluginVariables = configPlugin.variables;
                // Config.xml camera variables have been merged, no duplicates
                if(configPlugin.name === 'cordova-plugin-camera') {
                    expect(configPluginVariables).toEqual({ variable_1: ' ', 
                    variable_2: ' ', variable_3: 'value_3' });
                }
                // Expect that device has var1, val1 and splashscreen has 0 var
                if(configPlugin.name === 'cordova-plugin-device') {
                    expect(configPluginVariables).toEqual({ variable_1: 'value_1'});
                }
                if(configPlugin.name === 'cordova-plugin-splashscreen') {
                    expect(configPluginVariables).toEqual({});
                }
            }
            // Expect pkg.json to have the variables from config.xml
            expect(Object.keys(pkgJson.cordova.plugins).length === 3);
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-device']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: ' ', variable_2: ' ', variable_3: 'value_3' });
            // Expect config.xml to have the plugins from pkg.json
            expect(Object.keys(configPlugins).length === 3);
            expect(configPlugins.indexOf('cordova-plugin-camera')).toEqual(0);
            expect(configPlugins.indexOf('cordova-plugin-device')).toEqual(1);
            expect(configPlugins.indexOf('cordova-plugin-splashscreen')).toEqual(2);
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
});

// Use basePkgJson11 as pkg.json contains(splashscreen plugin, camera plugin: var1, value1, var2, value2) and
// config.xml contains (device plugin, camera plugin: var1, value 1, var2, value 2)
describe('update pkg.json AND config.xml to include all plugins/merge variables and check for duplicates', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson11'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson11'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#014 will check the plugin/variable list in package.json and config.xml. 
    *   If either file is missing a plugin, it will be added with the correct variables.
    *   If there is a matching plugin name, the variables will be merged and then added
    *   to config and pkg.json. 
    */
    it('Test#014 : update pkg.json AND config.xml to include all plugins and merge variables (no dupes)', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var pkgJson = require(pkgJsonPath);
        var configPlugin;
        var configPluginVariables;

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
            }
            if(configPlugin.name === 'cordova-plugin-device') {
                expect(configPluginVariables).toEqual({});
            }
        }
        // Expect that pkg.json exists with 2 plugins
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 2);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
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
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
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
                }
                // Expect that splashscreen and device have 0 variables
                if(configPlugin.name === 'cordova-plugin-device') {
                    expect(configPluginVariables).toEqual({});
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
            // Pkg.json has all 3 plugins
            expect(Object.keys(pkgJson.cordova.plugins).length === 3);
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-device']).toBeDefined();
            // Expect that splashscreen and device have 0 variables
            expect(pkgJson.cordova.plugins['cordova-plugin-splashscreen']).toEqual({});
            expect(pkgJson.cordova.plugins['cordova-plugin-device']).toEqual({});
            // Expect that the variables from config have been merged with the variables 
            // from pkg.json to the camera plugin
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'value_1',
            variable_3: 'value_3', variable_2: 'value_2' });
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
});

// Use basePkgJson12 as config.xml has 0 plugins and pkg.json has 1
describe('update config.xml to include the plugin that is in pkg.json', function () {
    var tmpDir = helpers.tmpDir('platform_test_pkgjson');
    var project = path.join(tmpDir, 'project');
    var results;

    beforeEach(function() {
        shell.rm('-rf', tmpDir);
        // Copy then move because we need to copy everything, but that means it will copy the whole directory.
        // Using /* doesn't work because of hidden files.
        shell.cp('-R', path.join(__dirname, 'fixtures', 'basePkgJson12'), tmpDir);
        shell.mv(path.join(tmpDir, 'basePkgJson12'), project);
        process.chdir(project);
        events.on('results', function(res) { results = res; });
    });

    afterEach(function() {
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
    /** Test#015 will check the plugin/variable list in package.json and config.xml. 
    *   When config has 0 plugins, it will get updated with the plugins from
    *   pkg.json.
    */
    it('Test#015 : update config.xml to include all plugins/variables from pkg.json', function(done) {
        var cwd = process.cwd();
        var configXmlPath = path.join(cwd, 'config.xml');
        var pkgJsonPath = path.join(cwd,'package.json');
        delete require.cache[require.resolve(pkgJsonPath)];
        var cfg1 = new ConfigParser(configXmlPath);
        var configPlugins = cfg1.getPluginIdList();
        var pkgJson = require(pkgJsonPath);
        var configPlugin;
        var configPluginVariables;
        // Config.xml is initially empty and has no plugins
        expect(Object.keys(configPlugins).length === 0);
        // Expect that pkg.json exists with 1 plugin
        expect(pkgJson.cordova.plugins).toBeDefined();
        expect(Object.keys(pkgJson.cordova.plugins).length === 1);
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
        // Pkg.json camera plugin has var1, value 1
        expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'value_1' });

        emptyPlatformList().then(function() {
            // Run cordova prepare
            return cordova.raw.prepare();
        }).then(function() {
            // Delete any previous caches of require(package.json)
            delete require.cache[require.resolve(pkgJsonPath)];
            pkgJson = require(pkgJsonPath);
            var cfg2 = new ConfigParser(configXmlPath);
            configPlugins = cfg2.getPluginIdList();

            // Check to make sure that the variables were added as expected
            for (var i = 0; i < configPlugins.length; i++) {
                configPlugin = cfg2.getPlugin(configPlugins[i]);
                configPluginVariables = configPlugin.variables;
                // Config.xml camera variables have been added
                if(configPlugin.name === 'cordova-plugin-camera') {
                    expect(configPluginVariables).toEqual({ variable_1: 'value_1' });
                }
            }
            // Config.xml now has the camera plugin
            expect(Object.keys(configPlugins).length === 1);
            expect(configPlugins.indexOf('cordova-plugin-camera')).toEqual(0);
            // No changes to pkg.json
            expect(Object.keys(pkgJson.cordova.plugins).length === 1);
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toBeDefined();
            expect(pkgJson.cordova.plugins['cordova-plugin-camera']).toEqual({ variable_1: 'value_1' });
        }).fail(function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    // Cordova prepare needs extra wait time to complete.
    },30000);
});


