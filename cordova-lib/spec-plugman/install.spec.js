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

var install = require('../src/plugman/install'),
    actions = require('cordova-common').ActionStack,
    xmlHelpers = require('cordova-common').xmlHelpers,
    et      = require('elementtree'),
    PlatformJson = require('cordova-common').PlatformJson,
    events = require('cordova-common').events,
    plugman = require('../src/plugman/plugman'),
    platforms = require('../src/plugman/platforms/common'),
    knownPlatforms  = require('../src/platforms/platforms'),
    common  = require('./common'),
    fs      = require('fs'),
    os      = require('os'),
    path    = require('path'),
    shell   = require('shelljs'),
    child_process = require('child_process'),
    semver  = require('semver'),
    Q = require('q'),
    spec    = __dirname,
    done    = false,
    srcProject = path.join(spec, 'projects', 'android_install'),
    temp_dir = path.join(fs.realpathSync(os.tmpdir()), 'plugman-test'),
    project = path.join(temp_dir, 'android_install'),
    plugins_dir = path.join(spec, 'plugins'),
    plugins_install_dir = path.join(project, 'cordova', 'plugins'),
    plugins = {
        'org.test.plugins.dummyplugin' : path.join(plugins_dir, 'org.test.plugins.dummyplugin'),
        'com.cordova.engine' : path.join(plugins_dir, 'com.cordova.engine'),
        'com.cordova.engine-android' : path.join(plugins_dir, 'com.cordova.engine-android'),
        'org.test.plugins.childbrowser' : path.join(plugins_dir, 'org.test.plugins.childbrowser'),
        'com.adobe.vars' : path.join(plugins_dir, 'com.adobe.vars'),
        'org.test.defaultvariables' : path.join(plugins_dir, 'org.test.defaultvariables'),
        'org.test.invalid.engine.script' : path.join(plugins_dir, 'org.test.invalid.engine.script'),
        'org.test.invalid.engine.no.platform' : path.join(plugins_dir, 'org.test.invalid.engine.no.platform'),
        'org.test.invalid.engine.no.scriptSrc' : path.join(plugins_dir, 'org.test.invalid.engine.no.scriptSrc'),
        'A' : path.join(plugins_dir, 'dependencies', 'A'),
        'B' : path.join(plugins_dir, 'dependencies', 'B'),
        'C' : path.join(plugins_dir, 'dependencies', 'C'),
        'F' : path.join(plugins_dir, 'dependencies', 'F'),
        'G' : path.join(plugins_dir, 'dependencies', 'G')
    },
    promise,
    results = {},
    superspawn = require('cordova-common').superspawn;


// Pre-crete the temp dir, without it the test fails.
shell.mkdir('-p', temp_dir);

function installPromise(f) {
  f.then(function(res) { done = true; }, function(err) { done = err; });
}

var existsSync = fs.existsSync;

// Mocked functions for tests
var fake = {
    'existsSync' : {
        'noPlugins' : function(path){
            // fake installed plugin directories as 'not found'
            if( path.slice(-5) !== '.json' && path.indexOf(plugins_install_dir) >= 0) {
                return false;
            }

            return existsSync(path);
        }
    },
    'fetch' : {
        'dependencies' : function(id, dir) {
            if(id == plugins['A'])
                return Q(id); // full path to plugin

            return Q( path.join(plugins_dir, 'dependencies', id) );
        }
    }
};

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
    '    <preference name="fullscreen" value="true" />\n' +
    '    <preference name="webviewbounce" value="true" />\n' +
    '</widget>\n';

