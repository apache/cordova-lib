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
    Q = require('q'),
    events = require('cordova-common').events,
    ConfigParser = require('cordova-common').ConfigParser,
    cordova = require('../src/cordova/cordova');

var tmpDir = helpers.tmpDir('create_test');
var appName = 'TestBase';
var appId = 'org.testing';
var project = path.join(tmpDir, appName);

var configSubDirPkgJson = {
    lib: {
        www: {
            template: true,
            url: path.join(__dirname, 'fixtures', 'templates', 'withsubdirectory_package_json'),
            version: ''
        }
    }
};

var configConfigInWww = {
    lib: {
        www: {
            template: true,
            url: path.join(__dirname, 'fixtures', 'templates', 'config_in_www'),
            version: ''
        }
    }
};

var configGit = {
    lib: {
        www: {
            url: 'https://github.com/apache/cordova-app-hello-world',
            template: true,
            version: 'not_versioned'
        }
    }
};

var configNPM = {
    lib: {
        www: {
            template: true,
            url: 'cordova-app-hello-world',
            version: ''
        }
    }
};

describe('cordova create checks for valid-identifier', function(done) {
    it('should reject reserved words from start of id', function(done) {
        cordova.raw.create('projectPath', 'int.bob', 'appName')
        .fail(function(err) {
            expect(err.message).toBe('App id contains a reserved word, or is not a valid identifier.');
        })
        .fin(done);
    });
    
    it('should reject reserved words from end of id', function(done) {
        cordova.raw.create('projectPath', 'bob.class', 'appName')
        .fail(function(err) {
            expect(err.message).toBe('App id contains a reserved word, or is not a valid identifier.');
        })
        .fin(done);
    });
});


describe('create end-to-end', function() {
    //this.timeout(240000);

    beforeEach(function() {
        shell.rm('-rf', project);
        shell.mkdir('-p', tmpDir);
    });


    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    function checkProject() {
        // Check if top level dirs exist.
        var dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function(d) {
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

    function checkConfigXml() {
        // Check if top level dirs exist.
        var dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function(d) {
            expect(path.join(project, d)).toExist();
        });
        expect(path.join(project, 'hooks', 'README.md')).toExist();
        
        //index.js and template subdir folder should not exist (inner files should be copied to the project folder)
        expect(path.join(project, 'index.js')).not.toExist();
        expect(path.join(project, 'template')).not.toExist();

        // Check if www files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();
        var configXml = new ConfigParser(path.join(project, 'www', 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);
        expect(configXml.version()).toEqual('1.0.0');

        // Check that config.xml does not exist outside of www
        expect(path.join(project, 'config.xml')).not.toExist();

        // Check that we got no package.json
        expect(path.join(project, 'package.json')).not.toExist();

        // Check that we got the right config.xml from the template and not stock
        expect(configXml.description()).toEqual('this is the correct config.xml');
    }

    function checkSubDir() {
        // Check if top level dirs exist.
        var dirs = ['hooks', 'platforms', 'plugins', 'www'];
        dirs.forEach(function(d) {
            expect(path.join(project, d)).toExist();
        });
        expect(path.join(project, 'hooks', 'README.md')).toExist();
        
        //index.js and template subdir folder should not exist (inner files should be copied to the project folder)
        expect(path.join(project, 'index.js')).not.toExist();
        expect(path.join(project, 'template')).not.toExist();

        // Check if config files exist.
        expect(path.join(project, 'www', 'index.html')).toExist();

        // Check that config.xml was updated.
        var configXml = new ConfigParser(path.join(project, 'config.xml'));
        expect(configXml.packageName()).toEqual(appId);
        expect(configXml.version()).toEqual('1.0.0');


        // Check that we got package.json (the correct one)
        var pkjson = require(path.join(project, 'package.json'));
        expect(pkjson.name).toEqual(appName.toLowerCase());
        expect(pkjson.valid).toEqual('true');

        // Check that we got the right config.xml
        expect(configXml.description()).toEqual('this is the correct config.xml');
    }

    var results;
    events.on('results', function(res) { results = res; });

    it('should successfully run with Git URL', function(done) {
        // Call cordova create with no args, should return help.
        Q()
            .then(function() {
                // Create a real project
                return cordova.raw.create(project, appId, appName, configGit);
            })
            .then(checkProject)
            .fail(function(err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    }, 60000);

    it('should successfully run with NPM package', function(done) {
        // Call cordova create with no args, should return help.
        Q()
            .then(function() {
                // Create a real project
                return cordova.raw.create(project, appId, appName, configNPM);
            })
            .then(checkProject)
            .fail(function(err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    });
    
    it('should successfully run with template not having a package.json at toplevel', function(done) {
        // Call cordova create with no args, should return help.
        var config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'fixtures', 'templates', 'nopackage_json'),
                    version: ''
                }
            }
        };
        Q()
            .then(function() {
                // Create a real project
                return cordova.raw.create(project, appId, appName, config);
            })
            .then(checkProject)
            .then(function(){
                // Check that we got the right config.xml
                var configXml = new ConfigParser(path.join(project, 'config.xml'));
                expect(configXml.description()).toEqual('this is the very correct config.xml');
            })
            .fail(function(err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    });
    
    it('should successfully run with template having package.json and no sub directory', function(done) {
        // Call cordova create with no args, should return help.
        var config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'fixtures', 'templates', 'withpackage_json'),
                    version: ''
                }
            }
        };
        Q()
            .then(function() {
                // Create a real project
                return cordova.raw.create(project, appId, appName, config);
            })
            .then(checkProject)
            .fail(function(err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    });
    
    it('should successfully run with template having package.json, and subdirectory, and no package.json in subdirectory', function(done) {
        // Call cordova create with no args, should return help.
        var config = {
            lib: {
                www: {
                    template: true,
                    url: path.join(__dirname, 'fixtures', 'templates', 'withsubdirectory'),
                    version: ''
                }
            }
        };
        Q()
            .then(function() {
                // Create a real project
                return cordova.raw.create(project, appId, appName, config);
            })
            .then(checkProject)
            .fail(function(err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    });


    it('should successfully run with template having package.json, and subdirectory, and package.json in subdirectory', function(done) {
        // Call cordova create with no args, should return help.
        var config = configSubDirPkgJson;
        Q()
            .then(function() {
                // Create a real project
                project = project + '1';
                return cordova.raw.create(project, appId, appName, config);
            })
            .then(checkSubDir)
            .fail(function(err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    });

    it('should successfully run config.xml in the www folder', function(done) {
        // Call cordova create with no args, should return help.
        var config = configConfigInWww;
        Q()
            .then(function() {
                // Create a real project
                project = project + '2';
                return cordova.raw.create(project, appId, appName, config);
            })
            .then(checkConfigXml)
            .fail(function(err) {
                console.log(err && err.stack);
                expect(err).toBeUndefined();
            })
            .fin(done);
    });


});
