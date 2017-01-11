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
    os = require('os'),
    cordovaProjectDir = path.join(os.tmpdir(), 'plugman'),
    cordovaProjectWindowsPlatformDir = path.join(cordovaProjectDir, 'platforms', 'windows'),
    cordovaProjectPluginsDir = path.join(cordovaProjectDir, 'plugins'),
    dummyplugin = path.join(__dirname, '..', 'plugins', 'org.test.plugins.dummyplugin'),
    faultyplugin = path.join(__dirname, '..', 'plugins', 'org.test.plugins.faultyplugin');

var PluginInfo = require('cordova-common').PluginInfo;

var dummyPluginInfo = new PluginInfo(dummyplugin);
var dummy_id = dummyPluginInfo.id;
var valid_source = dummyPluginInfo.getSourceFiles('windows');
var valid_resourceFiles = dummyPluginInfo.getResourceFiles('windows');
var valid_libfiles = dummyPluginInfo.getLibFiles('windows');
var valid_frameworks = dummyPluginInfo.getFrameworks('windows');

var faultyPluginInfo = new PluginInfo(faultyplugin);
var faulty_id = faultyPluginInfo.id;
var invalid_source = faultyPluginInfo.getSourceFiles('windows');
var invalid_resourceFiles = faultyPluginInfo.getResourceFiles('windows');
var invalid_libfiles = faultyPluginInfo.getLibFiles('windows');

function copyArray(arr) {
    return Array.prototype.slice.call(arr, 0);
}

