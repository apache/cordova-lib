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
var windows = require('../../src/plugman/platforms/windows'),
    common = require('../../src/plugman/platforms/common'),
    install = require('../../src/plugman/install'),
    path = require('path'),
    fs = require('fs'),
    shell = require('shelljs'),
    et = require('elementtree'),
    os = require('osenv'),
    cordovaProjectDir = path.join(os.tmpdir(), 'plugman'),
    cordovaProjectWindowsPlatformDir = path.join(cordovaProjectDir, 'platforms', 'windows'),
    cordovaProjectPluginsDir = path.join(cordovaProjectDir, 'plugins'),
    dummyplugin = path.join(__dirname, '..', 'plugins', 'org.test.plugins.dummyplugin'),
    faultyplugin = path.join(__dirname, '..', 'plugins', 'org.test.plugins.faultyplugin');

var PluginInfo = require('../../src/PluginInfo');

var dummyPluginInfo = new PluginInfo(dummyplugin);
var dummy_id = dummyPluginInfo.id;
var valid_source = dummyPluginInfo.getSourceFiles('windows');
var valid_libfiles = dummyPluginInfo.getLibFiles('windows');
var valid_frameworks = dummyPluginInfo.getFrameworks('windows');

var faultyPluginInfo = new PluginInfo(faultyplugin);
var faulty_id = faultyPluginInfo.id;
var invalid_source = faultyPluginInfo.getSourceFiles('windows');
var invalid_libfiles = faultyPluginInfo.getLibFiles('windows');

function copyArray(arr) {
    return Array.prototype.slice.call(arr, 0);
}

beforeEach(function () {
    this.addMatchers({
        toContainXmlPath: function (xpath) {
            var xml = this.actual;
            var notText = this.isNot ? 'not ' : '';
            this.message = function () {
                return 'Expected xml \'' + et.tostring(xml) + '\' ' + notText + 'to contain elements matching \'' + xpath + '\'.';
            };

            return xml.find(xpath) !== null;
        }    });
});

