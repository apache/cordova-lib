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

var uninstall = require('../src/plugman/uninstall'),
    install = require('../src/plugman/install'),
    actions = require('cordova-common').ActionStack,
    PluginInfo = require('cordova-common').PluginInfo,
    events = require('cordova-common').events,
    plugman = require('../src/plugman/plugman'),
    common  = require('./common'),
    platforms = require('../src/platforms/platforms'),
    xmlHelpers = require('cordova-common').xmlHelpers,
    et      = require('elementtree'),
    fs      = require('fs'),
    path    = require('path'),
    shell   = require('shelljs'),
    Q       = require('q'),
    spec    = __dirname,
    done    = false,
    srcProject = path.join(spec, 'projects', 'android_uninstall'),
    project = path.join(spec, 'projects', 'android_uninstall.test'),
    project2 = path.join(spec, 'projects', 'android_uninstall.test2'),
    project3 = path.join(spec, 'projects', 'android_uninstall.test3'),

    plugins_dir = path.join(spec, 'plugins'),
    plugins_install_dir = path.join(project, 'cordova', 'plugins'),
    plugins_install_dir2 = path.join(project2, 'cordova', 'plugins'),
    plugins_install_dir3 = path.join(project3, 'cordova', 'plugins'),

    plugins = {
        'org.test.plugins.dummyplugin' : path.join(plugins_dir, 'org.test.plugins.dummyplugin'),
        'A' : path.join(plugins_dir, 'dependencies', 'A'),
        'C' : path.join(plugins_dir, 'dependencies', 'C')
    },
    promise,
    dummy_id = 'org.test.plugins.dummyplugin';

var dummyPluginInfo = new PluginInfo(plugins['org.test.plugins.dummyplugin']);

var TEST_XML = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<widget xmlns     = "http://www.w3.org/ns/widgets"\n' +
    '        xmlns:cdv = "http://cordova.apache.org/ns/1.0"\n' +
    '        id        = "io.cordova.hellocordova"\n' +
    '        version   = "0.0.1">\n' +
    '    <name>Hello Cordova</name>\n' +
    '    <description>\n' +
    '        A sample Apache Cordova application that responds to the deviceready event.\n' +
    '    </description>\n' +
    '    <author href="http://cordova.io" email="dev@cordova.apache.org">\n' +
    '        Apache Cordova Team\n' +
    '    </author>\n' +
    '    <content src="index.html" />\n' +
    '    <access origin="*" />\n' +
    '</widget>\n';

function uninstallPromise(f) {
    return f.then(function() { done = true; }, function(err) { done = err; });
}

describe('plugman uninstall start', function() {
    beforeEach(function () {
        var origParseElementtreeSync = xmlHelpers.parseElementtreeSync.bind(xmlHelpers);
        spyOn(xmlHelpers, 'parseElementtreeSync').andCallFake(function(path) {
            if (/config.xml$/.test(path)) return new et.ElementTree(et.XML(TEST_XML));
            return origParseElementtreeSync(path);
        });
    });

    it('plugman uninstall start', function() {
        shell.rm('-rf', project, project2, project3);
        shell.cp('-R', path.join(srcProject, '*'), project);
        shell.cp('-R', path.join(srcProject, '*'), project2);
        shell.cp('-R', path.join(srcProject, '*'), project3);

        done = false;
        promise = Q()
        .then(function(){
            return install('android', project, plugins['org.test.plugins.dummyplugin']);
        }).then(function(){
            return install('android', project, plugins['A']);
        }).then( function(){
            return install('android', project2, plugins['C']);
        }).then(function(){
            return install('android', project2, plugins['A']);
        }).then(function(){
            return install('android', project3, plugins['A']);
        }).then(function(){
            return install('android', project3, plugins['C']);
        }).then(function(){
            done = true;
        }, function(err) {
            done = err.stack;
        });
        waitsFor(function() { return done; }, 'promise never resolved', 2000);
        runs(function() {
            expect(done).toBe(true);
        });
    });
});

