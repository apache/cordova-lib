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
    fs = require('fs'),
    shell = require('shelljs'),
    cordova_util = ('../src/cordova/util'),
    cordova = require('../src/cordova/cordova');


describe('cocoapod plugin add and rm end-to-end', function () {

    var tmpDir = helpers.tmpDir('cocoapod_plugin_test');
    var project = path.join(tmpDir, 'hello4');

    var samplePlugin = path.join(__dirname, 'fixtures', 'plugins', 'sample-cordova-plugin-cocoapod-dependent');
    var overlappingDependencyPlugin = path.join(__dirname, 'fixtures', 'plugins', 'sample-cocoapod-plugin-overlapping-dependency');
    var AFNetworking = 'AFNetworking',
        CWStatusBarNotification = 'CWStatusBarNotification';
    var podfile, podsJSON, workspace;

    beforeEach(function() {
        process.chdir(tmpDir);
    });

    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    it('Test 001 : installs and uninstalls plugin depending on new pod and existing pod', function(done) {

        cordova.create('hello4')
        .then(function() {
            process.chdir(project);
            return cordova.platform('add', 'https://git-wip-us.apache.org/repos/asf/cordova-ios.git');
        })
        .then(function() {
            return cordova.plugin('add', samplePlugin);
        })
        .then(function() {
            podfile = path.resolve('./platforms/ios/Podfile');
            podsJSON = path.resolve('./platforms/ios/pods.json');
            workspace = path.resolve('./platforms/ios/HelloCordova.xcworkspace');

            //podfile should have been created
            fs.exists(podfile, function(podfileExists){
                expect(podfileExists);
            });

            //pods.json should have been created
            fs.exists(podsJSON, function(podsJSONExists){
                expect(podsJSONExists);
            });

            //workspace should have been created
            fs.exists(workspace, function(workspaceCreated){
                expect(workspaceCreated);
            });

            var podfileContent = fs.readFileSync(podfile, {'encoding' : 'utf8'});
            expect(podfileContent.indexOf(AFNetworking) !== -1 );

            var podsJSONContent = require(podsJSON);
            expect(podsJSONContent[AFNetworking] !== null);

            return cordova.plugin('add', overlappingDependencyPlugin);
        })
        .then(function() {
            var podfileContent = fs.readFileSync(podfile, {'encoding' : 'utf8'});
            var numberOfTimesAFNetworkingIsInPodfile = podfileContent.match(/AFNetworking/g || []).length;

            expect(podfileContent.indexOf(CWStatusBarNotification) !== -1);
            expect(numberOfTimesAFNetworkingIsInPodfile).toEqual(1); 

            var podsJSONContent = cordova_util.requireNoCache(podsJSON);

            var countPropertyOfAFNetworkingInPodsJSON = podsJSONContent[AFNetworking].count;
            var specPropertyOfAFNetworkingInPodsJSON = podsJSONContent[AFNetworking].spec;

            expect(countPropertyOfAFNetworkingInPodsJSON).toEqual(2);
            //spec property should not be changed because of overlapping dependency
            expect(specPropertyOfAFNetworkingInPodsJSON).toEqual('~> 3.0');

            return cordova.plugin('rm','sample-cocoapod-plugin-overlapping-dependency');
        })
        .then(function() {
            //expect only AFNetworking
            var podfileContent = fs.readFileSync(podfile, {'encoding' : 'utf8'}); 

            expect(podfileContent.indexOf(CWStatusBarNotification) === -1);
            expect(podfileContent.indexOf(AFNetworking) !== -1);
  
            var podsJSONContent = cordova_util.requireNoCache(podsJSON);

            expect(podsJSONContent[AFNetworking]);
            expect(podsJSONContent[CWStatusBarNotification] === undefined);

            return cordova.plugin('rm', 'sample-cordova-plugin-cocoapod-dependent');
        })
        .then(function() {
            //expect no pods 
            cordova_util.requireNoCache(podfile);
            var podfileContent = fs.readFileSync(podfile, {'encoding' : 'utf8'}); 

            expect(podfileContent.indexOf(CWStatusBarNotification) === -1);
            expect(podfileContent.indexOf(AFNetworking) === -1);

            var podsJSONContent = cordova_util.requireNoCache(podsJSON);

            expect(podsJSONContent[AFNetworking] === undefined);
            expect(podsJSONContent[CWStatusBarNotification] === undefined);
        })
        .fail(function(err) {
            console.error(err);
            expect(err).toBeUndefined();
        })
        .fin(done);
    }, 60000); 
});
