// /**
//     Licensed to the Apache Software Foundation (ASF) under one
//     or more contributor license agreements.  See the NOTICE file
//     distributed with this work for additional information
//     regarding copyright ownership.  The ASF licenses this file
//     to you under the Apache License, Version 2.0 (the
//     "License"); you may not use this file except in compliance
//     with the License.  You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

//     Unless required by applicable law or agreed to in writing,
//     software distributed under the License is distributed on an
//     "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
//     KIND, either express or implied.  See the License for the
//     specific language governing permissions and limitations
//     under the License.
// */

/* jshint sub:true */

var install = require('../src/plugman/install'),
    actions = require('../src/plugman/util/action-stack'),
    PlatformJson = require('../src/plugman/util/PlatformJson'),
    events  = require('../src/events'),
    plugman = require('../src/plugman/plugman'),
    platforms = require('../src/plugman/platforms/common'),
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
    temp_dir = path.join(os.tmpdir(), 'plugman-test'),
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
        'A' : path.join(plugins_dir, 'dependencies', 'A'),
        'B' : path.join(plugins_dir, 'dependencies', 'B'),
        'C' : path.join(plugins_dir, 'dependencies', 'C'),
        'F' : path.join(plugins_dir, 'dependencies', 'F'),
        'G' : path.join(plugins_dir, 'dependencies', 'G')
    },
    promise,
    results = {},
    dummy_id = 'org.test.plugins.dummyplugin',
    superspawn = require('../src/cordova/superspawn');


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

describe('start', function() {
    var prepare, prepareBrowserify, config_queue_add, proc, actions_push, ca, emit;

    beforeEach(function() {
        prepare = spyOn(plugman, 'prepare');
        prepareBrowserify = spyOn(plugman, 'prepareBrowserify');
        config_queue_add = spyOn(PlatformJson.prototype, 'addInstalledPluginToPrepareQueue');
        proc = spyOn(actions.prototype, 'process').andReturn( Q(true) );
        actions_push = spyOn(actions.prototype, 'push');
        ca = spyOn(actions.prototype, 'createAction');
    });
    it('start', function() {
        shell.rm('-rf', project);
        shell.cp('-R', path.join(srcProject, '*'), project);

        done = false;
        promise = Q()
         .then(
            function(){ return install('android', project, plugins['org.test.plugins.dummyplugin'], plugins_install_dir, { browserify: true }); }
        ).then(
            function(){
                results['actions_callCount'] = actions_push.callCount;
                results['actions_create'] = ca.argsForCall[0];
                results['config_add'] = config_queue_add.argsForCall[0];

                return Q();
            }
        ).then(
            function(){
                return install('android', project, plugins['com.cordova.engine'], plugins_install_dir, { browserify: true }); }
        ).then(
            function(){
                emit = spyOn(events, 'emit');
                return install('android', project, plugins['org.test.plugins.childbrowser'], plugins_install_dir, { browserify: true });
            }
        ).then(
            function(){
                return install('android', project, plugins['com.adobe.vars'], plugins_install_dir, { browserify: true, cli_variables:{API_KEY:'batman'} });
            }
        ).then(
            function(){
                done = true;
                results['prepareCount'] = prepareBrowserify.callCount;
                results['emit_results'] = [];

                for(var i in emit.calls) {
                    if(emit.calls[i].args[0] === 'results')
                        results['emit_results'].push(emit.calls[i].args[1]);
                }

                events.emit('verbose', '***** DONE START *****');
            }
        ).fail(
            function(error) {
                expect(error).toEqual({});
            }
        );
        waitsFor(function() { return done; }, 'promise never resolved', 2000);
    });
});

