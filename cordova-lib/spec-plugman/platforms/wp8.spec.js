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
var wp8 = require('../../src/plugman/platforms/wp8'),
    common  = require('../../src/plugman/platforms/common'),
    install = require('../../src/plugman/install'),
    path    = require('path'),
    fs      = require('fs'),
    shell   = require('shelljs'),
    os      = require('os'),
    temp    = path.join(os.tmpdir(), 'plugman'),
    plugins_dir = path.join(temp, 'cordova', 'plugins'),
    xml_helpers = require('cordova-common').xmlHelpers,
    dummyplugin = path.join(__dirname, '..', 'plugins', 'org.test.plugins.dummyplugin'),
    faultyplugin = path.join(__dirname, '..', 'plugins', 'org.test.plugins.faultyplugin'),
    wp8_project = path.join(__dirname, '..', 'projects', 'wp8');

var PluginInfo = require('cordova-common').PluginInfo;

var dummyPluginInfo = new PluginInfo(dummyplugin);
var dummy_id = dummyPluginInfo.id;
var valid_source = dummyPluginInfo.getSourceFiles('wp8');

var faultyPluginInfo = new PluginInfo(faultyplugin);
var faulty_id = faultyPluginInfo.id;
var invalid_source = faultyPluginInfo.getSourceFiles('wp8');

shell.mkdir('-p', temp);
shell.cp('-rf', path.join(wp8_project, '*'), temp);
var proj_files = wp8.parseProjectFile(temp);
shell.rm('-rf', temp);

function copyArray(arr) {
    return Array.prototype.slice.call(arr, 0);
}

describe('wp8 project handler', function() {

    beforeEach(function() {
        shell.mkdir('-p', temp);
        shell.mkdir('-p', plugins_dir);
    });
    afterEach(function() {
        shell.rm('-rf', temp);
    });

    describe('www_dir method', function() {
        it('should return cordova-wp8 project www location using www_dir', function() {
            expect(wp8.www_dir(path.sep)).toEqual(path.sep + 'www');
        });
    });
    describe('package_name method', function() {
        it('should return a wp8 project\'s proper package name', function() {
            expect(wp8.package_name(wp8_project)).toEqual('{F3A8197B-6B16-456D-B5F4-DD4F04AC0BEC}');
        });
    });

    describe('parseProjectFile method', function() {
        it('should throw if project is not an wp8 project', function() {
            expect(function() {
                wp8.parseProjectFile(temp);
            }).toThrow('does not appear to be a Windows Phone project (no .csproj file)');
        });
    });

    describe('installation', function() {
        var done;
        function installPromise(f) {
            done = false;
            f.then(function() { done = true; }, function(err) { done = err; });
        }
        beforeEach(function() {
            shell.mkdir('-p', temp);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        describe('of <source-file> elements', function() {
            beforeEach(function() {
                shell.cp('-rf', path.join(wp8_project, '*'), temp);
            });
            it('should copy stuff from one location to another by calling common.copyFile', function() {
                var source = copyArray(valid_source);
                var s = spyOn(common, 'copyFile');
                wp8['source-file'].install(source[0], dummyplugin, temp, dummy_id, null, proj_files);
                expect(s).toHaveBeenCalledWith(dummyplugin, 'src/wp8/DummyPlugin.cs', temp, path.join('Plugins', 'org.test.plugins.dummyplugin', 'DummyPlugin.cs'), false);
            });
            it('should throw if source-file src cannot be found', function() {
                var source = copyArray(invalid_source);
                expect(function() {
                    wp8['source-file'].install(source[1], faultyplugin, temp, faulty_id, null, proj_files);
                }).toThrow('"' + path.resolve(faultyplugin, 'src/wp8/NotHere.cs') + '" not found!');
            });
            it('should throw if source-file target already exists', function() {
                var source = copyArray(valid_source);
                var target = path.join(temp, 'Plugins', dummy_id, 'DummyPlugin.cs');
                shell.mkdir('-p', path.dirname(target));
                fs.writeFileSync(target, 'some bs', 'utf-8');
                expect(function() {
                    wp8['source-file'].install(source[0], dummyplugin, temp, dummy_id, null, proj_files);
                }).toThrow('"' + target + '" already exists!');
            });
        });
        describe('of <config-changes> elements', function() {
            beforeEach(function() {
                shell.cp('-rf', path.join(wp8_project, '*'), temp);
            });
            it('should process and pass the after parameter to graftXML', function () {
                var graftXML = spyOn(xml_helpers, 'graftXML').andCallThrough();

                runs(function () { installPromise(install('wp8', temp, dummyplugin, plugins_dir, {})); });
                waitsFor(function () { return done; }, 'install promise never resolved', 500);
                runs(function () {
                    expect(graftXML).toHaveBeenCalledWith(jasmine.any(Object), jasmine.any(Array), '/Deployment/App', 'Tokens');
                    expect(graftXML).toHaveBeenCalledWith(jasmine.any(Object), jasmine.any(Array), '/Deployment/App/Extensions', 'Extension');
                    expect(graftXML).toHaveBeenCalledWith(jasmine.any(Object), jasmine.any(Array), '/Deployment/App/Extensions', 'FileTypeAssociation;Extension');
                });
            });
        });
    });

    describe('uninstallation', function() {
        beforeEach(function() {
            shell.mkdir('-p', temp);
            shell.mkdir('-p', plugins_dir);
            shell.cp('-rf', path.join(wp8_project, '*'), temp);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        describe('of <source-file> elements', function() {
            it('should remove stuff by calling common.removeFile', function(done) {
                var s = spyOn(common, 'removeFile');
                install('wp8', temp, dummyplugin, plugins_dir, {})
                .then(function() {
                    var source = copyArray(valid_source);
                    wp8['source-file'].uninstall(source[0], temp, dummy_id, null, proj_files);
                    expect(s).toHaveBeenCalledWith(temp, path.join('Plugins', 'org.test.plugins.dummyplugin', 'DummyPlugin.cs'));
                    done();
                });
            });
        });
    });
});
