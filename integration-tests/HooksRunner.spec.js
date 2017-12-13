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
 **/

/* eslint  no-mixed-spaces-and-tabs : 0 */
/* eslint  no-tabs : 0 */

var cordova = require('../src/cordova/cordova');
var HooksRunner = require('../src/hooks/HooksRunner');
var shell = require('shelljs');
var path = require('path');
var fs = require('fs');
var os = require('os');
var Q = require('q');
var child_process = require('child_process');
var helpers = require('../spec/helpers');
var PluginInfo = require('cordova-common').PluginInfo;
var superspawn = require('cordova-common').superspawn;

var platform = os.platform();
var tmpDir = helpers.tmpDir('hooks_test');
var project = path.join(tmpDir, 'project');
var dotCordova = path.join(project, '.cordova');
var hooksDir = path.join(project, 'hooks');
var hooksDirDot = path.join(project, '.cordova', 'hooks');
var scriptsDir = path.join(project, 'scripts');
var ext = platform.match(/(win32|win64)/) ? 'bat' : 'sh';
var fixtures = path.join(__dirname, '..', 'spec', 'cordova', 'fixtures');
var testPluginFixturePath = path.join(fixtures, 'plugins', 'com.plugin.withhooks');

var cordovaUtil = require('../src/cordova/util');

// copy fixture
shell.rm('-rf', project);
shell.mkdir('-p', project);
shell.cp('-R', path.join(fixtures, 'projWithHooks', '*'), project);

shell.mkdir('-p', dotCordova);
shell.cp('-R', path.join(fixtures, 'projWithHooks', '.cordova'), project);

// copy sh/bat scripts
if (ext === 'bat') {
    shell.cp('-R', path.join(fixtures, 'projWithHooks', '_bat', '*'), project);
    shell.cp('-R', path.join(fixtures, 'projWithHooks', '_bat', '.cordova'), project);
} else {
    shell.cp('-R', path.join(fixtures, 'projWithHooks', '_sh', '*'), project);
    shell.cp('-R', path.join(fixtures, 'projWithHooks', '_sh', '.cordova'), project);
}

shell.chmod('-R', 'ug+x', hooksDir);
shell.chmod('-R', 'ug+x', hooksDirDot);
shell.chmod('-R', 'ug+x', scriptsDir);

// To get more verbose output to help trace program flow, uncomment the lines below
// TODO: think about how to factor this out so that it can be invoked from the command line
// var events = require('cordova-common').events;
// events.on('log', function(msg) { console.log(msg); });
// events.on('verbose', function(msg) { console.log(msg); });
// events.on('warn', function(msg) { console.log(msg); });

