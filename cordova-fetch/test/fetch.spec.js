var fetch = require('../index.js');
var t = require('tap');
var shell = require('shelljs');
var path = require('path');
var fs = require('fs');

//Create tempdir to store modules
var tempDir = path.join('.', 'test', 'temp')
//Delete old tempDir in case it is there
shell.rm('-rf', tempDir)
shell.mkdir('-p', tempDir);
shell.mkdir('-p', path.join(tempDir, 'node_modules'));

//Copy sample package.json to temp for --save test
shell.cp('test/package.json', 'test/temp/')

t.test('npm install packageID', function (t) {
  return fetch('cordova-plugin-device', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      t.equal(fs.existsSync(result), true)
      t.end()
    })
  }, function (error) {
    return t.test('failure', function(t) {
        console.log(error);
        t.equal(false, true)
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
      t.equal(fs.existsSync(result), true)
      t.end()
    })
  }, function (error) {
    return t.test('failure', function(t) {
        console.log(error);
        t.equal(false, true)
        t.end()
    })
  })
})

t.test('npm install plugin via git url with tag', function (t) {
  return fetch('https://github.com/apache/cordova-plugin-device-motion.git#1.0.0', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      var pkgJSON = require('./temp/node_modules/cordova-plugin-device-motion/package.json');
      t.equal(pkgJSON.version, '1.0.0')
      t.equal(fs.existsSync(result), true)
      t.end()
    })
  }, function (error) {
    return t.test('failure', function(t) {
        console.log(error);
        t.equal(false, true)
        t.end()
    })
  })
})

t.test('npm install platform via git url with branchName', function (t) {
  return fetch('https://github.com/apache/cordova-android.git#4.1.x', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      var pkgJSON = require('./temp/node_modules/cordova-android/package.json');
      t.equal(pkgJSON.version, '4.1.1')
      t.equal(fs.existsSync(result), true)
      t.end()
    })
  }, function (error) {
    return t.test('failure', function(t) {
        console.log(error);
        t.equal(false, true)
        t.end()
    })
  })
})

t.test('npm install platform via git url with commit sha', function (t) {
  return fetch('https://github.com/apache/cordova-ios.git#8f1535d9381851c17372f197830dc585b5245705', tempDir).then(function (result) {
    return t.test('check result', function (t) {
      var pkgJSON = require('./temp/node_modules/cordova-ios/package.json');
      t.equal(fs.existsSync(result), true)
      t.end()
    })
  }, function (error) {
    return t.test('failure', function(t) {
        console.log(error);
        t.equal(false, true)
        t.end()
    })
  })
})

t.test('npm install via git url failed due to lack of subdirectory support', function (t) {
  return fetch('https://github.com/apache/cordova-plugins.git#:keyboard', tempDir).then(function (result) {
    //should skip this and go to fail callback
    return t.test('should not run', function (t) {
        t.equal(fs.existsSync(result), false);
        console.log('success should be skipped')
    })
  }, function (error) {
    return t.test('failure', function(t) {
        t.equal(error.code, 1)
        t.end()
    })
  })
})

t.test('npm install packageID@VERSION with --save', {'timeout':'30000'}, function (t) {
  return fetch('cordova-plugin-file@4.1.0', tempDir, {'save':true}).then(function (result) {
    return t.test('check result', {'timeout':'30000'}, function (t) {
      var pkg = require('./temp/package.json');
      t.equal(pkg.dependencies['cordova-plugin-file'], '^4.1.0');
      t.equal(fs.existsSync(result), true)
      t.end()
    })
  }, function (error) {
    return t.test('failed', function (t) {
        console.log(error);
        t.equal(false, true);
        t.end()
    })
  })
})

t.tearDown(function() {
    console.log('teardown')
    shell.rm('-rf', tempDir)
})
