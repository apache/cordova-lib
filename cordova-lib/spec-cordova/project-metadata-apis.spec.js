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

var cordova = require('../src/cordova/cordova'),
    helpers = require('./helpers'),
    shell   = require('shelljs'),
    path    = require('path');

describe('retrieval of project metadata', function(){

    var appId = 'org.testing';
    var appName = 'ProjectMetadataRetrievalTests';

    var configNormal = {
        lib: {
            www: {
                url: path.join(__dirname, 'fixtures', 'base', 'www'),
                version: 'testProjectMetadataRetrieval',
                id: appName
            }
        }
    };

    var tmpDir = helpers.tmpDir('project_metadata_test');
    var projectRoot = path.join(tmpDir, appName);

    beforeEach(function(){
        shell.rm('-rf', tmpDir);
        shell.rm('-rf', projectRoot);
        shell.mkdir('-p', tmpDir);
    });

    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Windows: Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });
    
    it('retrieve platforms and plugins saved in config.xml', function(done){
        var devicePlugin = 'org.apache.cordova.device@0.2.11'; 
        var androidPlatform = 'android@3.7.0';

        process.chdir(tmpDir);

        // create a project
        cordova.raw.create(projectRoot, appId, appName, configNormal).then(function(){
            // save platforms into config.xml
            process.chdir(projectRoot);
            return cordova.raw.platform('add', androidPlatform, {save: true}).then(function(){
                return cordova.raw.plugin('add', devicePlugin, {save: true});
            });
        }).then(function(){
            return cordova.raw.getProjectMetadata('platforms', projectRoot);
        }).then(function(platforms){
            // Verify platform retrieval
            expect(platforms.length).toBe(1);            
            var platform = platforms[0];
            var retrievedPlatform =  platform.name + '@' + platform.version;
            expect(retrievedPlatform).toBe(androidPlatform);
        }).then(function(){
            return cordova.raw.getProjectMetadata('plugins', projectRoot);
        }).then(function(plugins){
            // Verify plugin retrieval            
            expect(plugins.length).toBe(1);            
            var plugin = plugins[0];
            var retrievedPlugin =  plugin.id + '@' + plugin.version;
            expect(retrievedPlugin).toBe(devicePlugin);
        }).fin(done);
    }, 60000);
});
