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

/* jshint boss:true */

/**
var androidParser = require('../../src/cordova/metadata/android_parser'),
    util = require('../../src/cordova/util'),
    path = require('path'),
    shell = require('shelljs'),
    fs = require('fs'),
    et = require('elementtree'),
    xmlHelpers = require('cordova-common').xmlHelpers,
    config = require('../../src/cordova/config'),
    Parser = require('../../src/cordova/metadata/parser'),
    ConfigParser = require('cordova-common').ConfigParser,
    CordovaError = require('cordova-common').CordovaError;

// Create a real config object before mocking out everything.
var cfg = new ConfigParser(path.join(__dirname, '..', 'test-config.xml'));
var cfg2 = new ConfigParser(path.join(__dirname, '..', 'test-config-2.xml'));

var STRINGS_XML = '<resources> <string name="app_name">mobilespec</string> </resources>';
var MANIFEST_XML = '<manifest android:versionCode="1" android:versionName="0.0.1" package="org.apache.mobilespec">\n' +
    '<application android:hardwareAccelerated="true" android:icon="@drawable/icon" android:label="@string/app_name">\n' +
    '    <activity android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale" android:label="@string/app_name" android:name="mobilespec" android:screenOrientation="VAL">\n' +
    '        <intent-filter>\n' +
    '            <action android:name="android.intent.action.MAIN" />\n' +
    '            <category android:name="android.intent.category.LAUNCHER" />\n' +
    '        </intent-filter>\n' +
    '    </activity>\n' +
    '</application>\n' +
    '</manifest>\n';

describe('android project parser', function() {
    var proj = path.join('some', 'path');
    var android_proj = path.join(proj, 'platforms', 'android');
    var exists;
    beforeEach(function() {
        exists = spyOn(fs, 'existsSync').and.returnValue(true);
        spyOn(config, 'has_custom_path').and.returnValue(false);
    });

    function errorWrapper(p, done, post) {
        p.then(function() {
            expect('this call').toBe('fail');
        }, post).fin(done);
    }

    describe('constructions', function() {
        it('should throw if provided directory does not contain an AndroidManifest.xml', function() {
            exists.and.returnValue(false);
            expect(function() {
                new androidParser(android_proj);
            }).toThrow();
        });
        it('should create an instance with path, strings, manifest and android_config properties', function() {
            expect(function() {
                var p = new androidParser(android_proj);
                expect(p.path).toEqual(android_proj);
                expect(p.strings).toEqual(path.join(android_proj, 'res', 'values', 'strings.xml'));
                expect(p.manifest).toEqual(path.join(android_proj, 'AndroidManifest.xml'));
                expect(p.android_config).toEqual(path.join(android_proj, 'res', 'xml', 'config.xml'));
            }).not.toThrow();
        });
        it('should be an instance of Parser', function() {
            expect(new androidParser(android_proj) instanceof Parser).toBe(true);
        });
        it('should call super with the correct arguments', function() {
            var call = spyOn(Parser, 'call');
            var p = new androidParser(android_proj);
            expect(call).toHaveBeenCalledWith(p, 'android', android_proj);
        });
    });

    describe('instance', function() {
        var p, cp, rm, mkdir, is_cordova, write, read, getOrientation;
        var stringsRoot;
        var manifestRoot;
        beforeEach(function() {
            stringsRoot = null;
            manifestRoot = null;
            p = new androidParser(android_proj);
            cp = spyOn(shell, 'cp');
            rm = spyOn(shell, 'rm');
            is_cordova = spyOn(util, 'isCordova').and.returnValue(android_proj);
            write = spyOn(fs, 'writeFileSync');
            read = spyOn(fs, 'readFileSync');
            mkdir = spyOn(shell, 'mkdir');
            spyOn(xmlHelpers, 'parseElementtreeSync').and.callFake(function(path) {
                if (/strings/.exec(path)) {
                    return stringsRoot = new et.ElementTree(et.XML(STRINGS_XML));
                } else if (/AndroidManifest/.exec(path)) {
                    return manifestRoot = new et.ElementTree(et.XML(MANIFEST_XML));
                } else {
                    throw new CordovaError('Unexpected parseElementtreeSync: ' + path);
                }
            });
            getOrientation = spyOn(p.helper, 'getOrientation');
        });

        describe('update_from_config method', function() {
            beforeEach(function() {
                spyOn(fs, 'readdirSync').and.returnValue([ path.join(android_proj, 'src', 'android_pkg', 'MyApp.java') ]);
                cfg.name = function() { return 'testname'; };
                cfg.packageName = function() { return 'testpkg'; };
                cfg.version = function() { return 'one point oh'; };
                read.and.returnValue('package org.cordova.somepackage; public class MyApp extends CordovaActivity { }');
            });

            it('should write out the orientation preference value', function() {
                getOrientation.and.callThrough();
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().find('./application/activity').attrib['android:screenOrientation']).toEqual('landscape');
            });
            it('should handle no orientation', function() {
                getOrientation.and.returnValue('');
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().find('./application/activity').attrib['android:screenOrientation']).toBeUndefined();
            });
            it('should handle default orientation', function() {
                getOrientation.and.returnValue(p.helper.ORIENTATION_DEFAULT);
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().find('./application/activity').attrib['android:screenOrientation']).toBeUndefined();
            });
            it('should handle portrait orientation', function() {
                getOrientation.and.returnValue(p.helper.ORIENTATION_PORTRAIT);
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().find('./application/activity').attrib['android:screenOrientation']).toEqual('portrait');
            });
            it('should handle landscape orientation', function() {
                getOrientation.and.returnValue(p.helper.ORIENTATION_LANDSCAPE);
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().find('./application/activity').attrib['android:screenOrientation']).toEqual('landscape');
            });
            it('should handle sensorLandscape orientation', function() {
                getOrientation.and.returnValue(p.helper.ORIENTATION_SENSOR_LANDSCAPE);
                p.update_from_config(cfg2);
                expect(manifestRoot.getroot().find('./application/activity').attrib['android:screenOrientation']).toEqual('sensorLandscape');
            });
            it('should handle custom orientation', function() {
                getOrientation.and.returnValue('some-custom-orientation');
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().find('./application/activity').attrib['android:screenOrientation']).toEqual('some-custom-orientation');
            });
            it('should write out the app name to strings.xml', function() {
                p.update_from_config(cfg);
                expect(stringsRoot.getroot().find('string').text).toEqual('testname');
            });
            it('should write out the app id to androidmanifest.xml and update the cordova-android entry Java class', function() {
                cfg.android_packageName = function () { return null; };
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().attrib.package).toEqual('testpkg');
            });
            it('should write out the app id to androidmanifest.xml and update the cordova-android entry Java class with android_packageName', function() {
                cfg.android_packageName = function () { return 'testpkg_android'; };
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().attrib.package).toEqual('testpkg_android');
            });
            it('should write out the app version to androidmanifest.xml', function() {
                p.update_from_config(cfg);
                expect(manifestRoot.getroot().attrib['android:versionName']).toEqual('one point oh');
            });
        });
        describe('www_dir method', function() {
            it('should return assets/www', function() {
                expect(p.www_dir()).toEqual(path.join(android_proj, 'assets', 'www'));
            });
        });
        describe('config_xml method', function() {
            it('should return the location of the config.xml', function() {
                expect(p.config_xml()).toEqual(p.android_config);
            });
        });
        describe('update_www method', function() {
            it('should rm project-level www and cp in platform agnostic www', function() {
                p.update_www();
                expect(rm).toHaveBeenCalled();
                expect(cp).toHaveBeenCalled();
            });
        });
        describe('update_overrides method', function() {
            it('should do nothing if merges directory does not exist', function() {
                exists.and.returnValue(false);
                p.update_overrides();
                expect(cp).not.toHaveBeenCalled();
            });
            it('should copy merges path into www', function() {
                p.update_overrides();
                expect(cp).toHaveBeenCalled();
            });
        });
        describe('update_project method', function() {
            var config, www, overrides, svn;
            beforeEach(function() {
                config = spyOn(p, 'update_from_config');
                www = spyOn(p, 'update_www');
                overrides = spyOn(p, 'update_overrides');
                svn = spyOn(util, 'deleteSvnFolders');
            });
            it('should call update_from_config', function() {
                p.update_project();
                expect(config).toHaveBeenCalled();
            });
            it('should throw if update_from_config throws', function(done) {
                var err = new Error('uh oh!');
                config.and.callFake(function() { throw err; });
                errorWrapper(p.update_project({}), done, function(err) {
                    expect(err).toEqual(err);
                });
            });
            it('should not call update_www', function() {
                p.update_project();
                expect(www).not.toHaveBeenCalled();
            });
            it('should call update_overrides', function() {
                p.update_project();
                expect(overrides).toHaveBeenCalled();
            });
            it('should call deleteSvnFolders', function() {
                p.update_project();
                expect(svn).toHaveBeenCalled();
            });
        });
    });
});
*/