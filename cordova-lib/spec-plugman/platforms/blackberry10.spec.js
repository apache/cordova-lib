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
var blackberry10 = require('../../src/plugman/platforms/blackberry10'),
    common = require('../../src/plugman/platforms/common'),
    path = require('path'),
    fs = require('fs'),
    shell = require('shelljs'),
    os = require('os'),
    temp = path.join(os.tmpdir(), 'plugman'),
    blackberry10_project = path.join(__dirname, '..', 'projects', 'blackberry10', '*');
var PluginInfo = require('cordova-common').PluginInfo;

var plugins = {
    dummy: new PluginInfo(path.join(__dirname, '..', 'plugins', 'org.test.plugins.dummyplugin')),
    faulty: new PluginInfo(path.join(__dirname, '..', 'plugins', 'org.test.plugins.faultyplugin')),
    echo: new PluginInfo(path.join(__dirname, '..', 'plugins', 'com.cordova.echo'))
};


function copyArray(arr) {
    return Array.prototype.slice.call(arr, 0);
}


describe('blackberry10 project handler', function() {
    describe('www_dir method', function() {
        it('should return cordova-blackberry10 project www location using www_dir', function() {
            expect(blackberry10.www_dir(path.sep)).toEqual(path.sep + 'www');
        });
    });

    describe('package_name method', function() {
        it('should return a blackberry10 project\'s proper package name', function() {
            expect(blackberry10.package_name(path.join(blackberry10_project, '..'))).toEqual('cordovaExample');
        });
    });

    describe('installation', function() {
        beforeEach(function() {
            shell.mkdir('-p', temp);
            shell.cp('-rf', blackberry10_project, temp);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        describe('of <lib-file> elements', function() {
            it('should copy so files to native/target/plugins', function () {
                var plugin = plugins.echo,
                    libs = copyArray(plugin.getLibFiles('blackberry10')),
                    s = spyOn(common, 'copyFile');

                blackberry10['lib-file'].install(libs[0], plugin.dir, temp);
                expect(s).toHaveBeenCalledWith(plugin.dir, 'src/blackberry10/native/device/echoJnext.so', temp, path.join('native', 'device', 'plugins', 'jnext', 'echoJnext.so'), false);
            });
        });
        describe('of <source-file> elements', function() {
            it('should copy stuff from one location to another by calling common.copyFile', function() {
                var plugin = plugins.echo,
                    source = copyArray(plugin.getSourceFiles('blackberry10')),
                    s = spyOn(common, 'copyFile');

                blackberry10['source-file'].install(source[0], plugin.dir, temp, plugin.id);
                expect(s).toHaveBeenCalledWith(plugin.dir, 'src/blackberry10/index.js', temp, path.join('native', 'device', 'chrome', 'plugin', 'com.cordova.echo', 'index.js'), false);
                expect(s).toHaveBeenCalledWith(plugin.dir, 'src/blackberry10/index.js', temp, path.join('native', 'simulator', 'chrome', 'plugin', 'com.cordova.echo', 'index.js'), false);
            });
            it('defaults to plugin id when dest is not present', function() {
                var source = copyArray(plugins.dummy.getSourceFiles('blackberry10'));
                var s = spyOn(common, 'copyFile');
                blackberry10['source-file'].install(source[0], plugins.dummy.dir, temp, plugins.dummy.id);
                expect(s).toHaveBeenCalledWith(plugins.dummy.dir, 'src/blackberry10/index.js', temp, path.join('native', 'device', 'chrome', 'plugin', plugins.dummy.id, 'index.js'), false);
                expect(s).toHaveBeenCalledWith(plugins.dummy.dir, 'src/blackberry10/index.js', temp, path.join('native', 'simulator', 'chrome', 'plugin', plugins.dummy.id, 'index.js'), false);
            });
            it('should throw if source file cannot be found', function() {
                var source = copyArray(plugins.faulty.getSourceFiles('blackberry10'));
                expect(function() {
                    blackberry10['source-file'].install(source[0], plugins.faulty.dir, temp, plugins.faulty.id);
                }).toThrow('"' + path.resolve(plugins.faulty.dir, 'src/blackberry10/index.js') + '" not found!');
            });
            it('should throw if target file already exists', function() {
                // write out a file
                var target = path.resolve(temp, 'native/device/chrome/plugin/org.test.plugins.dummyplugin');
                shell.mkdir('-p', target);
                target = path.join(target, 'index.js');
                fs.writeFileSync(target, 'some bs', 'utf-8');

                var source = copyArray(plugins.dummy.getSourceFiles('blackberry10'));
                expect(function() {
                    blackberry10['source-file'].install(source[0], plugins.dummy.dir, temp, plugins.dummy.id);
                }).toThrow('"' + target + '" already exists!');
            });
        });
    });

    describe('uninstallation', function() {
        beforeEach(function() {
            shell.mkdir('-p', temp);
            shell.cp('-rf', blackberry10_project, temp);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        describe('of <source-file> elements', function() {
            it('should remove stuff by calling common.removeFile', function() {
                var s = spyOn(common, 'removeFile'),
                    plugin = plugins.echo;
                var source = copyArray(plugin.getSourceFiles('blackberry10'));
                blackberry10['source-file'].install(source[0], plugin.dir, temp, plugin.id);
                blackberry10['source-file'].uninstall(source[0], temp, plugin.id);
                expect(s).toHaveBeenCalledWith(temp, path.join('native', 'device', 'chrome', 'plugin', 'com.cordova.echo', 'index.js'));
                expect(s).toHaveBeenCalledWith(temp, path.join('native', 'simulator', 'chrome', 'plugin', 'com.cordova.echo', 'index.js'));
            });
            it('should remove stuff by calling common.removeFile', function() {
                var s = spyOn(common, 'removeFile'),
                    plugin = plugins.dummy;
                var source = copyArray(plugin.getSourceFiles('blackberry10'));
                blackberry10['source-file'].install(source[0], plugin.dir, temp, plugin.id);
                blackberry10['source-file'].uninstall(source[0], temp, plugin.id);
                expect(s).toHaveBeenCalledWith(temp, path.join('native', 'device', 'chrome', 'plugin', plugin.id, 'index.js'));
                expect(s).toHaveBeenCalledWith(temp, path.join('native', 'simulator', 'chrome', 'plugin', plugin.id, 'index.js'));
            });
        });
        describe('of <lib-file> elements', function(done) {
            it('should remove so files from www/plugins', function () {
                var s = spyOn(common, 'removeFile'),
                    plugin = plugins.echo;
                var source = copyArray(plugin.getLibFiles('blackberry10'));
                blackberry10['lib-file'].install(source[0], plugin.dir, temp, plugin.id);
                blackberry10['lib-file'].uninstall(source[0], temp, plugin.id);
                expect(s).toHaveBeenCalledWith(temp, path.join('native','device','plugins','jnext','echoJnext.so'));
            });
        });
    });
});
