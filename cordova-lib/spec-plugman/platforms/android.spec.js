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
var android = require('../../src/plugman/platforms/android'),
    android_project = require('../../src/plugman/util/android-project'),
    common  = require('../../src/plugman/platforms/common'),
    install = require('../../src/plugman/install'),
    path    = require('path'),
    fs      = require('fs'),
    shell   = require('shelljs'),
    et      = require('elementtree'),
    os      = require('osenv'),
    _       = require('underscore'),
    temp    = path.join(os.tmpdir(), 'plugman'),
    plugins_dir = path.join(temp, 'cordova', 'plugins'),
    xml_helpers = require('../../src/util/xml-helpers'),
    plugins_module = require('../../src/plugman/util/plugins'),
    dummyplugin = path.join(__dirname, '..', 'plugins', 'DummyPlugin'),
    faultyplugin = path.join(__dirname, '..', 'plugins', 'FaultyPlugin'),
    variableplugin = path.join(__dirname, '..', 'plugins', 'VariablePlugin'),
    android_one_project = path.join(__dirname, '..', 'projects', 'android_one', '*'),
    android_two_project = path.join(__dirname, '..', 'projects', 'android_two', '*');

var xml_path     = path.join(dummyplugin, 'plugin.xml')
  , xml_text     = fs.readFileSync(xml_path, 'utf-8')
  , plugin_et    = new et.ElementTree(et.XML(xml_text));

var platformTag = plugin_et.find('./platform[@name="android"]');
var dummy_id = plugin_et._root.attrib['id'];
var valid_source = platformTag.findall('./source-file'),
    valid_libs = platformTag.findall('./lib-file'),
    valid_resources = platformTag.findall('./resource-file'),
    assets = plugin_et.findall('./asset'),
    configChanges = platformTag.findall('./config-file');

xml_path  = path.join(faultyplugin, 'plugin.xml')
xml_text  = fs.readFileSync(xml_path, 'utf-8')
plugin_et = new et.ElementTree(et.XML(xml_text));

platformTag = plugin_et.find('./platform[@name="android"]');
var invalid_source = platformTag.findall('./source-file');
var faulty_id = plugin_et._root.attrib['id'];

xml_path  = path.join(variableplugin, 'plugin.xml')
xml_text  = fs.readFileSync(xml_path, 'utf-8')
plugin_et = new et.ElementTree(et.XML(xml_text));
platformTag = plugin_et.find('./platform[@name="android"]');

var variable_id = plugin_et._root.attrib['id'];
var variable_configs = platformTag.findall('./config-file');

function copyArray(arr) {
    return Array.prototype.slice.call(arr, 0);
}