describe('HooksRunner', function () {
    var hooksRunner;
    var hookOptions;
    var testPluginInstalledPath;
    var projectRoot;
    var fire;

    beforeEach(function () {
        process.chdir(project);
    });

    afterEach(function () {
        process.chdir(path.join(__dirname, '..')); // Non e2e tests assume CWD is repo root.
    });

    it('Test 001 : should throw if provided directory is not a cordova project', function () {
        expect(function () {
            new HooksRunner(tmpDir); // eslint-disable-line no-new
        }).toThrow();
    });

    it('Test 002 : should not throw if provided directory is a cordova project', function () {
        expect(function () {
            new HooksRunner(project); // eslint-disable-line no-new
        }).not.toThrow();
    });

    it('Test 003 : should init test fixtures', function (done) {
        hooksRunner = new HooksRunner(project);

        // Add the testing platform.
        cordova.platform('add', [helpers.testPlatform], {'fetch': true}).fail(function (err) {
            expect(err).toBeUndefined();
            console.error(err);
            done();
        }).then(function () {
            // Add the testing plugin
            projectRoot = cordovaUtil.isCordova();

            var options = {
                verbose: false,
                platforms: [],
                options: []
            };

            options = cordovaUtil.preProcessOptions(options);
            hookOptions = { projectRoot: project, cordova: options };

            cordova.plugin('add', testPluginFixturePath, {'fetch': true}).fail(function (err) {
                expect(err && err.stack).toBeUndefined();
                done();
            }).then(function () {
                testPluginInstalledPath = path.join(projectRoot, 'plugins', 'com.plugin.withhooks');
                done();
            });
        });
    }, 100000);

    describe('fire method', function () {
        beforeEach(function () {
            projectRoot = cordovaUtil.isCordova();

            var options = {
                verbose: false,
                platforms: [],
                options: []
            };

            options = cordovaUtil.preProcessOptions(options);
            hookOptions = { projectRoot: project, cordova: options };

            var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');
            removeFileIfExists(hooksOrderFile);

            fire = spyOn(HooksRunner.prototype, 'fire').and.callThrough();
        });

        // helper methods
        function hooksOrderFileContents (hooksOrderFile) {
            var order = fs.readFileSync(hooksOrderFile, 'ascii').replace(/\W/gm, ' ');

            var orderArrOriginal = order.split(' ').slice(0);

            function splitNumbers (mixedString) {
                var re = /\w+/g;
                var match;
                var params = [];

                while (match = re.exec(mixedString)) { // eslint-disable-line no-cond-assign
                    params.push(match[0]);
                }
                return params;
            }

            return splitNumbers(orderArrOriginal).map(function (str) { return parseInt(str, 10); });
        }

        function hooksOrderFileIsOrdered (hooksOrderFile) {
            var splitArrOriginal = hooksOrderFileContents(hooksOrderFile);
            var splitArrSorted = splitArrOriginal.slice(0).sort(function (a, b) { return a - b; });

            return JSON.stringify(splitArrOriginal) === JSON.stringify(splitArrSorted);
        }

        function backupAppConfig (projectRoot) {
            shell.cp('-f', path.join(projectRoot, 'config.xml'), path.join(projectRoot, 'configOrig.xml'));
        }

        function restoreAppConfig (projectRoot) {
            shell.cp('-f', path.join(projectRoot, 'configOrig.xml'), path.join(projectRoot, 'config.xml'));
            shell.rm('-rf', path.join(projectRoot, 'configOrig.xml'));
        }

        function switchToOnlyNonPlatformScriptsAppConfig (projectRoot) {
            backupAppConfig(projectRoot);
            shell.cp('-f', path.join(projectRoot, 'configOnlyNonPlatformScripts_' + ext + '.xml'), path.join(projectRoot, 'config.xml'));
        }

        function switchToOnePlatformScriptsAppConfig (projectRoot) {
            backupAppConfig(projectRoot);
            shell.cp('-f', path.join(projectRoot, 'configOnePlatform_' + ext + '.xml'), path.join(projectRoot, 'config.xml'));
        }

        function switchToTwoPlatformsScriptsAppConfig (projectRoot) {
            backupAppConfig(projectRoot);
            shell.cp('-f', path.join(projectRoot, 'configTwoPlatforms_' + ext + '.xml'), path.join(projectRoot, 'config.xml'));
        }

        function backupPluginConfig () {
            shell.cp('-f', path.join(testPluginInstalledPath, 'plugin.xml'), path.join(testPluginInstalledPath, 'pluginOrig.xml'));
        }

        function restorePluginConfig () {
            shell.cp('-f', path.join(testPluginInstalledPath, 'pluginOrig.xml'), path.join(testPluginInstalledPath, 'plugin.xml'));
            shell.rm('-rf', path.join(testPluginInstalledPath, 'pluginOrig.xml'));
        }

        function switchToOnlyNonPlatformScriptsPluginConfig (projectRoot) {
            backupPluginConfig();
            shell.cp('-f', path.join(testPluginInstalledPath, 'pluginOnlyNonPlatformScripts_' + ext + '.xml'), path.join(testPluginInstalledPath, 'plugin.xml'));
        }

        function switchToOnePlatformScriptsPluginConfig (projectRoot) {
            backupPluginConfig();
            shell.cp('-f', path.join(testPluginInstalledPath, 'pluginOnePlatform_' + ext + '.xml'), path.join(testPluginInstalledPath, 'plugin.xml'));
        }

        function switchToTwoPlatformsScriptsPluginConfig (projectRoot) {
            backupPluginConfig();
            shell.cp('-f', path.join(testPluginInstalledPath, 'pluginTwoPlatforms_' + ext + '.xml'), path.join(testPluginInstalledPath, 'plugin.xml'));
        }

        function removeFileIfExists (file) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
            }
        }

        describe('application hooks', function () {
            it('Test 004 : should execute hook scripts serially', function (done) {
                var test_event = 'before_build';
                var projectRoot = cordovaUtil.isCordova();
                var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(hooksOrderFile).toExist();

                    expect(hooksOrderFileIsOrdered(hooksOrderFile)).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    done();
                });
            });

            it('Test 005 : should execute hook scripts serially from .cordova/hooks/hook_type and hooks/hook_type directories', function (done) {
                var test_event = 'before_build';
                var projectRoot = cordovaUtil.isCordova();
                var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');

                // using empty platforms list to test only hooks/ directories
                hookOptions.cordova.platforms = [];

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(hooksOrderFile).toExist();

                    expect(hooksOrderFileIsOrdered(hooksOrderFile)).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    done();
                });
            }, 60000);

            it('Test 006 : should execute hook scripts serially from config.xml', function (done) {
                var test_event = 'before_build';
                var projectRoot = cordovaUtil.isCordova();
                var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');

                switchToOnlyNonPlatformScriptsAppConfig(projectRoot);

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(hooksOrderFile).toExist();

                    expect(hooksOrderFileIsOrdered(hooksOrderFile)).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    restoreAppConfig(projectRoot);
                    done();
                });
            });

            it('Test 007 : should execute hook scripts serially from config.xml including platform scripts', function (done) {
                var test_event = 'before_build';
                var projectRoot = cordovaUtil.isCordova();
                var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');

                switchToOnePlatformScriptsAppConfig(projectRoot);

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(hooksOrderFile).toExist();

                    expect(hooksOrderFileIsOrdered(hooksOrderFile)).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    restoreAppConfig(projectRoot);
                    done();
                });
            });

            it('Test 008 : should filter hook scripts from config.xml by platform', function (done) {
                var test_event = 'before_build';
                var projectRoot = cordovaUtil.isCordova();
                var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');

                switchToTwoPlatformsScriptsAppConfig(projectRoot);

                hookOptions.cordova.platforms = ['android'];

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(hooksOrderFile).toExist();

                    expect(hooksOrderFileIsOrdered(hooksOrderFile)).toBe(true);

                    var baseScriptResults = [1, 2, 3, 4, 5, 6, 7, 8, 9];
                    var androidPlatformScriptsResults = [14, 15];

                    expect(JSON.stringify(hooksOrderFileContents(hooksOrderFile)) ===
                        JSON.stringify(baseScriptResults.slice(0).concat(androidPlatformScriptsResults))).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    restoreAppConfig(projectRoot);
                    done();
                });
            });
        });

        describe('plugin hooks', function () {
            it('Test 011 : should filter hook scripts from plugin.xml by platform', function (done) {
                shell.chmod('-R', 'ug+x', path.join(testPluginInstalledPath, 'scripts'));
                var test_event = 'before_build';
                var projectRoot = cordovaUtil.isCordova();
                var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');

                switchToTwoPlatformsScriptsPluginConfig(projectRoot);

                hookOptions.cordova.platforms = ['android'];

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(hooksOrderFile).toExist();

                    expect(hooksOrderFileIsOrdered(hooksOrderFile)).toBe(true);

                    var baseScriptResults = [1, 2, 3, 4, 5, 6, 7, 21, 22];
                    var androidPlatformScriptsResults = [26];

                    expect(JSON.stringify(hooksOrderFileContents(hooksOrderFile)) ===
                        JSON.stringify(baseScriptResults.slice(0).concat(androidPlatformScriptsResults))).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    restorePluginConfig(projectRoot);
                    done();
                });
            });

            it('Test 012 : should run before_plugin_uninstall, before_plugin_install, after_plugin_install hooks for a plugin being installed with correct opts.plugin context', function (done) {
                var projectRoot = cordovaUtil.isCordova();

                // remove plugin
                cordova.plugin('rm', 'com.plugin.withhooks').fail(function (err) {
                    expect(err.stack).toBeUndefined();
                }).then(function () {
                    cordova.plugin('add', testPluginFixturePath, {'fetch': true}).fail(function (err) {
                        expect(err).toBeUndefined();
                    }).then(function () {
                        testPluginInstalledPath = path.join(projectRoot, 'plugins', 'com.plugin.withhooks');
                        shell.chmod('-R', 'ug+x', path.join(testPluginInstalledPath, 'scripts'));

                        var pluginInfo = new PluginInfo(testPluginInstalledPath);

                        var cordovaVersion = require('../package').version;

                        var androidPluginOpts = {
                            cordova: {
                                platforms: [ 'android' ],
                                plugins: ['com.plugin.withhooks'],
                                version: cordovaVersion
                            },
                            plugin: {
                                id: 'com.plugin.withhooks',
                                pluginInfo: pluginInfo,
                                platform: 'android',
                                dir: testPluginInstalledPath
                            },
                            projectRoot: projectRoot
                        };
                        // Delete unique ids to allow comparing PluginInfo
                        delete androidPluginOpts.plugin.pluginInfo._et;

                        fire.calls.all().forEach(function (call) {
                            if (call.args[1] && call.args[1].plugin) {
                                // Delete unique ids to allow comparing PluginInfo
                                delete call.args[1].plugin.pluginInfo._et;
                            }

                            if (call.args[0] === 'before_plugin_uninstall' ||
                                call.args[0] === 'before_plugin_install' ||
                                call.args[0] === 'after_plugin_install') {
                                if (call.args[1]) {
                                    expect(call.args[1].plugin).toBeDefined();
                                    if (call.args[1].plugin.platform === 'android') {
                                        expect(JSON.stringify(androidPluginOpts) ===
                                            JSON.stringify(call.args[1])).toBe(true);
                                    }
                                }
                            }
                        });
                    }).fail(function (err) {
                        expect(err).toBeUndefined();
                    }).fin(done);
                });
            });
        });

        describe('plugin hooks', function () {
        	beforeEach(function () {
        		spyOn(superspawn, 'spawn').and.callFake(function (cmd, args) {
		            if (cmd.match(/create\b/)) {
		                // This is a call to the bin/create script, so do the copy ourselves.
		                shell.cp('-R', path.join(fixtures, 'platforms', 'android'), path.join(project, 'platforms'));
		            } else if (cmd.match(/update\b/)) {
		                fs.writeFileSync(path.join(project, 'platforms', helpers.testPlatform, 'updated'), 'I was updated!', 'utf-8');
		            } else if (cmd.match(/version/)) {
		                return '3.6.0';
		            }
		            return Q();
		        });
        	});

            it('Test 009 : should execute hook scripts serially from plugin.xml', function (done) {
                var test_event = 'before_build';
                var projectRoot = cordovaUtil.isCordova();
                var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');

                switchToOnlyNonPlatformScriptsPluginConfig();

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(hooksOrderFile).toExist();

                    expect(hooksOrderFileIsOrdered(hooksOrderFile)).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    restorePluginConfig(projectRoot);
                    done();
                });
            });

            it('Test 010 : should execute hook scripts serially from plugin.xml including platform scripts', function (done) {
                var test_event = 'before_build';
                var projectRoot = cordovaUtil.isCordova();
                var hooksOrderFile = path.join(projectRoot, 'hooks_order.txt');

                switchToOnePlatformScriptsPluginConfig();

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(hooksOrderFile).toExist();

                    expect(hooksOrderFileIsOrdered(hooksOrderFile)).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    restorePluginConfig(projectRoot);
                    done();
                });
            });

            it('Test 013 : should not execute the designated hook when --nohooks option specifies the exact hook name', function (done) {
                var test_event = 'before_build';
                hookOptions.nohooks = ['before_build'];

                return hooksRunner.fire(test_event, hookOptions).then(function (msg) {
                    expect(msg).toBeDefined();
                    expect(msg).toBe('hook before_build is disabled.');
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    done();
                });
            });

            it('Test 014 : should not execute a set of matched hooks when --nohooks option specifies the hook pattern.', function (done) {
                var test_events = ['before_build', 'after_plugin_add', 'before_platform_rm', 'before_prepare'];
                hookOptions.nohooks = ['before*'];

                return test_events.reduce(function (soFar, test_event) {
                    return soFar.then(function () {
                        return hooksRunner.fire(test_event, hookOptions).then(function (msg) {
                            if (msg) {
                                expect(msg).toBe('hook ' + test_event + ' is disabled.');
                            } else {
                                expect(test_event).toBe('after_plugin_add');
                            }
                        });
                    });
                }, Q()).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    done();
                });
            });

            it('Test 015 : should not execute all hooks when --nohooks option specifies .', function (done) {
                var test_events = ['before_build', 'after_plugin_add', 'before_platform_rm', 'before_prepare'];
                hookOptions.nohooks = ['.'];

                return test_events.reduce(function (soFar, test_event) {
                    return soFar.then(function () {
                        return hooksRunner.fire(test_event, hookOptions).then(function (msg) {
                            expect(msg).toBeDefined();
                            expect(msg).toBe('hook ' + test_event + ' is disabled.');
                        });
                    });
                }, Q()).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    done();
                });
            });
        });

        describe('module-level hooks (event handlers)', function () {
            var handler = jasmine.createSpy().and.returnValue(Q());
            var test_event = 'before_build';

            afterEach(function () {
                cordova.removeAllListeners(test_event);
                handler.calls.reset();
            });

            it('Test 016 : should fire handlers using cordova.on', function (done) {
                cordova.on(test_event, handler);
                hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(handler).toHaveBeenCalled();
                }).fail(function (err) {
                    expect(err).not.toBeDefined();
                }).fin(done);
            });

            it('Test 017 : should pass the project root folder as parameter into the module-level handlers', function (done) {
                cordova.on(test_event, handler);
                hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(handler).toHaveBeenCalledWith(hookOptions);
                }).fail(function (err) {
                    console.log(err);
                    expect(err).not.toBeDefined();
                }).fin(done);
            });

            it('Test 018 : should be able to stop listening to events using cordova.off', function (done) {
                cordova.on(test_event, handler);
                cordova.off(test_event, handler);
                hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(handler).not.toHaveBeenCalled();
                }).fail(function (err) {
                    console.log(err);
                    expect(err).toBeUndefined();
                }).fin(done);
            });

            it('Test 019 : should execute event listeners serially', function (done) {
                var h1_fired = false;
                var h2_fired;
                var h1 = function () {
                    expect(h2_fired).toBe(false);
                    // Delay 100 ms here to check that h2 is not executed until after
                    // the promise returned by h1 is resolved.
                    var q = Q.delay(100).then(function () {
                        h1_fired = true;
                    });
                    return q;
                };
                h2_fired = false;
                var h2 = function () {
                    h2_fired = true;
                    expect(h1_fired).toBe(true);
                    return Q();
                };

                cordova.on(test_event, h1);
                cordova.on(test_event, h2);

                return hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(h1_fired).toBe(true);
                    expect(h2_fired).toBe(true);
                }).fail(function (err) {
                    expect(err).toBeUndefined();
                }).then(function () {
                    cordova.removeAllListeners(test_event);
                    done();
                });
            });

            it('Test 020 : should allow for hook to opt into asynchronous execution and block further hooks from firing using the done callback', function (done) {
                var h1_fired = false;
                var h2_fired;
                var h1 = function () {
                    h1_fired = true;
                    expect(h2_fired).toBe(false);
                    return Q();
                };
                h2_fired = false;
                var h2 = function () {
                    h2_fired = true;
                    expect(h1_fired).toBe(true);
                    return Q();
                };

                cordova.on(test_event, h1);
                cordova.on(test_event, h2);
                hooksRunner.fire(test_event, hookOptions).then(function () {
                    expect(h1_fired).toBe(true);
                    expect(h2_fired).toBe(true);
                    done();
                });
            });

            it('Test 021 : should pass data object that fire calls into async handlers', function (done) {
                var async = function (opts) {
                    expect(opts).toEqual(hookOptions);
                    return Q();
                };
                cordova.on(test_event, async);
                hooksRunner.fire(test_event, hookOptions).then(function () {
                    done();
                });
            }, 80000);

            it('Test 022 : should pass data object that fire calls into sync handlers', function (done) {
                var async = function (opts) {
                    expect(opts).toEqual(hookOptions);
                };
                cordova.on(test_event, async);
                hooksRunner.fire(test_event, hookOptions).fin(done);
            });

            it('Test 023 : should error if any script exits with non-zero code', function (done) {
                hooksRunner.fire('fail', hookOptions).then(function () {
                    expect('the call').toBe('a failure');
                }, function (err) {
                    expect(err).toBeDefined();
                }).fin(done);
            });
        });

        it('Test 024 :should not error if the hook is unrecognized', function (done) {
            hooksRunner.fire('CLEAN YOUR SHORTS GODDAMNIT LIKE A BIG BOY!', hookOptions).fail(function (err) {
                expect('Call with unrecognized hook ').toBe('successful.\n' + err);
            }).fin(done);
        });
    });

    // Cleanup. Must be the last spec. Is there a better place for final cleanup in Jasmine?
    it('Test 025 : should not fail during cleanup', function () {
        process.chdir(path.join(__dirname, '..')); // Non e2e tests assume CWD is repo root.
        if (ext === 'sh') {
            shell.rm('-rf', tmpDir);
        } else { // Windows:
            // For some mysterious reason, both shell.rm and RMDIR /S /Q won't
            // delete the dir on Windows, but they do remove the files leaving
            // only folders. But the dir is removed just fine by
            // shell.rm('-rf', tmpDir) at the top of this file with the next
            // invocation of this test. The benefit of RMDIR /S /Q is that it
            // doesn't print warnings like shell.rmdir() that look like this:
            // rm: could not remove directory (code ENOTEMPTY): C:\Users\...
            var cmd = 'RMDIR /S /Q ' + tmpDir;
            child_process.exec(cmd);
        }
    });
});
