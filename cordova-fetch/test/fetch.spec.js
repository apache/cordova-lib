var fetch = require('../index.js');
var t = require('tap');
var shell = require('shelljs');
var path = require('path');
var fs = require('fs');

var tempDir = path.join('.', 'test', 'temp');
var opt = {};
opt.timeout = '0';

//Delete old tempDir 
shell.rm('-rf', tempDir);

//Create tempDir
shell.mkdir('-p', tempDir);

//Copy sample package.json to temp for --save test
shell.cp('test/package.json', 'test/temp/');

t.test('npm install packageID', opt, function (t) {
    return fetch('cordova-plugin-device', tempDir).then(function (result) {
        return t.test('check result', opt, function (t) {
            t.plan(1);
            t.equal(fs.existsSync(result), true);
            t.end();
        });
    });
});

t.test('npm install packageID where module is already installed, should use trimID method', opt, function (t) {
    return fetch('cordova-plugin-device', tempDir).then(function (result) {
        return t.test('check result', opt, function (t) {
            t.plan(1);
            t.equal(fs.existsSync(result), true);
            t.end();
        });
    });
});

t.test('npm install plugin via git url', opt, function (t) {
    return fetch('https://github.com/apache/cordova-plugin-camera.git', tempDir).then(function (result) {
        return t.test('check result', opt, function (t) {
            t.plan(1);
            t.equal(fs.existsSync(result), true);
            t.end();
        });
    });
});

t.test('npm install plugin via git url with tag', opt,  function (t) { 
    return fetch('https://github.com/apache/cordova-plugin-device-motion.git#1.0.0', tempDir).then(function (result) {
        return t.test('check result', opt, function (t) {
            t.plan(2);
            var pkgJSON = require('./temp/node_modules/cordova-plugin-device-motion/package.json');
            t.equal(pkgJSON.version, '1.0.0');
            t.equal(fs.existsSync(result), true);
            t.end();
        });
    });
});

t.test('npm install plugin already npm installed from git, should use trimID method', opt, function (t) {
    return fetch('https://github.com/apache/cordova-plugin-device-motion.git#1.0.0', tempDir).then(function (result) {
        return t.test('check result', opt, function (t) {
            t.plan(1);
            t.equal(fs.existsSync(result), true);
            t.end();
        });
    });
});

t.test('npm install platform via git url with branchName', opt, function (t) {
    return fetch('https://github.com/apache/cordova-android.git#4.1.x', tempDir).then(function (result) {
        return t.test('check result', opt, function (t) {
            t.plan(2);
            var pkgJSON = require('./temp/node_modules/cordova-android/package.json');
            t.equal(pkgJSON.version, '4.1.1');
            t.equal(fs.existsSync(result), true);
            t.end();
        });
    });
});

t.test('npm install plugin via git url with commit sha', opt, function (t) {
    return fetch('https://github.com/apache/cordova-plugin-contacts.git#7db612115755c2be73a98dda76ff4c5fd9d8a575', tempDir).then(function (result) {
        return t.test('check result', opt, function (t) {
            t.plan(2);
            var pkgJSON = require('./temp/node_modules/cordova-plugin-contacts/package.json');
            t.equal(pkgJSON.version, '2.0.2-dev');
            t.equal(fs.existsSync(result), true);
            t.end();
        });
    });
});

t.test('npm install packageID@VERSION with --save', opt, function (t) {
    return fetch('cordova-plugin-file@4.1.0', tempDir, {'save':true}).then(function (result) {
        return t.test('check result', opt, function (t) {
            t.plan(2);
            var pkgJSON = require('./temp/package.json');
            t.equal(pkgJSON.dependencies['cordova-plugin-file'], '^4.1.0');
            t.equal(fs.existsSync(result), true);
            t.end();
        });
    });
});

t.test('npm install packageID failed', opt, function (t) {
    return fetch('NOTAMODULE', tempDir).then(function (result) {
        //should skip this and go to fail callback
        console.log('success should be skipped');
    }, function (error) {
        return t.test('failure', opt, function(t) {
            t.plan(1);
            t.equal(error.message.code, 1);
            t.end();
        });
    });
});

t.test('npm install via git url should fail due to lack of subdirectory support', opt, function (t) {
    return fetch('https://github.com/apache/cordova-plugins.git#:keyboard', tempDir).then(function (result) {
        //should skip this and go to fail callback
        console.log('success should be skipped');
    }, function (error) {
        return t.test('failure', opt, function(t) {
            t.plan(1);
            t.equal(error.message.code, 1);
            t.end();
        });
    });
});