describe('android project handler', function() {
    describe('www_dir method', function() {
        it('should return cordova-android project www location using www_dir', function() {
            expect(android.www_dir(path.sep)).toEqual(path.sep + path.join('assets', 'www'));
        });
    });
    describe('package_name method', function() {
        it('should return an android project\'s proper package name', function() {
            expect(android.package_name(path.join(android_one_project, '..'))).toEqual('com.alunny.childapp');
        });
    });

    describe('installation', function() {
        beforeEach(function() {
            shell.mkdir('-p', temp);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        describe('of <lib-file> elements', function() {
            it("should copy jar files to project/libs", function () {
                var s = spyOn(common, 'copyFile');

                android['lib-file'].install(valid_libs[0], dummyplugin, temp);
                expect(s).toHaveBeenCalledWith(dummyplugin, 'src/android/TestLib.jar', temp, path.join('libs', 'TestLib.jar'));
            });
        });
        describe('of <resource-file> elements', function() {
            it("should copy files", function () {
                var s = spyOn(common, 'copyFile');

                android['resource-file'].install(valid_resources[0], dummyplugin, temp);
                expect(s).toHaveBeenCalledWith(dummyplugin, 'android-resource.xml', temp, path.join('res', 'xml', 'dummy.xml'));
            });
        });
        describe('of <source-file> elements', function() {
            beforeEach(function() {
                shell.cp('-rf', android_one_project, temp);
            });

            it('should copy stuff from one location to another by calling common.copyFile', function() {
                var source = copyArray(valid_source);
                var s = spyOn(common, 'copyFile');
                android['source-file'].install(source[0], dummyplugin, temp);
                expect(s).toHaveBeenCalledWith(dummyplugin, 'src/android/DummyPlugin.java', temp, path.join('src', 'com', 'phonegap', 'plugins', 'dummyplugin', 'DummyPlugin.java'));
            });
            it('should throw if source file cannot be found', function() {
                var source = copyArray(invalid_source);
                expect(function() {
                    android['source-file'].install(source[0], faultyplugin, temp);
                }).toThrow('"' + path.resolve(faultyplugin, 'src/android/NotHere.java') + '" not found!');
            });
            it('should throw if target file already exists', function() {
                // write out a file
                var target = path.resolve(temp, 'src/com/phonegap/plugins/dummyplugin');
                shell.mkdir('-p', target);
                target = path.join(target, 'DummyPlugin.java');
                fs.writeFileSync(target, 'some bs', 'utf-8');

                var source = copyArray(valid_source);
                expect(function() {
                    android['source-file'].install(source[0], dummyplugin, temp);
                }).toThrow('"' + target + '" already exists!');
            });
        });
        describe('of <framework> elements', function() {
            afterEach(function() {
                android.purgeProjectFileCache(temp);
            });
            it('with custom=true should update the main and library projects', function() {
                var frameworkElement = { attrib: { src: "LibraryPath", custom: true } };
                var subDir = path.resolve(temp, dummy_id, frameworkElement.attrib.src);
                var mainProjectPropsFile = path.resolve(temp, "project.properties");
                var subProjectPropsFile = path.resolve(subDir, "project.properties");

                var existsSync = spyOn( fs, 'existsSync').andReturn(true);
                var writeFileSync = spyOn(fs, 'writeFileSync');
                var copyNewFile = spyOn(common, 'copyNewFile');
                var readFileSync = spyOn(fs, 'readFileSync').andCallFake(function (file) {
                    file = path.normalize(file);
                    if (file === mainProjectPropsFile) {
                        return '#Some comment\ntarget=android-19\nandroid.library.reference.1=ExistingLibRef1\nandroid.library.reference.2=ExistingLibRef2';
                    } else if (file === subProjectPropsFile) {
                        return '#Some comment\ntarget=android-17\nandroid.library=true';
                    } else {
                        throw new Error("Trying to read from an unexpected file " + file + '\n expected: ' + mainProjectPropsFile + '\n' + subProjectPropsFile);
                    }
                })
                var exec = spyOn(shell, 'exec');

                android['framework'].install(frameworkElement, dummyplugin, temp, dummy_id);
                android.parseProjectFile(temp).write();

                expect(_.any(writeFileSync.argsForCall, function (callArgs) {
                    return callArgs[0] === mainProjectPropsFile && callArgs[1].indexOf('\nandroid.library.reference.3='+dummy_id+'/LibraryPath') > -1;
                })).toBe(true, 'Reference to library not added');
                expect(_.any(writeFileSync.argsForCall, function (callArgs) {
                    return callArgs[0] === subProjectPropsFile && callArgs[1].indexOf('\ntarget=android-19') > -1;
                })).toBe(true, 'target SDK version not copied to library');
                expect(exec).toHaveBeenCalledWith('android update lib-project --path "' + subDir + '"');
            });
            it('with custom=false should update the main and library projects', function() {
                var frameworkElement = { attrib: { src: "extras/android/support/v7/appcompat" } };
                var subDir = path.resolve("~/android-sdk", frameworkElement.attrib.src);
                var localPropsFile = path.resolve(temp, "local.properties");
                var mainProjectPropsFile = path.resolve(temp, "project.properties");
                var subProjectPropsFile = path.resolve(subDir, "project.properties");

                var existsSync = spyOn( fs, 'existsSync').andReturn(true);
                var writeFileSync = spyOn(fs, 'writeFileSync');
                var copyNewFile = spyOn(common, 'copyNewFile');
                var readFileSync = spyOn(fs, 'readFileSync').andCallFake(function (file) {
                    if (path.normalize(file) === mainProjectPropsFile) {
                        return '#Some comment\ntarget=android-19\nandroid.library.reference.1=ExistingLibRef1\nandroid.library.reference.2=ExistingLibRef2';
                    } else if (path.normalize(file) === subProjectPropsFile) {
                        return '#Some comment\ntarget=android-17\nandroid.library=true';
                    } else if (path.normalize(file) === localPropsFile) {
                        return "sdk.dir=~/android-sdk";
                    } else {
                        throw new Error("Trying to read from an unexpected file " + file);
                    }
                })
                var exec = spyOn(shell, 'exec');

                android['framework'].install(frameworkElement, dummyplugin, temp, dummy_id);
                android.parseProjectFile(temp).write();

                var relativePath = android_project.getRelativeLibraryPath(temp, subDir);
                expect(_.any(writeFileSync.argsForCall, function (callArgs) {
                    return callArgs[0] === mainProjectPropsFile && callArgs[1].indexOf('\nandroid.library.reference.3=' + relativePath) > -1;
                })).toBe(true, 'Reference to library not added');
                expect(_.any(writeFileSync.argsForCall, function (callArgs) {
                    return callArgs[0] === subProjectPropsFile && callArgs[1].indexOf('\ntarget=android-19') > -1;
                })).toBe(true, 'target SDK version not copied to library');
                expect(exec).toHaveBeenCalledWith('android update lib-project --path "' + subDir + '"');
            });
        });
    });

    describe('uninstallation', function() {
        beforeEach(function() {
            shell.mkdir('-p', temp);
            shell.mkdir('-p', plugins_dir);
            shell.cp('-rf', android_two_project, temp);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        describe('of <lib-file> elements', function(done) {
            it('should remove jar files', function () {
                var s = spyOn(common, 'removeFile');
                android['lib-file'].install(valid_libs[0], dummyplugin, temp);
                android['lib-file'].uninstall(valid_libs[0], temp, dummy_id);
                expect(s).toHaveBeenCalledWith(temp, path.join('libs', 'TestLib.jar'));
            });
        });
        describe('of <resource-file> elements', function(done) {
            it('should remove files', function () {
                var s = spyOn(common, 'removeFile');
                android['resource-file'].install(valid_resources[0], dummyplugin, temp);
                android['resource-file'].uninstall(valid_resources[0], temp, dummy_id);
                expect(s).toHaveBeenCalledWith(temp, path.join('res', 'xml', 'dummy.xml'));
            });
        });
        describe('of <source-file> elements', function() {
            it('should remove stuff by calling common.deleteJava', function(done) {
                var s = spyOn(common, 'deleteJava');
                install('android', temp, dummyplugin, plugins_dir, {})
                .then(function() {
                    var source = copyArray(valid_source);
                    android['source-file'].uninstall(source[0], temp);
                    expect(s).toHaveBeenCalledWith(temp, path.join('src', 'com', 'phonegap', 'plugins', 'dummyplugin', 'DummyPlugin.java'));
                    done();
                });
            });
        });
        describe('of <framework> elements', function() {
            afterEach(function () {
                android.purgeProjectFileCache(temp);
            });
            it('should remove library reference from the main project', function () {
                var frameworkElement = { attrib: { src: "LibraryPath", custom: true } };
                var sub_dir = path.resolve(temp, dummy_id, frameworkElement.attrib.src);
                var mainProjectProps = path.resolve(temp, "project.properties");
                var existsSync = spyOn(fs, 'existsSync').andReturn(true);
                var writeFileSync = spyOn(fs, 'writeFileSync');
                var removeFile = spyOn(common, 'removeFile');
                var readFileSync = spyOn(fs, 'readFileSync').andCallFake(function (file) {
                    if (path.normalize(file) === mainProjectProps)
                        return '#Some comment\ntarget=android-19\nandroid.library.reference.1=ExistingLibRef1\nandroid.library.reference.2='+dummy_id+'/LibraryPath\nandroid.library.reference.3=ExistingLibRef2\n';
                })
                var exec = spyOn(shell, 'exec');

                android['framework'].uninstall(frameworkElement, temp, dummy_id);
                android.parseProjectFile(temp).write();

                expect(_.any(writeFileSync.argsForCall, function (callArgs) {
                    return callArgs[0] === mainProjectProps && callArgs[1].indexOf('\nandroid.library.reference.2=ExistingLibRef2') > -1;
                })).toBe(true, 'Reference to library not removed');
            });
        });
    });
});