describe('install', function() {
    var chmod, exec, add_to_queue, prepare, cp, rm, fetchSpy;
    var spawnSpy;

    beforeEach(function() {
        prepare = spyOn(plugman, 'prepare').andReturn( Q(true) );
        spyOn(plugman, 'prepareBrowserify');
        exec = spyOn(child_process, 'exec').andCallFake(function(cmd, cb) {
            cb(false, '', '');
        });
        spawnSpy = spyOn(superspawn, 'spawn').andReturn(Q('3.1.0'));
        spyOn(fs, 'mkdirSync').andReturn(true);
        spyOn(shell, 'mkdir').andReturn(true);
        spyOn(platforms, 'copyFile').andReturn(true);

        fetchSpy = spyOn(plugman.raw, 'fetch').andReturn( Q( plugins['com.cordova.engine'] ) );
        chmod = spyOn(fs, 'chmodSync').andReturn(true);
        spyOn(fs, 'writeFileSync').andReturn(true);
        cp = spyOn(shell, 'cp').andReturn(true);
        rm = spyOn(shell, 'rm').andReturn(true);
        add_to_queue = spyOn(PlatformJson.prototype, 'addInstalledPluginToPrepareQueue');
        done = false;
    });

    describe('success', function() {
        it('should call prepare after a successful install', function() {
           expect(results['prepareCount']).toBe(4);
        });

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
            fetchSpy.andReturn( Q( plugins['org.test.plugins.dummyplugin'] ) );
            spyOn(fs, 'existsSync').andCallFake( fake['existsSync']['noPlugins'] );

            runs(function() {
                installPromise(install('android', project, 'CLEANYOURSHORTS', plugins_dir, { browserify: true } ));
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(done).toBe(true);
                expect(fetchSpy).toHaveBeenCalled();
            });
        });

        it('should call the config-changes module\'s add_installed_plugin_to_prepare_queue method after processing an install', function() {
           expect(results['config_add']).toEqual([dummy_id, {}, true]);
        });
        it('should queue up actions as appropriate for that plugin and call process on the action stack',
           function() {
                expect(results['actions_callCount']).toEqual(6);
                expect(results['actions_create']).toEqual([jasmine.any(Function), [jasmine.any(Object), path.join(plugins_install_dir, dummy_id), dummy_id, jasmine.any(Object)], jasmine.any(Function), [jasmine.any(Object), dummy_id, jasmine.any(Object)]]);
        });

        it('should check version if plugin has engine tag', function(){
            var satisfies = spyOn(semver, 'satisfies').andReturn(true);
            exec.andCallFake(function(cmd, cb) {
                cb(null, '2.5.0\n');
            });

            runs(function() {
                installPromise( install('android', project, plugins['com.cordova.engine'], plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(satisfies).toHaveBeenCalledWith('2.5.0','>=2.3.0');
            });
        });
        it('should check version and munge it a little if it has "rc" in it so it plays nice with semver (introduce a dash in it)', function() {
            var satisfies = spyOn(semver, 'satisfies').andReturn(true);
            exec.andCallFake(function(cmd, cb) {
                cb(null, '3.0.0rc1\n');
            });

            runs(function() {
                installPromise( install('android', project, plugins['com.cordova.engine'], plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(satisfies).toHaveBeenCalledWith('3.0.0-rc1','>=2.3.0');
            });
        });
        it('should check specific platform version over cordova version if specified', function() {
            var spy = spyOn(semver, 'satisfies').andReturn(true);
            exec.andCallFake(function(cmd, cb) {
                cb(null, '3.1.0\n');
            });
            fetchSpy.andReturn( Q( plugins['com.cordova.engine-android'] ) );

            runs(function() {
                installPromise( install('android', project, plugins['com.cordova.engine-android'], plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(spy).toHaveBeenCalledWith('3.1.0','>=3.1.0');
            });
        });
        it('should check platform sdk version if specified', function() {
            var spy = spyOn(semver, 'satisfies').andReturn(true);
            fetchSpy.andReturn( Q( plugins['com.cordova.engine-android'] ) );
            exec.andCallFake(function(cmd, cb) {
                cb(null, '18\n');
            });

            runs(function() {
                installPromise( install('android', project, 'com.cordova.engine-android', plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                // <engine name="cordova" VERSION=">=3.0.0"/>
                // <engine name="cordova-android" VERSION=">=3.1.0"/>
                // <engine name="android-sdk" VERSION=">=18"/>

                expect(spy.calls.length).toBe(3);
                expect(spy.calls[0].args).toEqual([ '18.0.0', '>=3.0.0' ]);
                expect(spy.calls[1].args).toEqual([ '18.0.0', '>=3.1.0' ]);
                expect(spy.calls[2].args).toEqual([ '18.0.0','>=18' ]);
            });
        });
        it('should check engine versions', function() {
            var spy = spyOn(semver, 'satisfies').andReturn(true);
            fetchSpy.andReturn( Q( plugins['com.cordova.engine'] ) );

            runs(function() {
                installPromise( install('android', project, plugins['com.cordova.engine'], plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                // <engine name="cordova" version=">=2.3.0"/>
                // <engine name="cordova-plugman" version=">=0.10.0" />
                // <engine name="mega-fun-plugin" version=">=1.0.0" scriptSrc="megaFunVersion" platform="*" />
                // <engine name="mega-boring-plugin" version=">=3.0.0" scriptSrc="megaBoringVersion" platform="ios|android" />

                var plugmanVersion = require('../package.json').version;

                expect(spy.calls.length).toBe(4);
                expect(spy.calls[0].args).toEqual([ null, '>=2.3.0' ]);
                expect(spy.calls[1].args).toEqual([ plugmanVersion, '>=0.10.0' ]);
                expect(spy.calls[2].args).toEqual([ null, '>=1.0.0' ]);
                expect(spy.calls[3].args).toEqual([ null, '>=3.0.0' ]);
            });
        });
        it('should not check custom engine version that is not supported for platform', function() {
            var spy = spyOn(semver, 'satisfies').andReturn(true);
            runs(function() {
                installPromise( install('blackberry10', project, plugins['com.cordova.engine'], plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(spy).not.toHaveBeenCalledWith('','>=3.0.0');
            });
        });

        describe('with dependencies', function() {
            var emit;
            beforeEach(function() {
                spyOn(fs, 'existsSync').andCallFake( fake['existsSync']['noPlugins'] );
                fetchSpy.andCallFake( fake['fetch']['dependencies'] );
                emit = spyOn(events, 'emit');
                exec.andCallFake(function(cmd, cb) {
                    cb(null, '9.0.0\n');
                });
            });

            it('should install any dependent plugins if missing', function() {
                runs(function() {
                    installPromise( install('android', project, plugins['A'], plugins_install_dir, { browserify: true }) );
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
                    installPromise( install('android', project, plugins['A'], plugins_install_dir, { browserify: true }) );
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
                    installPromise(install('android', project, plugins['F'], plugins_install_dir, { browserify: true }));
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
                    installPromise( install('android', project, plugins['G'], plugins_install_dir, { browserify: true }) );
                });
                waitsFor(function () { return done; }, 'install promise never resolved', 200);
                runs(function () {
                    common.spy.getInstall(emit);

                    expect(done.message).toEqual('Cyclic dependency from G to H');
                });
            });

            it('install subdir relative to top level plugin if no fetch meta', function() {
                runs(function () {
                    installPromise(install('android', project, plugins['B'], plugins_install_dir, { browserify: true }));
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
                spyOn(meta, 'get_fetch_metadata').andCallFake(function(){
                    return {
                        source: {type: 'dir', url: path.join(plugins['B'], '..', 'meta')}
                    };
                });

                runs(function () {
                    installPromise(install('android', project, plugins['B'], plugins_install_dir, { browserify: true }));
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
                installPromise( install('atari', project, 'SomePlugin', plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('atari not supported.');
            });
        });
        it('should throw if variables are missing', function() {
            runs(function() {
                installPromise( install('android', project, plugins['com.adobe.vars'], plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function(){ return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('Variable(s) missing: API_KEY');
            });
        });
         it('should not throw exception on default variables', function() {
            runs(function() {
                installPromise( install('android', project, plugins['org.test.defaultvariables'], plugins_install_dir, { browserify: true , cli_variables:{API_KEY:'del7a' }}) );
  
            });
            waitsFor(function() { return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(''+done).toEqual('true');
            });
        });
        it('should throw if git is not found on the path and a remote url is requested', function() {
            spyOn(fs, 'existsSync').andCallFake( fake['existsSync']['noPlugins'] );
            fetchSpy.andCallThrough();
            spyOn(shell, 'which').andReturn(null);
            runs(function() {
                installPromise( install('android', project, 'https://git-wip-us.apache.org/repos/asf/cordova-plugin-camera.git', plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function(){ return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('"git" command line tool is not installed: make sure it is accessible on your PATH.');
            });
        });
        it('should throw if plugin version is less than the minimum requirement', function(){
            spyOn(semver, 'satisfies').andReturn(false);
            exec.andCallFake(function(cmd, cb) {
                cb(null, '0.0.1\n');
            });
            runs(function() {
                installPromise( install('android', project, plugins['com.cordova.engine'], plugins_install_dir, { browserify: true }) );
            });
            waitsFor(function(){ return done; }, 'install promise never resolved', 200);
            runs(function() {
                expect(''+done).toContain('Plugin doesn\'t support this project\'s cordova version. cordova: 0.0.1, failed version requirement: >=2.3.0');
            });
        });
    });

});

// When run using 'npm test', the removal of temp_dir is causing
// tests in 'install.spec.js' to fail.

// describe('end', function() {

//     it('end', function() {
//         done = false;

//         promise.fin(function(err){
//             if(err)
//                 events.emit('error', err);

//             shell.rm('-rf', temp_dir);
//             done = true;
//         });

//         waitsFor(function() { return done; }, 'promise never resolved', 500);
//     });
// });
