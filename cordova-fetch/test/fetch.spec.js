var Q = require('q');
var fetch = require('../index.js');
var t = require('tap');
var shell = require('shelljs');
var path = require('path');

//Create tempdir to store modules
var tempDir = path.join('.', 'test', 'temp')
shell.mkdir('-p', tempDir);
shell.mkdir('-p', path.join(tempDir, 'node_modules'));
//Copy sample package.json to temp for --save test
shell.cp('test/package.json', 'test/temp/')

t.test('npm install packageID', function (t) {
  return fetch('cordova-plugin-device', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      t.equal(result, true)
      t.end()
    })
  })
})

t.test('npm install packageID failed', function (t) {
  return fetch('NOTAMODULE', tempDir).then(function (result) {
    //should skip this and go to fail callback
    console.log('success should be skipped')
  }, function (error) {
    return t.test('failure', function(t) {
        t.equal(error.code, 1)
        t.end()
    })
  })
})

t.test('npm install plugin via git url', function (t) {
  return fetch('https://github.com/apache/cordova-plugin-camera.git', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      t.equal(result, true)
      t.end()
    })
  })
})

t.test('npm install plugin via git url with tag', function (t) {
  return fetch('https://github.com/apache/cordova-plugin-camera.git#2.0.0', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      var pkgJSON = require('./temp/node_modules/cordova-plugin-camera/package.json');
      t.equal(pkgJSON.version, '2.0.0')
      t.equal(result, true)
      t.end()
    })
  })
})

t.test('npm install platform via git url with branchName', function (t) {
  return fetch('https://github.com/apache/cordova-android.git#4.1.x', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      var pkgJSON = require('./temp/node_modules/cordova-android/package.json');
      t.equal(pkgJSON.version, '4.1.1')
      t.equal(result, true)
      t.end()
    })
  })
})

t.test('npm install platform via git url with commit sha', function (t) {
  return fetch('https://github.com/apache/cordova-ios.git#8f1535d9381851c17372f197830dc585b5245705', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      var pkgJSON = require('./temp/node_modules/cordova-ios/package.json');
      t.equal(pkgJSON.version, '4.1.0-dev')
      t.equal(result, true)
      t.end()
    })
  })
})

t.test('npm install via git url failed due to lack of subdirectory support', function (t) {
  return fetch('https://github.com/apache/cordova-plugins.git#keyboard', tempDir).then(function (result) {
    //should skip this and go to fail callback
    console.log('success should be skipped')
  }, function (error) {
    return t.test('failure', function(t) {
        t.equal(error.code, 1)
        t.end()
    })
  })
})

t.test('npm install packageID@VERSION with --save', function (t) {
  return fetch('cordova-plugin-file@4.1.0', tempDir, {'save':true}).then(function (result) {
    return t.test('check result', function (t) {
      var pkg = require('./temp/package.json');
      t.equal(pkg.dependencies['cordova-plugin-file'], '^4.1.0');
      t.equal(result, true)
      t.end()
    })
  })
})

t.tearDown(function() {
    console.log('teardown')
    shell.rm('-rf', tempDir)
})
