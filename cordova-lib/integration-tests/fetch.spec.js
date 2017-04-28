var path = require('path'),
    shell = require('shelljs'),
    helpers = require('../spec-cordova/helpers'),
    cordova = require('../src/cordova/cordova');

var TIMEOUT = 90000,
    plugins_dir = path.join(__dirname, '..', 'spec-plugman', 'plugins');

var plugins = {
    'Test1' : path.join(plugins_dir, 'dependencies', 'Test1'),
    'Test2' : path.join(plugins_dir, 'dependencies', 'Test2'),
    'Test3' : path.join(plugins_dir, 'dependencies', 'Test3'),
    'Test4' : path.join(plugins_dir, 'dependencies', 'Test4')
}


describe('end-to-end plugin dependency tests', function() {
    var tmpDir, project, pluginsDir;

    beforeEach(function() {
        tmpDir = helpers.tmpDir('plugin_dependency_test');
        project = path.join(tmpDir, 'hello3');
        pluginsDir = path.join(project, 'plugins');
        process.chdir(tmpDir);
    });

    afterEach(function() {
        process.chdir(path.join(__dirname, '..'));  // Needed to rm the dir on Windows.
        shell.rm('-rf', tmpDir);
    });

    it('Test 029 : should fail if dependency already installed is wrong version', function(done) {
        cordova.raw.create('hello3')
        .then(function() {
            process.chdir(project);
            return cordova.raw.platform('add', 'android', {'fetch': true});
        }).then(function() {
            return cordova.raw.plugin('add', 'cordova-plugin-file', {'fetch': true});
        }).then(function() {
            expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
            return cordova.raw.plugin('add', plugins['Test1'], {'fetch': true});
        }).fail(function(err) {
            expect(err.message).toContain('does not satisfy dependency plugin requirement');
        })
        .fin(done);
    }, TIMEOUT);

    it('Test 030 : should pass if dependency already installed is wrong version with --force', function(done) {
        cordova.raw.create('hello3')
        .then(function() {
            process.chdir(project);
            return cordova.raw.platform('add', 'android', {'fetch': true});
        })
        .then(function() {
            return cordova.raw.plugin('add', 'cordova-plugin-file', {'fetch': true});
        })
        .then(function() {
            expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
            return cordova.raw.plugin('add', plugins['Test1'], {'fetch': true, 'force':true});
        })
        .then(function() {
            expect(path.join(pluginsDir, 'Test1')).toExist();
        })
        .fail(function(err) {
            expect(err).toBeUndefined();
        })
        .fin(done);
    }, TIMEOUT);


    it('Test 031 : should pass if dependency already installed is same major version (if specific version is specified)', function(done) {
        //Test1 requires cordova-plugin-file version 2.0.0 (which should automatically turn into ^2.0.0); we'll install version 2.1.0
        cordova.raw.create('hello3')
        .then(function() {
            process.chdir(project);
            return cordova.raw.platform('add', 'android', {'fetch': true});
        })
        .then(function() {
            return cordova.raw.plugin('add', 'cordova-plugin-file@2.1.0', {'fetch': true});
        })
        .then(function() {
            expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
            return cordova.raw.plugin('add', plugins['Test1'], {'fetch': true});
        })
        .then(function() {
            expect(path.join(pluginsDir, 'Test1')).toExist();
        })
        .fail(function(err) {
            //console.error(err);
            expect(err).toBeUndefined();
        })
        .fin(done);
    }, TIMEOUT);

    it('Test 032 : should handle two plugins with same dependent plugin', function(done) {
        //Test1 and Test2 have compatible dependencies on cordova-plugin-file
        //Test1 and Test3 have incompatible dependencies on cordova-plugin-file
        cordova.raw.create('hello3')
        .then(function() {
            process.chdir(project);
            return cordova.raw.platform('add', 'android', {'fetch': true});
        })
        .then(function() {
            return cordova.raw.plugin('add', plugins['Test1'], {'fetch': true});
        })
        .then(function() {
            expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
            expect(path.join(pluginsDir, 'Test1')).toExist();
            return cordova.raw.plugin('add', plugins['Test2'], {'fetch': true});
        })
        .then(function() {
            return cordova.raw.plugin('add', plugins['Test3'], {'fetch': true});
        })
        .fail(function(err) {
            expect(path.join(pluginsDir, 'Test2')).toExist();
            expect(path.join(pluginsDir, 'Test3')).not.toExist();
            expect(err.message).toContain('does not satisfy dependency plugin requirement');
        }, TIMEOUT)
        .fin(done);
    }, TIMEOUT);

    it('Test 033 : should use a dev version of a dependent plugin if it is already installed', function(done) {
        //Test4 has this dependency in its plugin.xml:
        //<dependency id="cordova-plugin-file" url="https://github.com/apache/cordova-plugin-file" />
        cordova.raw.create('hello3')
        .then(function() {
            process.chdir(project);
            return cordova.raw.platform('add', 'android', {'fetch': true});
        })
        .then(function() {
            return cordova.raw.plugin('add', 'https://github.com/apache/cordova-plugin-file');
        })
        .then(function() {
            return cordova.raw.plugin('add', plugins['Test4'], {'fetch': true});
        })
        .then(function() {
            expect(path.join(pluginsDir, 'cordova-plugin-file')).toExist();
            expect(path.join(pluginsDir, 'Test4')).toExist();
        }, function (error) {
            fail(error);
        })
        .fin(done);
    }, TIMEOUT);
});