['windows', 'windows8'].forEach(function (platform) {
    var windows_project = path.join(__dirname, '..', 'projects', platform);

    shell.mkdir('-p', cordovaProjectWindowsPlatformDir);
    shell.cp('-rf', path.join(windows_project, '*'), cordovaProjectWindowsPlatformDir);
    var proj_files = windows.parseProjectFile(cordovaProjectWindowsPlatformDir);
    shell.rm('-rf', cordovaProjectDir);

    var platformProjects = {
        windows: {
            all: 'CordovaApp.projitems',
            phone: 'CordovaApp.Phone.jsproj',
            windows: 'CordovaApp.Windows.jsproj',
            windows8: 'CordovaApp.Windows80.jsproj'
        }, windows8: {
            all: 'TestApp.jsproj',
            windows8: 'TestApp.jsproj'
        }
    }[platform];

    describe(platform + ' project handler', function () {
        beforeEach(function () {
            shell.mkdir('-p', cordovaProjectWindowsPlatformDir);
            shell.mkdir('-p', cordovaProjectPluginsDir);
        });
        afterEach(function () {
            shell.rm('-rf', cordovaProjectDir);
        });

        describe('www_dir method', function () {
            it('should return cordova-windows project www location using www_dir', function () {
                expect(windows.www_dir(path.sep)).toEqual(path.sep + 'www');
            });
        });
        describe('package_name method', function () {
            it('should return a windows project\'s proper package name', function () {
                expect(windows.package_name(windows_project)).toEqual('CordovaApp');
            });
        });

        describe('parseProjectFile method', function () {
            it('should throw if project is not an windows project', function () {
                expect(function () {
                    windows.parseProjectFile(cordovaProjectWindowsPlatformDir);
                }).toThrow(windows.InvalidProjectPathError);
            });
        });

        describe('installation', function () {
            beforeEach(function () {
                shell.mkdir('-p', cordovaProjectWindowsPlatformDir);
                shell.cp('-rf', path.join(windows_project, '*'), cordovaProjectWindowsPlatformDir);
            });
            afterEach(function () {
                shell.rm('-rf', cordovaProjectDir);
            });

            function validateInstalledProjects(tag, elementToInstall, xpath, supportedPlatforms) {
                jasmine.getEnv().currentSpec.removeAllSpies();

                var projects = copyArray(proj_files.projects);
                if (platform === 'windows') {
                    projects.push(proj_files.master);
                }

                var appendToRootFake = function (itemGroup) {
                    expect(itemGroup).toContainXmlPath(xpath);
                };

                var projectsAddedToSpies = [];
                var projectsNotAddedToSpies = [];

                var projectsAddedTo = [];
                supportedPlatforms.forEach(function (platform) {
                    var platformProject = platformProjects[platform];
                    if (platformProject) {
                        projectsAddedTo.push(platformProjects[platform]);
                    }
                });

                projects.forEach(function (project) {
                    if (projectsAddedTo.indexOf(path.basename(project.location)) > -1) {
                        projectsAddedToSpies.push(spyOn(project, 'appendToRoot').andCallFake(appendToRootFake));
                    } else {
                        projectsNotAddedToSpies.push(spyOn(project, 'appendToRoot'));
                    }
                });

                windows[tag].install(elementToInstall, dummyplugin, cordovaProjectWindowsPlatformDir, dummy_id, null, proj_files);

                projectsAddedToSpies.forEach(function (spy) {
                    expect(spy).toHaveBeenCalled();
                });

                projectsNotAddedToSpies.forEach(function (spy) {
                    expect(spy).not.toHaveBeenCalled();
                });
            }

            describe('of <source-file> elements', function () {
                it('should copy stuff from one location to another by calling common.copyFile', function () {
                    var source = copyArray(valid_source);
                    var s = spyOn(common, 'copyFile');
                    windows['source-file'].install(source[0], dummyplugin, cordovaProjectWindowsPlatformDir, dummy_id, null, proj_files);
                    expect(s).toHaveBeenCalledWith(dummyplugin, 'src/windows/dummer.js', cordovaProjectWindowsPlatformDir, path.join('plugins', 'org.test.plugins.dummyplugin', 'dummer.js'), false);
                });
                it('should throw if source-file src cannot be found', function () {
                    var source = copyArray(invalid_source);
                    expect(function () {
                        windows['source-file'].install(source[1], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow('"' + path.resolve(faultyplugin, 'src/windows/NotHere.js') + '" not found!');
                });
                it('should throw if source-file target already exists', function () {
                    var source = copyArray(valid_source);
                    var target = path.join(cordovaProjectWindowsPlatformDir, 'plugins', dummy_id, 'dummer.js');
                    shell.mkdir('-p', path.dirname(target));
                    fs.writeFileSync(target, 'some bs', 'utf-8');
                    expect(function () {
                        windows['source-file'].install(source[0], dummyplugin, cordovaProjectWindowsPlatformDir, dummy_id, null, proj_files);
                    }).toThrow('"' + target + '" already exists!');
                });
            });

            describe('of <lib-file> elements', function () {
                var libfiles = copyArray(valid_libfiles);
                var invalidLibFiles = copyArray(invalid_libfiles);

                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('should write to correct project files when conditions are specified', function () {
                    var xpath = 'SDKReference[@Include="TestSDK1, Version=1.0"][@Condition="\'$(Platform)\'==\'x86\'"]';
                    validateInstalledProjects('lib-file', libfiles[0], xpath, ['all']);

                    xpath = 'SDKReference[@Include="TestSDK2, Version=1.0"]';
                    validateInstalledProjects('lib-file', libfiles[1], xpath, ['windows', 'phone']);

                    xpath = 'SDKReference[@Include="TestSDK3, Version=1.0"]';
                    validateInstalledProjects('lib-file', libfiles[2], xpath, ['phone']);

                    xpath = 'SDKReference[@Include="TestSDK4, Version=1.0"]';
                    validateInstalledProjects('lib-file', libfiles[3], xpath, ['windows8']);
                });

                it('should throw if conditions are invalid', function () {
                    expect(function () {
                        windows['lib-file'].install(invalidLibFiles[0], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow('Invalid lib-file arch attribute (must be "x86", "x64" or "ARM"): x85');

                    expect(function () {
                        windows['lib-file'].install(invalidLibFiles[1], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow('Invalid lib-file versions attribute (must be a valid a valid node semantic version range): 8.0a');

                    expect(function () {
                        windows['lib-file'].install(invalidLibFiles[2], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow('Invalid lib-file target attribute (must be "all", "phone", "windows" or "win"): daphne');
                });
            });

            describe('of <framework> elements', function () {
                var frameworks = copyArray(valid_frameworks);

                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('should write to correct project files when conditions are specified', function () {
                    var xpath = 'Reference[@Include="dummy1"][@Condition="\'$(Platform)\'==\'x64\'"]/HintPath';
                    validateInstalledProjects('framework', frameworks[0], xpath, ['all']);

                    xpath = 'Reference[@Include="dummy2"]/HintPath';
                    validateInstalledProjects('framework', frameworks[1], xpath, ['all']);

                    xpath = 'Reference[@Include="dummy3"]/HintPath';
                    validateInstalledProjects('framework', frameworks[2], xpath, ['windows', 'windows8']);

                    xpath = 'Reference[@Include="dummy4"][@Condition="\'$(Platform)\'==\'ARM\'"]/HintPath';
                    validateInstalledProjects('framework', frameworks[3], xpath, ['phone']);
                });
            });

            describe('of <framework> elements of type \'projectReference\'', function () {
                var frameworks = copyArray(valid_frameworks);

                it('should write to correct project files when conditions are specified', function () {
                    var xpath = 'ProjectReference[@Include="' + windowsJoin(dummyplugin, 'src', 'windows', 'dummy1.vcxproj') + '"][@Condition="\'$(Platform)\'==\'x64\'"]';
                    validateInstalledProjects('framework', frameworks[4], xpath, ['all']);

                    xpath = 'ProjectReference[@Include="' + windowsJoin(dummyplugin, 'src', 'windows', 'dummy2.vcxproj') + '"]';
                    validateInstalledProjects('framework', frameworks[5], xpath, ['windows8']);

                    xpath = 'ProjectReference[@Include="' + windowsJoin(dummyplugin, 'src', 'windows', 'dummy3.vcxproj') + '"]';
                    validateInstalledProjects('framework', frameworks[6], xpath, ['windows', 'windows8']);

                    xpath = 'ProjectReference[@Include="' + windowsJoin(dummyplugin, 'src', 'windows', 'dummy4.vcxproj') + '"][@Condition="\'$(Platform)\'==\'x86\'"]';
                    validateInstalledProjects('framework', frameworks[7], xpath, ['windows', 'phone']);
                });
            });
        });

        describe('uninstallation', function () {
            beforeEach(function () {
                shell.mkdir('-p', cordovaProjectWindowsPlatformDir);
                shell.mkdir('-p', cordovaProjectPluginsDir);
                shell.cp('-rf', path.join(windows_project, '*'), cordovaProjectWindowsPlatformDir);
            });
            afterEach(function () {
                shell.rm('-rf', cordovaProjectDir);
            });

            function validateUninstalledProjects(tag, elementToUninstall, xmlPath, incText, targetConditions, supportedPlatforms) {
                jasmine.getEnv().currentSpec.removeAllSpies();

                var projects = copyArray(proj_files.projects);
                if (platform === 'windows') {
                    projects.push(proj_files.master);
                }

                var projectsAddedToSpies = [];
                var projectsNotAddedToSpies = [];

                var projectsAddedTo = [];
                supportedPlatforms.forEach(function (platform) {
                    var platformProject = platformProjects[platform];
                    if (platformProject) {
                        projectsAddedTo.push(platformProjects[platform]);
                    }
                });

                projects.forEach(function (project) {
                    var spy = spyOn(project, 'removeReferenceElementItemGroup');
                    if (projectsAddedTo.indexOf(path.basename(project.location)) > -1) {
                        projectsAddedToSpies.push(spy);
                    } else {
                        projectsNotAddedToSpies.push(spy);
                    }
                });

                windows[tag].uninstall(elementToUninstall, cordovaProjectWindowsPlatformDir, dummy_id, null, proj_files);

                projectsAddedToSpies.forEach(function (spy) {
                    expect(spy).toHaveBeenCalledWith(xmlPath, incText, targetConditions);
                });

                projectsNotAddedToSpies.forEach(function (spy) {
                    expect(spy).not.toHaveBeenCalled();
                });
            }

            describe('of <source-file> elements', function () {
                it('should remove stuff by calling common.removeFile', function (done) {
                    var s = spyOn(common, 'removeFile');

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var source = copyArray(valid_source);
                            windows['source-file'].uninstall(source[0], cordovaProjectWindowsPlatformDir, dummy_id, null, proj_files);
                            expect(s).toHaveBeenCalledWith(cordovaProjectWindowsPlatformDir, path.join('plugins', 'org.test.plugins.dummyplugin', 'dummer.js'));
                            done();
                        });
                });
            });

            describe('of <lib-file> elements', function () {
                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('should remove from correct project files when conditions specified', function (done) {
                    var libfiles = copyArray(valid_libfiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/SDKReference';
                            var incText = 'TestSDK1, Version=1.0';
                            var targetConditions = {versions: undefined, deviceTarget: undefined, arch: 'x86'};
                            validateUninstalledProjects('lib-file', libfiles[0], path, incText, targetConditions, ['all']);

                            incText = 'TestSDK2, Version=1.0';
                            targetConditions = {versions: '>=8.1', deviceTarget: undefined, arch: undefined};
                            validateUninstalledProjects('lib-file', libfiles[1], path, incText, targetConditions, ['windows', 'phone']);

                            incText = 'TestSDK3, Version=1.0';
                            targetConditions = {versions: undefined, deviceTarget: 'phone', arch: undefined};
                            validateUninstalledProjects('lib-file', libfiles[2], path, incText, targetConditions, ['phone']);

                            incText = 'TestSDK4, Version=1.0';
                            targetConditions = {versions: '8.0', deviceTarget: 'windows', arch: 'x86'};
                            validateUninstalledProjects('lib-file', libfiles[3], path, incText, targetConditions, ['windows8']);

                            done();
                        });
                });
            });

            describe('of <framework> elements', function () {
                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Reference';
                            var incText = 'dummy1';
                            var targetConditions = {versions: undefined, deviceTarget: undefined, arch: 'x64'};
                            validateUninstalledProjects('framework', frameworks[0], path, incText, targetConditions, ['all']);

                            incText = 'dummy2';
                            targetConditions = {versions: '>=8.0', deviceTarget: undefined, arch: undefined};
                            validateUninstalledProjects('framework', frameworks[1], path, incText, targetConditions, ['all']);

                            incText = 'dummy3';
                            targetConditions = {versions: undefined, deviceTarget: 'windows', arch: undefined};
                            validateUninstalledProjects('framework', frameworks[2], path, incText, targetConditions, ['windows', 'windows8']);

                            incText = 'dummy4';
                            targetConditions = {versions: '8.1', deviceTarget: 'phone', arch: 'ARM'};
                            validateUninstalledProjects('framework', frameworks[3], path, incText, targetConditions, ['phone']);

                            done();
                        });
                });
            });

            describe('of <framework> elements of type \'projectReference\'', function () {
                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var xmlPath = 'ItemGroup/ProjectReference';
                            var incText = windowsJoin(cordovaProjectPluginsDir , dummy_id, 'src', 'windows', 'dummy1.vcxproj');
                            var targetConditions = {versions: undefined, deviceTarget: undefined, arch: 'x64'};
                            validateUninstalledProjects('framework', frameworks[4], xmlPath, incText, targetConditions, ['all']);

                            incText = windowsJoin(cordovaProjectPluginsDir , dummy_id, 'src', 'windows', 'dummy2.vcxproj');
                            targetConditions = {versions: '<8.1', deviceTarget: undefined, arch: undefined};
                            validateUninstalledProjects('framework', frameworks[5], xmlPath, incText, targetConditions, ['windows8']);

                            incText = windowsJoin(cordovaProjectPluginsDir , dummy_id, 'src', 'windows', 'dummy3.vcxproj');
                            targetConditions = {versions: undefined, deviceTarget: 'win', arch: undefined};
                            validateUninstalledProjects('framework', frameworks[6], xmlPath, incText, targetConditions, ['windows', 'windows8']);

                            incText = windowsJoin(cordovaProjectPluginsDir , dummy_id, 'src', 'windows', 'dummy4.vcxproj');
                            targetConditions = {versions: '8.1', deviceTarget: 'all', arch: 'x86'};
                            validateUninstalledProjects('framework', frameworks[7], xmlPath, incText, targetConditions, ['windows', 'phone']);

                            done();
                        });
                });
            });
        });
    });
});

function windowsJoin() {
    // Paths that are written to project files will be in Windows format, regardless of the current OS.
    return path.join.apply(path, arguments).split('/').join('\\');
}