describe('uninstallPlatform', function() {
    var proc, rm;
    var fsWrite;

    beforeEach(function() {
        proc = spyOn(actions.prototype, 'process').andReturn(Q());
        fsWrite = spyOn(fs, 'writeFileSync').andReturn(true);
        rm = spyOn(shell, 'rm').andReturn(true);
        spyOn(shell, 'cp').andReturn(true);
        done = false;
    });
    describe('success', function() {

        it('should get PlatformApi instance for platform and invoke its\' removePlugin method', function(done) {
            var platformApi = { removePlugin: jasmine.createSpy('removePlugin').andReturn(Q()) };
            var getPlatformApi = spyOn(platforms, 'getPlatformApi').andReturn(platformApi);

            uninstall.uninstallPlatform('android', project, dummy_id)
            .then(function() {
                expect(getPlatformApi).toHaveBeenCalledWith('android', project);
                expect(platformApi.removePlugin).toHaveBeenCalled();
            }, function(err) {
                expect(err).toBeUndefined();
            }).fin(done);
        });

        it('should return propagate value returned by PlatformApi removePlugin method', function(done) {
            var platformApi = { removePlugin: jasmine.createSpy('removePlugin') };
            spyOn(platforms, 'getPlatformApi').andReturn(platformApi);

            var existsSyncOrig = fs.existsSync;
            spyOn(fs, 'existsSync').andCallFake(function (file) {
                if (file.indexOf(dummy_id) >= 0) return true;
                return existsSyncOrig.call(fs, file);
            });

            var fakeProvider = jasmine.createSpyObj('fakeProvider', ['get']);
            fakeProvider.get.andReturn(dummyPluginInfo);

            function validateReturnedResultFor(values, expectedResult) {
                return values.reduce(function (promise, value) {
                    return promise.then(function () {
                        platformApi.removePlugin.andReturn(Q(value));
                        return uninstall.uninstallPlatform('android', project, dummy_id, null,
                            { pluginInfoProvider: fakeProvider, platformVersion: '9.9.9' });
                    })
                    .then(function(result) {
                        expect(!!result).toEqual(expectedResult);
                    }, function(err) {
                        expect(err).toBeUndefined();
                    });
                }, Q());
            }

            validateReturnedResultFor([ true, {}, [], 'foo', function(){} ], true)
            .then(function () {
                return validateReturnedResultFor([ false, null, undefined, '' ], false);
            })
            .fin(done);
        });

        describe('with dependencies', function() {
            var emit;
            beforeEach(function() {
                emit = spyOn(events, 'emit');
            });
            it('should uninstall "dangling" dependencies', function() {
                runs(function() {
                    uninstallPromise(uninstall.uninstallPlatform('android', project, 'A'));
                });
                waitsFor(function() { return done; }, 'promise never resolved', 200);
                runs(function() {
                    expect(emit).toHaveBeenCalledWith('log', 'Uninstalling 2 dependent plugins.');
                });
            });
        });
    });

    describe('failure', function() {
        it('should throw if platform is unrecognized', function() {
            runs(function() {
                uninstallPromise( uninstall.uninstallPlatform('atari', project, 'SomePlugin') );
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('atari not supported.');
            });
        });
        it('should throw if plugin is missing', function() {
            runs(function() {
                uninstallPromise( uninstall.uninstallPlatform('android', project, 'SomePluginThatDoesntExist') );
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('Plugin "SomePluginThatDoesntExist" not found. Already uninstalled?');
            });
        });
    });
});

describe('uninstallPlugin', function() {
    var rm, fsWrite, rmstack = [], emit;

    beforeEach(function() {
        fsWrite = spyOn(fs, 'writeFileSync').andReturn(true);
        rm = spyOn(shell, 'rm').andCallFake(function(f,p) { rmstack.push(p); return true; });
        rmstack = [];
        emit = spyOn(events, 'emit');
        done = false;
    });
    describe('with dependencies', function() {

        it('should delete all dependent plugins', function() {
            runs(function() {
                uninstallPromise( uninstall.uninstallPlugin('A', plugins_install_dir) );
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                var del = common.spy.getDeleted(emit);

                expect(del).toEqual([
                    'Deleted "C"',
                    'Deleted "D"',
                    'Deleted "A"'
                ]);
            });
        });

        it('should fail if plugin is a required dependency', function() {
            runs(function() {
                uninstallPromise( uninstall.uninstallPlugin('C', plugins_install_dir) );
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                expect(done.message).toBe('"C" is required by (A) and cannot be removed (hint: use -f or --force)');
            });
        });

        it('allow forcefully removing a plugin', function() {
            runs(function() {
                uninstallPromise( uninstall.uninstallPlugin('C', plugins_install_dir, {force: true}) );
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                expect(done).toBe(true);
                var del = common.spy.getDeleted(emit);
                expect(del).toEqual(['Deleted "C"']);
            });
        });

        it('never remove top level plugins if they are a dependency', function() {
            runs(function() {
                uninstallPromise( uninstall.uninstallPlugin('A', plugins_install_dir2) );
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                var del = common.spy.getDeleted(emit);

                expect(del).toEqual([
                    'Deleted "D"',
                    'Deleted "A"'
                ]);
            });
        });

        it('should not remove dependent plugin if it was installed after as top-level', function() {
            runs(function() {
                uninstallPromise( uninstall.uninstallPlugin('A', plugins_install_dir3) );
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                var del = common.spy.getDeleted(emit);

                expect(del).toEqual([
                    'Deleted "D"',
                    'Deleted "A"'
                ]);
            });
        });
    });
});

describe('uninstall', function() {
    var fsWrite, rm;

    beforeEach(function() {
        fsWrite = spyOn(fs, 'writeFileSync').andReturn(true);
        rm = spyOn(shell, 'rm').andReturn(true);
        done = false;
    });

    describe('failure', function() {
        it('should throw if platform is unrecognized', function() {
            runs(function() {
                uninstallPromise(uninstall('atari', project, 'SomePlugin'));
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('atari not supported.');
            });
        });
        it('should throw if plugin is missing', function() {
            runs(function() {
                uninstallPromise(uninstall('android', project, 'SomePluginThatDoesntExist'));
            });
            waitsFor(function() { return done; }, 'promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('Plugin "SomePluginThatDoesntExist" not found. Already uninstalled?');
            });
        });
    });
});

describe('end', function() {
    it('end', function() {
        done = false;

        promise.then(function(){
            return uninstall('android', project, plugins['org.test.plugins.dummyplugin']);
        }).then(function(){
            // Fails... A depends on
            return uninstall('android', project, plugins['C']);
        }).fail(function(err) {
            expect(err.stack).toMatch(/The plugin 'C' is required by \(A\), skipping uninstallation./);
        }).then(function(){
            // dependencies on C,D ... should this only work with --recursive? prompt user..?
            return uninstall('android', project, plugins['A']);
        }).fin(function(err){
            if(err)
                plugman.emit('error', err);

            shell.rm('-rf', project, project2, project3);
            done = true;
        });

        waitsFor(function() { return done; }, 'promise never resolved', 500);
    });
});