describe('plugman install start', function() {
    var config_queue_add, proc, actions_push, ca, emit;

    beforeEach(function() {
        config_queue_add = spyOn(PlatformJson.prototype, 'addInstalledPluginToPrepareQueue');
        proc = spyOn(actions.prototype, 'process').and.returnValue( Q(true) );
        actions_push = spyOn(actions.prototype, 'push');
        ca = spyOn(actions.prototype, 'createAction');

        var origParseElementtreeSync = xmlHelpers.parseElementtreeSync.bind(xmlHelpers);
        spyOn(xmlHelpers, 'parseElementtreeSync').and.callFake(function(path) {
            if (/config.xml$/.test(path)) return new et.ElementTree(et.XML(TEST_XML));
            return origParseElementtreeSync(path);
        });
    });

    it('plugman install start', function() {
        shell.rm('-rf', project);
        shell.cp('-R', path.join(srcProject, '*'), project);

        // Every time when addPlugin is called it will return some truthy value
        var returnValueIndex = 0;
        var returnValues = [true, {}, [], 'foo', function(){}];
        var api = knownPlatforms.getPlatformApi('android', project);
        var addPluginOrig = api.addPlugin;
        spyOn(api, 'addPlugin').and.callFake(function () {
            return addPluginOrig.apply(api, arguments)
            .thenResolve(returnValues[returnValueIndex++]);
        });

        done = false;
        promise = Q()
         .then(
            function(){
                return install('android', project, plugins['org.test.plugins.dummyplugin']);
            }
        ).then(
            function(result){
                expect(result).toBeTruthy();
                results['actions_callCount'] = actions_push.callCount;
                results['actions_create'] = ca.argsForCall[0];
                results['config_add'] = config_queue_add.argsForCall[0];

                return Q();
            }
        ).then(
            function(){
                return install('android', project, plugins['com.cordova.engine']);
            }
        ).then(
            function(result){
                expect(result).toBeTruthy();
                emit = spyOn(events, 'emit');
                return install('android', project, plugins['org.test.plugins.childbrowser']);
            }
        ).then(
            function(result){
                expect(result).toBeTruthy();
                return install('android', project, plugins['com.adobe.vars'], plugins_install_dir, { cli_variables:{API_KEY:'batman'} });
            }
        ).then(
            function(result){
                expect(result).toBeTruthy();
                return install('android', project, plugins['org.test.defaultvariables'], plugins_install_dir, { cli_variables:{API_KEY:'batman'} });
            }
        ).then(
            function(result){
                expect(result).toBeTruthy();
                done = true;
                results['emit_results'] = [];

                for(var i in emit.calls) {
                    if(emit.calls[i].args[0] === 'results')
                        results['emit_results'].push(emit.calls[i].args[1]);
                }

                events.emit('verbose', '***** DONE START *****');
            }
        ).fail(
            function(error) {
                expect(error).toBeUndefined();
            }
        );
        waitsFor(function() { return done; }, 'promise never resolved', 2000);
    });
});

