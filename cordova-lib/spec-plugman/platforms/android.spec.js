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

/* jshint sub:true */

var android = require('../../src/plugman/platforms/android'),
    common  = require('../../src/plugman/platforms/common'),
    path    = require('path'),
    fs      = require('fs'),
    shell   = require('shelljs'),
    os      = require('osenv'),
    temp    = path.join(os.tmpdir(), 'plugman'),
    plugins_dir = path.join(temp, 'cordova', 'plugins'),
    dummyplugin = path.join(__dirname, '..', 'plugins', 'org.test.plugins.dummyplugin'),
    faultyplugin = path.join(__dirname, '..', 'plugins', 'org.test.plugins.faultyplugin'),
    android_one_project = path.join(__dirname, '..', 'projects', 'android_one', '*'),
    android_two_project = path.join(__dirname, '..', 'projects', 'android_two', '*');

var PluginInfo = require('../../src/PluginInfo');

var dummyPluginInfo = new PluginInfo(dummyplugin);
var dummy_id = dummyPluginInfo.id;
var valid_source = dummyPluginInfo.getSourceFiles('android'),
    valid_resources = dummyPluginInfo.getResourceFiles('android'),
    valid_libs = dummyPluginInfo.getLibFiles('android');

var faultyPluginInfo = new PluginInfo(faultyplugin);
var invalid_source = faultyPluginInfo.getSourceFiles('android');

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
            it('should copy jar files to project/libs', function () {
                var s = spyOn(common, 'copyFile');

                android['lib-file'].install(valid_libs[0], dummyplugin, temp);
                expect(s).toHaveBeenCalledWith(dummyplugin, 'src/android/TestLib.jar', temp, path.join('libs', 'TestLib.jar'), false);
            });
        });
        describe('of <resource-file> elements', function() {
            it('should copy files', function () {
                var s = spyOn(common, 'copyFile');

                android['resource-file'].install(valid_resources[0], dummyplugin, temp);
                expect(s).toHaveBeenCalledWith(dummyplugin, 'android-resource.xml', temp, path.join('res', 'xml', 'dummy.xml'), false);
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
                expect(s).toHaveBeenCalledWith(dummyplugin, 'src/android/DummyPlugin.java', temp, path.join('src', 'com', 'phonegap', 'plugins', 'dummyplugin', 'DummyPlugin.java'), false);
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
    });

    describe('<framework> elements', function() {
        beforeEach(function() {
            shell.cp('-rf', android_one_project, temp);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
            android.purgeProjectFileCache(temp);
        });
        it('with custom=true', function() {
            var packageIdSuffix = 'childapp';
            var frameworkElement = { src: 'plugin-lib', custom: true };
            var mainProjectPropsFile = path.resolve(temp, 'project.properties');
            var subDir = path.resolve(temp, dummy_id, packageIdSuffix + '-' + frameworkElement.src);
            var subProjectPropsFile = path.resolve(subDir, 'project.properties');

            var exec = spyOn(shell, 'exec');

            android['framework'].install(frameworkElement, dummyplugin, temp, dummy_id, { platformVersion: '3.0.0' });
            android.parseProjectFile(temp).write();

            var finalProjectProperties = fs.readFileSync(mainProjectPropsFile, 'utf8');
            expect(finalProjectProperties).toMatch('\nandroid.library.reference.3='+dummy_id+'/'+packageIdSuffix+'-plugin-lib', 'Reference to library not added');
            var subProjectProperties = fs.readFileSync(subProjectPropsFile, 'utf8');
            expect(subProjectProperties).toMatch(/\btarget=android-19[\n\r]/, 'target SDK version not copied to library');
            expect(exec).toHaveBeenCalledWith('android update lib-project --path "' + subDir + '"');

            // Now test uninstall
            android.purgeProjectFileCache(temp);
            android['framework'].uninstall(frameworkElement, temp, dummy_id, {platformVersion: '3.0.0'});
            android.parseProjectFile(temp).write();

            finalProjectProperties = fs.readFileSync(mainProjectPropsFile, 'utf8');
            expect(finalProjectProperties).not.toMatch('\nandroid.library.reference.3='+dummy_id+'/'+packageIdSuffix+'-plugin-lib', 'Reference to library not added');
            expect(fs.existsSync(subDir)).toBe(false, 'Should delete subdir');
        });
        it('with custom=true type=gradleReference', function() {
            var packageIdSuffix = 'childapp';
            var frameworkElement = { src: 'extra.gradle', custom: true, type: 'gradleReference'};
            var mainProjectPropsFile = path.resolve(temp, 'project.properties');
            var subDir = path.resolve(temp, dummy_id, packageIdSuffix + '-' + frameworkElement.src);

            android['framework'].install(frameworkElement, dummyplugin, temp, dummy_id, {platformVersion: '3.0.0'});
            android.parseProjectFile(temp).write();

            var finalProjectProperties = fs.readFileSync(mainProjectPropsFile, 'utf8');
            expect(finalProjectProperties).toMatch('\ncordova.gradle.include.1='+dummy_id+'/'+packageIdSuffix+'-extra.gradle', 'Reference to gradle not added');

            // Now test uninstall
            android.purgeProjectFileCache(temp);
            android['framework'].uninstall(frameworkElement, temp, dummy_id, {platformVersion: '3.0.0'});
            android.parseProjectFile(temp).write();

            finalProjectProperties = fs.readFileSync(mainProjectPropsFile, 'utf8');
            expect(finalProjectProperties).not.toMatch('\ncordova.gradle.include.1='+dummy_id+'/'+packageIdSuffix+'-extra.gradle', 'Reference to gradle not added');
            expect(fs.existsSync(subDir)).toBe(false, 'Should delete subdir');
        });
        it('with custom=false pre 4.0', function() {
            var packageIdSuffix = 'childapp';
            var frameworkElement = { src: 'extras/android/support/v4', custom: false};
            var mainProjectPropsFile = path.resolve(temp, 'project.properties');
            fs.writeFileSync(path.join(temp, 'local.properties'), 'sdk.dir=' + path.join(path.dirname(temp), 'SDK').replace(/\\/g, '/'));

            var exec = spyOn(shell, 'exec');
            android['framework'].install(frameworkElement, dummyplugin, temp, dummy_id, { platformVersion: '3.0.0'});
            android.parseProjectFile(temp).write();

            // exec doesn't get called since plugin dir doesn't actually exist.
            expect(exec).not.toHaveBeenCalled();
            var finalProjectProperties = fs.readFileSync(mainProjectPropsFile, 'utf8');
            expect(finalProjectProperties).toMatch('\nandroid.library.reference.3=' + '../SDK/extras/android/support/v4', 'Sublibrary not added');

            // Now test uninstall
            android.purgeProjectFileCache(temp);
            android['framework'].uninstall(frameworkElement, temp, dummy_id, { platformVersion: '3.0.0'});
            android.parseProjectFile(temp).write();

            finalProjectProperties = fs.readFileSync(mainProjectPropsFile, 'utf8');
            expect(finalProjectProperties).not.toMatch('\ncordova.gradle.include.1='+dummy_id+'/'+packageIdSuffix+'-extra.gradle', 'Reference to gradle not added');
        });
        it('with custom=false post 4.0', function() {
            var frameworkElement = { src: 'extras/android/support/v4', custom: false};
            var mainProjectPropsFile = path.resolve(temp, 'project.properties');
            fs.writeFileSync(path.join(temp, 'local.properties'), 'sdk.dir=' + path.join(temp, '..', 'SDK'));

            android['framework'].install(frameworkElement, dummyplugin, temp, dummy_id, { platformVersion: '4.0.0-dev'});
            android.parseProjectFile(temp).write();

            var finalProjectProperties = fs.readFileSync(mainProjectPropsFile, 'utf8');
            expect(finalProjectProperties).toMatch('\ncordova.system.library.1=' + 'extras/android/support/v4', 'Sublibrary not added');
            expect(finalProjectProperties).not.toMatch('\nandroid.library.reference.3=' + path.join('..', 'SDK', 'extras', 'android', 'support', 'v4'), 'Sublibrary not added');

            // Now test uninstall
            android.purgeProjectFileCache(temp);
            android['framework'].uninstall(frameworkElement, temp, dummy_id, { platformVersion: '4.0.0-dev'});
            android.parseProjectFile(temp).write();

            finalProjectProperties = fs.readFileSync(mainProjectPropsFile, 'utf8');
            expect(finalProjectProperties).not.toMatch('\ncordova.system.library.1=' + 'extras/android/support/v4', 'Sublibrary not added');
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
            it('should remove stuff by calling common.deleteJava', function() {
                var s = spyOn(common, 'deleteJava');
                android['source-file'].install(valid_source[0], dummyplugin, temp, dummy_id);
                var source = copyArray(valid_source);
                android['source-file'].uninstall(source[0], temp, dummy_id);
                expect(s).toHaveBeenCalledWith(temp, path.join('src', 'com', 'phonegap', 'plugins', 'dummyplugin', 'DummyPlugin.java'));
            });
        });
    });
});