beforeEach(function () {
    jasmine.addMatchers({
        toContainXmlPath: function () {
            return {
                compare: function(actual, expected) {
                    var xml = actual;
                    var result = {};
                    result.pass = xml.find(expected) !== null;

                    if(result.pass) {
                        result.message = 'Expected xml \'' + et.tostring(xml) + '\' ' +' not to contain elements matching \'' + expected + '\'.';
                    } else {
                        result.message = 'Expected xml \'' + et.tostring(xml) + '\' ' +' to contain elements matching \'' + expected + '\'.';
                    }
                    return result;
                }
            };
        }
    }); 
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
            windows8: 'CordovaApp.Windows80.jsproj',
            windows10: 'CordovaApp.Windows10.jsproj'
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
            it('Test 001 : should return cordova-windows project www location using www_dir', function (done) {
                expect(windows.www_dir(path.sep)).toEqual(path.sep + 'www');
                done();
            });
        });
        describe('package_name method', function () {
            it('Test 002 : should return a windows project\'s proper package name', function (done) {
                expect(windows.package_name(windows_project)).toEqual('CordovaApp');
                done();
            });
        });

        describe('parseProjectFile method', function () {
            it('Test 003 : should throw if project is not an windows project', function (done) {
                expect(function () {
                    windows.parseProjectFile(cordovaProjectWindowsPlatformDir);
                }).toThrow(new Error (windows.InvalidProjectPathError));
                done();
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

                var projects = copyArray(proj_files.projects);
                if (platform === 'windows') {
                    projects.push(proj_files.master);
                }

                // Check that installed framework reference is properly added to project.
                var checkInstalledFrameworkReference = function (tag, elementToInstall, xml) {
                    var frameworkCustomPathElement = xml.find(xpath);
                    expect(frameworkCustomPathElement).not.toBe(null);
                    var frameworkCustomPath = frameworkCustomPathElement.text;
                    expect(frameworkCustomPath).not.toBe(null);
                    var targetDir = elementToInstall.targetDir || '';
                    var frameworkCustomExpectedPath = path.join('plugins', dummy_id, targetDir,
                        path.basename(elementToInstall.src));
                    expect(frameworkCustomPath).toEqual(frameworkCustomExpectedPath);
                };

                // Check that framework file was copied to correct path
                var checkInstalledFrameworkPath = function (framework) {
                    var targetDir = framework.targetDir || '';
                    var dest = path.join(cordovaProjectWindowsPlatformDir, 'plugins', dummy_id, targetDir, path.basename(framework.src));
                    var copiedSuccessfully = fs.existsSync(path.resolve(dest));
                    expect(copiedSuccessfully).toBe(true);
                };

                // Check that resource file was copied to correct path
                var checkInstalledResourcePath = function (resource) {
                    var dest = path.join(cordovaProjectWindowsPlatformDir, resource.target);
                    var copiedSuccessfully = fs.existsSync(path.resolve(dest));
                    expect(copiedSuccessfully).toBe(true);
                };

                var appendToRootFake = function (itemGroup) {
                    // In case we install framework with 'custom' attribute set to 'true'
                    // we verify that file is copied to correct dir and reference is added properly.
                    // This is not required in case of 'projectReference' attribute is used.
                    if (tag === 'framework' && elementToInstall.type !== 'projectReference') {
                        checkInstalledFrameworkReference(tag, elementToInstall, itemGroup);
                        checkInstalledFrameworkPath(elementToInstall);
                        return;
                    } else if (tag === 'resource-file') {
                        checkInstalledResourcePath(elementToInstall);
                    }
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
                        projectsAddedToSpies.push(spyOn(project, 'appendToRoot').and.callFake(appendToRootFake));
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
                it('Test 004 : should copy stuff from one location to another by calling common.copyFile', function (done) {
                    var source = copyArray(valid_source);
                    var s = spyOn(common, 'copyFile');
                    windows['source-file'].install(source[0], dummyplugin, cordovaProjectWindowsPlatformDir, dummy_id, null, proj_files);
                    expect(s).toHaveBeenCalledWith(dummyplugin, 'src/windows/dummer.js', cordovaProjectWindowsPlatformDir, path.join('plugins', 'org.test.plugins.dummyplugin', 'dummer.js'), false);
                    done();
                });
                it('Test 005 : should throw if source-file src cannot be found', function (done) {
                    var source = copyArray(invalid_source);
                    expect(function () {
                        windows['source-file'].install(source[1], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow(new Error ('"' + path.resolve(faultyplugin, 'src/windows/NotHere.js') + '" not found!'));
                    done();
                });
                it('Test 006 : should throw if source-file target already exists', function (done) {
                    var source = copyArray(valid_source);
                    var target = path.join(cordovaProjectWindowsPlatformDir, 'plugins', dummy_id, 'dummer.js');
                    shell.mkdir('-p', path.dirname(target));
                    fs.writeFileSync(target, 'some bs', 'utf-8');
                    expect(function () {
                        windows['source-file'].install(source[0], dummyplugin, cordovaProjectWindowsPlatformDir, dummy_id, null, proj_files);
                    }).toThrow(new Error ('"' + target + '" already exists!'));
                    done();
                });
            });

            describe('of <resource-file> elements', function () {
                var resourceFiles = copyArray(valid_resourceFiles);
                var invalidResourceFiles = copyArray(invalid_resourceFiles);

                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('Test 007 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Content[@Include="' + resourceFiles[0].target + '"][@Condition="\'$(Platform)\'==\'x86\'"]';
                    validateInstalledProjects('resource-file', resourceFiles[0], xpath, ['all']);
                    done();
                });

                it('Test 008 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Content[@Include="' + resourceFiles[1].target + '"]';
                    validateInstalledProjects('resource-file', resourceFiles[1], xpath, ['windows', 'phone', 'windows10']);
                    done();
                });

                it('Test 009 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Content[@Include="' + resourceFiles[2].target + '"]';
                    validateInstalledProjects('resource-file', resourceFiles[2], xpath, ['phone']);
                    done();
                });

                it('Test 010 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Content[@Include="' + resourceFiles[3].target + '"][@Condition="\'$(Platform)\'==\'x64\'"]';
                    validateInstalledProjects('resource-file', resourceFiles[3], xpath, ['windows8']);
                    done();
                });

                it('Test 011 : should throw if conditions are invalid', function (done) {
                    expect(function () {
                        windows['resource-file'].install(invalidResourceFiles[0], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow(new Error ('Invalid arch attribute (must be "x86", "x64" or "ARM"): x85'));

                    expect(function () {
                        windows['resource-file'].install(invalidResourceFiles[1], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow(new Error ('Invalid versions attribute (must be a valid semantic version range): 8.0a'));

                    expect(function () {
                        windows['resource-file'].install(invalidResourceFiles[2], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow(new Error ('Invalid device-target attribute (must be "all", "phone", "windows" or "win"): daphne'));
                    done();
                });
            });

            describe('of <lib-file> elements', function () {
                var libfiles = copyArray(valid_libfiles);
                var invalidLibFiles = copyArray(invalid_libfiles);

                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('Test 012 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'SDKReference[@Include="TestSDK1, Version=1.0"][@Condition="\'$(Platform)\'==\'x86\'"]';
                    validateInstalledProjects('lib-file', libfiles[0], xpath, ['all']);
                    done();
                });

                it('Test 013 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'SDKReference[@Include="TestSDK2, Version=1.0"]';
                    validateInstalledProjects('lib-file', libfiles[1], xpath, ['windows', 'phone', 'windows10']);
                    done();
                });
                
                it('Test 014 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'SDKReference[@Include="TestSDK3, Version=1.0"]';
                    validateInstalledProjects('lib-file', libfiles[2], xpath, ['phone']);
                    done();
                });

                it('Test 015 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'SDKReference[@Include="TestSDK4, Version=1.0"]';
                    validateInstalledProjects('lib-file', libfiles[3], xpath, ['windows8']);
                    done();
                });

                it('Test 016 : should throw if conditions are invalid', function (done) {
                    expect(function () {
                        windows['lib-file'].install(invalidLibFiles[0], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow(new Error('Invalid arch attribute (must be "x86", "x64" or "ARM"): x85'));

                    done();
                });
                
                it('Test 017 : should throw if conditions are invalid', function (done) {
                    expect(function () {
                        windows['lib-file'].install(invalidLibFiles[1], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow(new Error ('Invalid versions attribute (must be a valid semantic version range): 8.0a'));
                    done();
                });
                
                it('Test 018 : should throw if conditions are invalid', function (done) {
                    expect(function () {
                        windows['lib-file'].install(invalidLibFiles[2], faultyplugin, cordovaProjectWindowsPlatformDir, faulty_id, null, proj_files);
                    }).toThrow(new Error ('Invalid device-target attribute (must be "all", "phone", "windows" or "win"): daphne'));
                    done();
                });
            });

            describe('of <framework> elements', function () {
                var frameworks = copyArray(valid_frameworks);

                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('Test 019 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Reference[@Include="dummy1"][@Condition="\'$(Platform)\'==\'x64\'"]/HintPath';
                    validateInstalledProjects('framework', frameworks[0], xpath, ['all']);
                    done();
                });
                it('Test 020 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Reference[@Include="dummy2"]/HintPath';
                    validateInstalledProjects('framework', frameworks[1], xpath, ['all']);
                    done();
                });
                
                it('Test 021 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Reference[@Include="dummy3"]/HintPath';
                    validateInstalledProjects('framework', frameworks[2], xpath, ['windows', 'windows8', 'windows10']);
                    done();
                });
                
                it('Test 022 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Reference[@Include="dummy4"][@Condition="\'$(Platform)\'==\'ARM\'"]/HintPath';
                    validateInstalledProjects('framework', frameworks[3], xpath, ['phone']);
                    done();
                });

                it('Test 023 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Reference[@Include="dummy5"]/HintPath';
                    validateInstalledProjects('framework', frameworks[4], xpath, ['phone']);
                    done();
                });

                it('Test 024 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'Reference[@Include="dummy6"]/HintPath';
                    validateInstalledProjects('framework', frameworks[5], xpath, ['windows', 'windows10', 'phone']);
                    done();
                });
            });

            describe('of <framework> elements of type \'projectReference\'', function () {
                var frameworks = copyArray(valid_frameworks);

                it('Test 025 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'ProjectReference[@Include="' + windowsJoin(dummyplugin, 'src', 'windows', 'dummy1.vcxproj') + '"][@Condition="\'$(Platform)\'==\'x64\'"]';
                    validateInstalledProjects('framework', frameworks[6], xpath, ['all']);
                    done();
                });
                
                it('Test 026 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'ProjectReference[@Include="' + windowsJoin(dummyplugin, 'src', 'windows', 'dummy2.vcxproj') + '"]';
                    validateInstalledProjects('framework', frameworks[7], xpath, ['windows8']);
                    done();
                });
                
                it('Test 027 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'ProjectReference[@Include="' + windowsJoin(dummyplugin, 'src', 'windows', 'dummy3.vcxproj') + '"]';
                    validateInstalledProjects('framework', frameworks[8], xpath, ['windows', 'windows8', 'windows10']);
                    done();
                });
                
                it('Test 028 : should write to correct project files when conditions are specified', function (done) {
                    var xpath = 'ProjectReference[@Include="' + windowsJoin(dummyplugin, 'src', 'windows', 'dummy4.vcxproj') + '"][@Condition="\'$(Platform)\'==\'x86\'"]';
                    validateInstalledProjects('framework', frameworks[9], xpath, ['windows', 'phone']);
                    done();
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
                //jasmine.getEnv().currentSpec.removeAllSpies();

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
                    var spy = spyOn(project, 'removeItemGroupElement');
                    

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
                it('Test 029 : should remove stuff by calling common.removeFile', function (done) {
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

            describe('of <resource-file> elements', function () {
                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('Test 030 : should remove from correct project files when conditions specified', function (done) {
                    var resourcefiles = copyArray(valid_resourceFiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Content';
                            var incText = resourcefiles[0].target;
                            var targetConditions = {versions: undefined, deviceTarget: undefined, arch: 'x86'};
                            validateUninstalledProjects('resource-file', resourcefiles[0], path, incText, targetConditions, ['all']);
                            done();
                        });
                });
                it('Test 031 : should remove from correct project files when conditions specified', function (done) {
                    var resourcefiles = copyArray(valid_resourceFiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Content';
                            var incText = resourcefiles[1].target;
                            var targetConditions = {versions: '>=8.1', deviceTarget: undefined, arch: undefined};
                            validateUninstalledProjects('resource-file', resourcefiles[1], path, incText, targetConditions, ['windows', 'phone', 'windows10']);
                            done();
                        });
                });
                it('Test 032 : should remove from correct project files when conditions specified', function (done) {
                    var resourcefiles = copyArray(valid_resourceFiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Content';
                            var incText = resourcefiles[2].target;
                            var targetConditions = {versions: undefined, deviceTarget: 'phone', arch: undefined};
                            validateUninstalledProjects('resource-file', resourcefiles[2], path, incText, targetConditions, ['phone']);
                            done();
                        });
                });
                it('Test 033 : should remove from correct project files when conditions specified', function (done) {
                    var resourcefiles = copyArray(valid_resourceFiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Content';
                            var incText = resourcefiles[3].target;
                            var targetConditions = {versions: '8.0', deviceTarget: 'windows', arch: 'x64'};
                            validateUninstalledProjects('resource-file', resourcefiles[3], path, incText, targetConditions, ['windows8']);
                            done();
                        });
                });
            });

            describe('of <lib-file> elements', function () {
                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('Test 034 : should remove from correct project files when conditions specified', function (done) {
                    var libfiles = copyArray(valid_libfiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/SDKReference';
                            var incText = 'TestSDK1, Version=1.0';
                            var targetConditions = {versions: undefined, deviceTarget: undefined, arch: 'x86'};
                            validateUninstalledProjects('lib-file', libfiles[0], path, incText, targetConditions, ['all']);
                            done();
                        });
                });

                it('Test 035 : should remove from correct project files when conditions specified', function (done) {
                    var libfiles = copyArray(valid_libfiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/SDKReference';
                            var incText = 'TestSDK2, Version=1.0';
                            var targetConditions = {versions: '>=8.1', deviceTarget: undefined, arch: undefined};
                            validateUninstalledProjects('lib-file', libfiles[1], path, incText, targetConditions, ['windows', 'phone', 'windows10']);
                            done();
                        });
                });

                it('Test 036 : should remove from correct project files when conditions specified', function (done) {
                    var libfiles = copyArray(valid_libfiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/SDKReference';
                            var incText = 'TestSDK3, Version=1.0';
                            var targetConditions = {versions: undefined, deviceTarget: 'phone', arch: undefined};
                            validateUninstalledProjects('lib-file', libfiles[2], path, incText, targetConditions, ['phone']);
                            done();
                        });
                });

                it('Test 037 : should remove from correct project files when conditions specified', function (done) {
                    var libfiles = copyArray(valid_libfiles);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/SDKReference';
                            var incText = 'TestSDK4, Version=1.0';
                            var targetConditions = {versions: '8.0', deviceTarget: 'windows', arch: 'x86'};
                            validateUninstalledProjects('lib-file', libfiles[3], path, incText, targetConditions, ['windows8']);
                            done();
                        });
                });
            });

            describe('of <framework> elements', function () {
                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('Test 038 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Reference';
                            var incText = 'dummy1';
                            var targetConditions = {versions: undefined, deviceTarget: undefined, arch: 'x64'};
                            validateUninstalledProjects('framework', frameworks[0], path, incText, targetConditions, ['all']);
                            done();
                        });
                }, 6000);

                it('Test 039 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Reference';
                            var incText = 'dummy2';
                            var targetConditions = {versions: '>=8.0', deviceTarget: undefined, arch: undefined};
                            validateUninstalledProjects('framework', frameworks[1], path, incText, targetConditions, ['all']);
                            done();
                        });
                }, 6000);

                it('Test 040 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Reference';
                            var incText = 'dummy3';
                            var targetConditions = {versions: undefined, deviceTarget: 'windows', arch: undefined};
                            validateUninstalledProjects('framework', frameworks[2], path, incText, targetConditions, ['windows', 'windows8', 'windows10']);
                            done();
                        });
                }, 6000);

                it('Test 041 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Reference';
                            var incText = 'dummy4';
                            var targetConditions = {versions: '8.1', deviceTarget: 'phone', arch: 'ARM'};
                            validateUninstalledProjects('framework', frameworks[3], path, incText, targetConditions, ['phone']);
                            done();
                        });
                }, 6000);

                it('Test 042 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Reference';
                            var incText = 'dummy5';
                            var targetConditions = {versions: undefined, deviceTarget: 'phone', arch: undefined};
                            validateUninstalledProjects('framework', frameworks[4], path, incText, targetConditions, ['phone']);
                            done();
                        });
                }, 6000);

                it('Test 043 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var path = 'ItemGroup/Reference';
                            var incText = 'dummy6';
                            var targetConditions = {versions: '>=8.1', deviceTarget: undefined, arch: undefined};
                            validateUninstalledProjects('framework', frameworks[5], path, incText, targetConditions, ['windows', 'windows10', 'phone']);
                            done();
                        });
                }, 6000);
            });

            describe('of <framework> elements of type \'projectReference\'', function () {
                // This could be separated into individual specs, but that results in a lot of copying and deleting the
                // project files, which is not needed.
                it('Test 044 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    return install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var xmlPath = 'ItemGroup/ProjectReference';
                            var incText = windowsJoin(cordovaProjectPluginsDir , dummy_id, 'src', 'windows', 'dummy1.vcxproj');
                            var targetConditions = {versions: undefined, deviceTarget: undefined, arch: 'x64'};
                            validateUninstalledProjects('framework', frameworks[6], xmlPath, incText, targetConditions, ['all']);
                            done();
                        });
                }, 60000);

                it('Test 045 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    return install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var xmlPath = 'ItemGroup/ProjectReference';
                            var incText = windowsJoin(cordovaProjectPluginsDir , dummy_id, 'src', 'windows', 'dummy2.vcxproj');
                            var targetConditions = {versions: '<8.1', deviceTarget: undefined, arch: undefined};
                            validateUninstalledProjects('framework', frameworks[7], xmlPath, incText, targetConditions, ['windows8']);
                            done();
                        });
                }, 60000);

                it('Test 046 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    return install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var xmlPath = 'ItemGroup/ProjectReference';
                            var incText = windowsJoin(cordovaProjectPluginsDir , dummy_id, 'src', 'windows', 'dummy3.vcxproj');
                            var targetConditions = {versions: undefined, deviceTarget: 'win', arch: undefined};
                            validateUninstalledProjects('framework', frameworks[8], xmlPath, incText, targetConditions, ['windows', 'windows8', 'windows10']);
                            done();
                        });
                }, 60000);

                it('Test 047 : should remove from correct project files when conditions specified', function (done) {
                    var frameworks = copyArray(valid_frameworks);

                    return install('windows', cordovaProjectWindowsPlatformDir, dummyplugin, cordovaProjectPluginsDir, {})
                        .then(function () {
                            var xmlPath = 'ItemGroup/ProjectReference';
                            var incText = windowsJoin(cordovaProjectPluginsDir , dummy_id, 'src', 'windows', 'dummy4.vcxproj');
                            var targetConditions = {versions: '8.1', deviceTarget: 'all', arch: 'x86'};
                            validateUninstalledProjects('framework', frameworks[9], xmlPath, incText, targetConditions, ['windows', 'phone']);
                            done();
                        });
                }, 60000);
            });
        });
    });
});

function windowsJoin() {
    // Paths that are written to project files will be in Windows format, regardless of the current OS.
    return path.join.apply(path, arguments).split('/').join('\\');
}