describe('install', function() {
    var chmod, exec, add_to_queue, cp, rm, fetchSpy;
    var spawnSpy;

    beforeEach(function() {

        exec = spyOn(child_process, 'exec').and.callFake(function(cmd, cb) {
            cb(false, '', '');
        });
        spawnSpy = spyOn(superspawn, 'spawn').and.returnValue(Q('3.1.0'));
        spyOn(fs, 'mkdirSync').and.returnValue(true);
        spyOn(shell, 'mkdir').and.returnValue(true);
        spyOn(platforms, 'copyFile').and.returnValue(true);

        fetchSpy = spyOn(plugman.raw, 'fetch').and.returnValue( Q( plugins['com.cordova.engine'] ) );
        chmod = spyOn(fs, 'chmodSync').and.returnValue(true);
        spyOn(fs, 'writeFileSync').and.returnValue(true);
        cp = spyOn(shell, 'cp').and.returnValue(true);
        rm = spyOn(shell, 'rm').and.returnValue(true);
        add_to_queue = spyOn(PlatformJson.prototype, 'addInstalledPluginToPrepareQueue');
        done = false;
    });

    describe('success', function() {
        it('should emit a results event with platform-agnostic <info>', function() {
            // org.test.plugins.childbrowser
            expect(results['emit_results'][0]).toBe('No matter what platform you are installing to, this notice is very important.');
        });
        it('should emit a results event with platform-specific <info>', function() {
            // org.test.plugins.childbrowser
            expect(results['emit_results'][1]).toBe('Please make sure you read this because it is very important to complete the installation of your plugin.');
        });
        it('should interpolate variables into <info> tags', function() {
            // VariableBrowser
            expect(results['emit_results'][2]).toBe('Remember that your api key is batman!');
        });
        it('should call fetch if provided plugin cannot be resolved locally', function() {
            fetchSpy.and.returnValue( Q( plugins['org.test.plugins.dummyplugin'] ) );
            spyOn(fs, 'existsSync').and.callFake( fake['existsSync']['noPlugins'] );

            runs(function() {
                installPromise(install('android', project, 'CLEANYOURSHORTS' ));
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(done).toBe(true);
                expect(fetchSpy).toHaveBeenCalled();
            });
        });
        it('should call fetch and convert oldID to newID', function() {
            fetchSpy.and.returnValue( Q( plugins['org.test.plugins.dummyplugin'] ) );
            spyOn(fs, 'existsSync').and.callFake( fake['existsSync']['noPlugins'] );
            var emit = spyOn(events, 'emit');
            runs(function() {
                installPromise(install('android', project, 'org.apache.cordova.device' ));
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(emit.calls[0].args[1]).toBe('Notice: org.apache.cordova.device has been automatically converted to cordova-plugin-device and fetched from npm. This is due to our old plugins registry shutting down.');
                expect(done).toBe(true);
                expect(fetchSpy).toHaveBeenCalled();
            });
        });

        describe('engine versions', function () {
            var fail, satisfies;
            beforeEach(function () {
                fail = jasmine.createSpy('fail');
                satisfies = spyOn(semver, 'satisfies').and.returnValue(true);
                spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            });

            it('should check version if plugin has engine tag', function(done){
                exec.and.callFake(function(cmd, cb) { cb(null, '2.5.0\n'); });
                install('android', project, plugins['com.cordova.engine'])
                .fail(fail)
                .fin(function () {
                    expect(satisfies).toHaveBeenCalledWith('2.5.0','>=1.0.0', true);
                    done();
                });
            });
            it('should check version and munge it a little if it has "rc" in it so it plays nice with semver (introduce a dash in it)', function(done) {
                exec.and.callFake(function(cmd, cb) { cb(null, '3.0.0rc1\n'); });
                install('android', project, plugins['com.cordova.engine'])
                .fail(fail)
                .fin(function () {
                    expect(satisfies).toHaveBeenCalledWith('3.0.0-rc1','>=1.0.0', true);
                    done();
                });
            });
            it('should check specific platform version over cordova version if specified', function(done) {
                exec.and.callFake(function(cmd, cb) { cb(null, '3.1.0\n'); });
                install('android', project, plugins['com.cordova.engine-android'])
                .fail(fail)
                .fin(function() {
                    expect(satisfies).toHaveBeenCalledWith('3.1.0','>=3.1.0', true);
                    done();
                });
            });
            it('should check platform sdk version if specified', function(done) {
                var cordovaVersion = require('../package.json').version.replace(/-dev|-nightly.*$/, '');
                exec.and.callFake(function(cmd, cb) { cb(null, '18\n'); });
                install('android', project, plugins['com.cordova.engine-android'])
                .fail(fail)
                .fin(function() {
                    expect(satisfies.calls.length).toBe(3);
                    // <engine name="cordova" VERSION=">=3.0.0"/>
                    expect(satisfies.calls[0].args).toEqual([ cordovaVersion, '>=3.0.0', true ]);
                    // <engine name="cordova-android" VERSION=">=3.1.0"/>
                    expect(satisfies.calls[1].args).toEqual([ '18.0.0', '>=3.1.0', true ]);
                    // <engine name="android-sdk" VERSION=">=18"/>
                    expect(satisfies.calls[2].args).toEqual([ '18.0.0','>=18', true ]);
                    done();
                });
            });
            it('should check engine versions', function(done) {
                install('android', project, plugins['com.cordova.engine'])
                .fail(fail)
                .fin(function() {
                    var plugmanVersion = require('../package.json').version.replace(/-dev|-nightly.*$/, '');
                    var cordovaVersion = require('../package.json').version.replace(/-dev|-nightly.*$/, '');
                    expect(satisfies.calls.length).toBe(4);
                    // <engine name="cordova" version=">=2.3.0"/>
                    expect(satisfies.calls[0].args).toEqual([ cordovaVersion, '>=2.3.0', true ]);
                    // <engine name="cordova-plugman" version=">=0.10.0" />
                    expect(satisfies.calls[1].args).toEqual([ plugmanVersion, '>=0.10.0', true ]);
                    // <engine name="mega-fun-plugin" version=">=1.0.0" scriptSrc="megaFunVersion" platform="*" />
                    expect(satisfies.calls[2].args).toEqual([ null, '>=1.0.0', true ]);
                    // <engine name="mega-boring-plugin" version=">=3.0.0" scriptSrc="megaBoringVersion" platform="ios|android" />
                    expect(satisfies.calls[3].args).toEqual([ null, '>=3.0.0', true ]);
                    done();
                });
            });
            it('should not check custom engine version that is not supported for platform', function(done) {
                install('blackberry10', project, plugins['com.cordova.engine'])
                .then(fail)
                .fail(function () {
                    expect(satisfies).not.toHaveBeenCalledWith('','>=3.0.0', true);
                })
                .fin(done);
            });
        });

        it('should not check custom engine version that is not supported for platform', function() {
            var spy = spyOn(semver, 'satisfies').and.returnValue(true);
            runs(function() {
                installPromise( install('blackberry10', project, plugins['com.cordova.engine']) );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(spy).not.toHaveBeenCalledWith('','>=3.0.0');
            });
        });

        describe('with dependencies', function() {
            var emit;
            beforeEach(function() {
                spyOn(fs, 'existsSync').and.callFake( fake['existsSync']['noPlugins'] );
                fetchSpy.and.callFake( fake['fetch']['dependencies'] );
                emit = spyOn(events, 'emit');
                exec.and.callFake(function(cmd, cb) {
                    cb(null, '9.0.0\n');
                });
            });

            it('should install any dependent plugins if missing', function() {
                runs(function() {
                    installPromise( install('android', project, plugins['A']) );
                });
                waitsFor(function() { return done; }, 'install promise never resolved', 200);
                runs(function() {
                    // Look for 'Installing plugin ...' in events
                    var install = common.spy.getInstall(emit);

                    expect(install).toEqual([
                        'Install start for "C" on android.',
                        'Install start for "D" on android.',
                        'Install start for "A" on android.'
                    ]);
                });
            });

            it('should install any dependent plugins from registry when url is not defined', function() {
                // Plugin A depends on C & D
                runs(function() {
                    installPromise( install('android', project, plugins['A']) );
                });
                waitsFor(function() { return done; }, 'promise never resolved', 200);
                runs(function() {
                    // TODO: this is same test as above? Need test other dependency with url=?
                    var install = common.spy.getInstall(emit);

                    expect(install).toEqual([
                        'Install start for "C" on android.',
                        'Install start for "D" on android.',
                        'Install start for "A" on android.'
                    ]);
                });
            });

            it('should process all dependent plugins with alternate routes to the same plugin', function() {
                // Plugin F depends on A, C, D and E
                runs(function () {
                    installPromise(install('android', project, plugins['F']));
                });
                waitsFor(function () { return done; }, 'install promise never resolved', 200);
                runs(function () {
                    var install = common.spy.getInstall(emit);

                    expect(install).toEqual([
                        'Install start for "C" on android.',
                        'Install start for "D" on android.',
                        'Install start for "A" on android.',
                        'Install start for "D" on android.',
                        'Install start for "F" on android.'
                    ]);
                });
            });

            it('should throw if there is a cyclic dependency', function() {
                runs(function () {
                    installPromise( install('android', project, plugins['G']) );
                });
                waitsFor(function () { return done; }, 'install promise never resolved', 200);
                runs(function () {
                    common.spy.getInstall(emit);

                    expect(done.message).toEqual('Cyclic dependency from G to H');
                });
            });

            it('install subdir relative to top level plugin if no fetch meta', function() {
                runs(function () {
                    installPromise(install('android', project, plugins['B']));
                });
                waitsFor(function () { return done; }, 'install promise never resolved', 200);
                runs(function () {
                    var install = common.spy.getInstall(emit);

                    expect(install).toEqual([
                        'Install start for "D" on android.',
                        'Install start for "E" on android.',
                        'Install start for "B" on android.'
                    ]);
                });
            });

            it('install uses meta data (if available) of top level plugin source', function() {
                // Fake metadata so plugin 'B' appears from 'meta/B'
                var meta = require('../src/plugman/util/metadata');
                spyOn(meta, 'get_fetch_metadata').and.callFake(function(){
                    return {
                        source: {type: 'dir', url: path.join(plugins['B'], '..', 'meta')}
                    };
                });

                runs(function () {
                    installPromise(install('android', project, plugins['B']));
                });
                waitsFor(function () { return done; }, 'install promise never resolved', 200);
                runs(function () {
                    var install = common.spy.getInstall(emit);

                    expect(install).toEqual([
                        'Install start for "D" on android.',
                        'Install start for "E" on android.',
                        'Install start for "B" on android.'
                    ]);

                    var copy = common.spy.startsWith(emit, 'Copying from');
                    expect(copy.length).toBe(3);
                    expect(copy[0].indexOf(path.normalize('meta/D')) > 0).toBe(true);
                    expect(copy[1].indexOf(path.normalize('meta/subdir/E')) > 0).toBe(true);
                });
            });
        });
    });

    describe('failure', function() {
        it('should throw if platform is unrecognized', function() {
            runs(function() {
                installPromise( install('atari', project, 'SomePlugin') );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('atari not supported.');
            });
        });
        it('should throw if variables are missing', function(done) {
            var success = jasmine.createSpy('success');
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            install('android', project, plugins['com.adobe.vars'])
            .then(success)
            .fail(function (err) {
                expect(err).toContain('Variable(s) missing: API_KEY');
            })
            .fin(function () {
                expect(success).not.toHaveBeenCalled();
                done();
            });
        });
        it('should throw if git is not found on the path and a remote url is requested', function() {
            spyOn(fs, 'existsSync').and.callFake( fake['existsSync']['noPlugins'] );
            fetchSpy.and.callThrough();
            spyOn(shell, 'which').and.returnValue(null);
            runs(function() {
                installPromise( install('android', project, 'https://git-wip-us.apache.org/repos/asf/cordova-plugin-camera.git') );
            });
            waitsFor(function(){ return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('"git" command line tool is not installed: make sure it is accessible on your PATH.');
            });
        });
        it('should not fail when trying to install plugin less than minimum version. Skip instead  ', function(){
            spyOn(semver, 'satisfies').and.returnValue(false);
            exec.and.callFake(function(cmd, cb) {
                cb(null, '0.0.1\n');
            });
            runs(function() {
                installPromise( install('android', project, plugins['com.cordova.engine']) );
            });
            waitsFor(function(){ return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(''+done).toMatch(true);
            });
        });
        it('should throw if the engine scriptSrc escapes out of the plugin dir.', function(done) {
            var success = jasmine.createSpy('success'),
                fail = jasmine.createSpy('fail').and.callFake(function(err) {
                    // <engine name="path-escaping-plugin" version=">=1.0.0" scriptSrc="../../../malicious/script" platform="*" />
                    expect(err).toBeDefined();
                    expect(err.message.indexOf('Security violation:')).toBe(0);
                });

            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            install('android', project, plugins['org.test.invalid.engine.script'])
                .then(success)
                .fail(fail)
                .fin(function() {
                    expect(success).not.toHaveBeenCalled();
                    expect(fail).toHaveBeenCalled();
                    done();
                });
        });
        it('should throw if a non-default cordova engine platform attribute is not defined.', function(done) {
            var success = jasmine.createSpy('success'),
                fail = jasmine.createSpy('fail');
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            install('android', project, plugins['org.test.invalid.engine.no.platform'])
                .then(success)
                .fail(fail)
                .fin(function() {
                    expect(success).not.toHaveBeenCalled();
                    expect(fail).toHaveBeenCalled();
                    done();
                });
        });
        it('should throw if a non-default cordova engine scriptSrc attribute is not defined.', function(done) {
            var success = jasmine.createSpy('success'),
                fail = jasmine.createSpy('fail');
            spyOn(PlatformJson.prototype, 'isPluginInstalled').and.returnValue(false);
            install('android', project, plugins['org.test.invalid.engine.no.scriptSrc'])
                .then(success)
                .fail(fail)
                .fin(function() {
                    expect(success).not.toHaveBeenCalled();
                    expect(fail).toHaveBeenCalled();
                    done();
                });
        });
    });
});

describe('end', function() {

    it('end', function() {
        done = false;

        promise.fin(function(err){
            if(err)
                events.emit('error', err);

            shell.rm('-rf', temp_dir);
            done = true;
        });

        waitsFor(function() { return done; }, 'promise never resolved', 500);
    });
});
