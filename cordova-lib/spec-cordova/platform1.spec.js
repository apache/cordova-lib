var path = require('path'),
    fs = require('fs'),
    shell = require('shelljs'),
    rewire = require('rewire'),
    platform = rewire('../src/cordova/platform'),
    cordova_util = require('../src/cordova/util'),
    prepare = require('../src/cordova/prepare'),
    cordova = require('../src/cordova/cordova').raw,
    platformMetadata = require('../src/cordova/platform_metadata'),
    platforms = require('../src/platforms/platforms'),
    lazy_load = require('../src/cordova/lazy_load'),
    Q = require('q');

var config_xml_path = 'spec-cordova/fixtures/config.xml';
var pinnedAndroidVer = platforms.android.version;

describe('platform', function () {
    var hooksRunnerRevert;
    beforeEach(function() {
        hooksRunnerRevert = platform.__set__('HooksRunner', function() {});
        spyOn(cordova_util, 'cdProjectRoot').and.returnValue('somepath');
    });

    afterEach(function() {
        hooksRunnerRevert();
    });

    it('should successfuly call platform add function', function(done) {
        spyOn(platform, 'add').and.returnValue(true);
        return platform('add', ['android'], {})
        .then(function() {
            expect(platform.add.calls.count()).toEqual(1);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        }).fin(done);
    });

    it('should successfuly call platform remove function', function(done) {
        spyOn(platform, 'remove').and.returnValue(true);
        return platform('remove', ['android'], {})
        .then(function() {
            expect(platform.remove.calls.count()).toEqual(1);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        }).fin(done);
    });

    it('should successfuly call platform update function', function(done) {
        spyOn(platform, 'update').and.returnValue(true);
        return platform('update', ['android'], {})
        .then(function() {
            expect(platform.update.calls.count()).toEqual(1);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        }).fin(done);
    });

    it('should successfuly call platform check function', function(done) {
        spyOn(platform, 'check').and.returnValue(true);
        return platform('check', ['android'], {})
        .then(function() {
            expect(platform.check.calls.count()).toEqual(1);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        }).fin(done);
    });

    it('should successfuly call platform save function', function(done) {
        spyOn(platform, 'save').and.returnValue(true);
        return platform('save', ['android'], {})
        .then(function() {
            expect(platform.save.calls.count()).toEqual(1);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        }).fin(done);
    });

    it('should successfuly call platform list function', function(done) {
        spyOn(platform, 'list').and.returnValue(true);
        return platform('list', ['android'], {})
        .then(function() {
            expect(platform.list.calls.count()).toEqual(1);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        }).fin(done);
    });

    it('should successfuly throw an error if targets is undefined', function(done) {
        return platform('add', undefined, {})
        .then(false)
        .fail(function(e) {
            expect(e).toBeDefined();
            expect(e.message).toContain('You need to qualify `add` or `remove` with one or more platforms!');
        }).fin(done);
    });
});

describe('platform add', function() {
    
    var projectRoot = path.join('some', 'path'),
        windowsPath = path.join(projectRoot,'cordova-windows'),
        platrevert,
        configParserRevert,
        pkgJson = {},
        configEngines = [],
        fetchArgs = [];

    // Mock HooksRunner
    var hooksRunnerMock = {
        fire: function () {
            return Q();
        }
    };

    // Mock Platform Api
    function PlatformApiMock() {}
    PlatformApiMock.createPlatform = function() {
        return Q();
    };
    PlatformApiMock.updatePlatform = function() {
        return Q();
    };

    // Mock cordova-fetch
    var fetchMock = function(target) {
        fetchArgs.push(target);
        //return the basename of either the target, url or local path 
        return Q(path.basename(target));
    };

    // Mock ConfigParser
    function ConfigParserMock() {}
    ConfigParserMock.prototype = {
        write: function() {
            //do nothing
        },
        addEngine: function(plat, spec) {
            //add engine to configEngines
            configEngines.push({'name': plat, 'spec': spec});
        },
        removeEngine: function(plat) {
            //delete engine from configEngines
            configEngines.forEach(function(item, index) {
                if(item.name === plat){
                    delete configEngines[index]; 
                }
            });
        },
        getEngines: function() {
            return configEngines;
        }
    };

    function getPlatformDetailsFromDirMock(dir, platform) {
        var ver;
        var parts = dir.split('@');
        //attempt to derive version from dir/target
        //eg dir = android@~6.1.1 || atari@1.0.0
        if(parts.length > 1) {
            ver = parts[1] || parts[0];
            //remove ~ or ^ since the real function version wouldn't have that
            if(ver[0] === '~' || ver[0] === '^') {
                ver = ver.slice(1);
            }
        }
        // not a perfect representation of the real function, but good for testing
		return Q({
            'libDir':'Api.js',
            'platform':platform || path.basename(dir),
            'version':ver || 'n/a'
        });
    }

    beforeEach(function() {
        spyOn(cordova_util, 'projectConfig').and.returnValue(config_xml_path);
        spyOn(shell, 'mkdir').and.returnValue(true);
        platrevert = platform.__set__('fetch', fetchMock);
        
        configParserRevert = platform.__set__('ConfigParser', ConfigParserMock);
        spyOn(platform, 'getPlatformDetailsFromDir').and.callFake(getPlatformDetailsFromDirMock);
        spyOn(prepare, 'preparePlatforms').and.returnValue(Q());
        spyOn(cordova, 'prepare').and.returnValue(Q());
        spyOn(platformMetadata, 'save').and.returnValue(true);
        spyOn(cordova_util, 'getPlatformApiFunction').and.returnValue(PlatformApiMock);
        //writes to package.json
        spyOn(fs, 'writeFileSync').and.callFake(function(dest, pkgJ) {
            pkgJson = JSON.parse(pkgJ);
            return true;
        });

        //return true for windows local path target
        spyOn(cordova_util,'isDirectory').and.callFake(function(filePath) {
            if(filePath.indexOf(windowsPath) !== -1) {
                return true;
            } else {
                return false;
            }
        });

        spyOn(lazy_load, 'git_clone').and.callFake(function(git_url, branch) {
            return Q(path.basename(git_url));
        });
        spyOn(lazy_load, 'based_on_config').and.callFake(function(projRoot, target) {
            return Q(target);
        });
    });

    afterEach(function() {
        platrevert();
        configParserRevert();
        pkgJson = {};
        configEngines = [];
        fetchArgs = [];
    });

    it('should succeed with fetch, save and package.json. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
        //spy for package.json to exist
        spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'package.json') {
                return true;
            } else {
                return false;
            }
        });
        
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
        
        platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': true, 'save': true})
        .then(function() {
            expect(cordova_util.projectConfig.calls.count()).toEqual(1);
            expect(shell.mkdir.calls.count()).toEqual(1);
            expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
            expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
            expect(cordova.prepare.calls.count()).toEqual(4);
            expect(prepare.preparePlatforms.calls.count()).toEqual(4);
            expect(platformMetadata.save.calls.count()).toEqual(4);
            expect(lazy_load.git_clone.calls.count()).toEqual(0);
            expect(lazy_load.based_on_config.calls.count()).toEqual(0);
            //expect correct arugments to be passed to cordova-fetch
            expect(fetchArgs[0]).toEqual('cordova-android@'+pinnedAndroidVer);
            expect(fetchArgs[1]).toEqual('https://github.com/apache/cordova-ios');
            expect(fetchArgs[2]).toContain('cordova-windows');
            expect(fetchArgs[3]).toEqual('atari@1.0.0'); 
            //test pkgJson is being built correctly
            expect(fs.writeFileSync.calls.count()).toEqual(1);
            expect(pkgJson.cordova).toBeDefined();
            expect(pkgJson.cordova.platforms).toEqual([ 'android', 'atari', 'cordova-ios', 'cordova-windows' ]);
            expect(cordova_util.requireNoCache.calls.count()).toEqual(5);
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(4);
            expect(configEngines).toEqual(
                [ { name: 'android', spec: pinnedAndroidVer },
                { name: 'cordova-ios',
                spec: 'https://github.com/apache/cordova-ios' },
                { name: 'cordova-windows',
                spec: windowsPath },
                { name: 'atari', spec: '~1.0.0' } ]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    it('should succeed with fetch, save and no package.json. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
        //spy for package.json to not exist
        spyOn(fs,'existsSync').and.returnValue(false);
        
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache');
 
        platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': true, 'save': true})
        .then(function() {
            expect(cordova_util.projectConfig.calls.count()).toEqual(1);
            expect(shell.mkdir.calls.count()).toEqual(1);
            expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
            expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
            expect(cordova.prepare.calls.count()).toEqual(4);
            expect(prepare.preparePlatforms.calls.count()).toEqual(4);
            expect(platformMetadata.save.calls.count()).toEqual(4);
            expect(lazy_load.git_clone.calls.count()).toEqual(0);
            expect(lazy_load.based_on_config.calls.count()).toEqual(0);
            //expect correct arugments to be passed to cordova-fetch
            expect(fetchArgs[0]).toEqual('cordova-android@'+pinnedAndroidVer);
            expect(fetchArgs[1]).toEqual('https://github.com/apache/cordova-ios');
            expect(fetchArgs[2]).toContain('cordova-windows');
            expect(fetchArgs[3]).toEqual('atari@1.0.0');
            //test pkgJson releated commands aren't being called
            expect(fs.writeFileSync.calls.count()).toEqual(0);
            expect(pkgJson.cordova).toBeUndefined();
            expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(4);
            expect(configEngines).toEqual(
                [ { name: 'android', spec: pinnedAndroidVer },
                { name: 'cordova-ios',
                spec: 'https://github.com/apache/cordova-ios' },
                { name: 'cordova-windows',
                spec: windowsPath },
                { name: 'atari', spec: '~1.0.0' } ]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    //no need to worry about packagae.json in this case
    it('should succeed with fetch, no save. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
        //spy for package.json to not exist
        spyOn(fs,'existsSync').and.returnValue(false);
 
        platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': true, 'save': false})
        .then(function() {
            expect(cordova_util.projectConfig.calls.count()).toEqual(1);
            expect(shell.mkdir.calls.count()).toEqual(1);
            expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
            expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
            expect(cordova.prepare.calls.count()).toEqual(4);
            expect(prepare.preparePlatforms.calls.count()).toEqual(4);
            expect(platformMetadata.save.calls.count()).toEqual(4);
            expect(lazy_load.git_clone.calls.count()).toEqual(0);
            expect(lazy_load.based_on_config.calls.count()).toEqual(0);
            //expect correct arugments to be passed to cordova-fetch
            expect(fetchArgs[0]).toEqual('cordova-android@'+pinnedAndroidVer);
            expect(fetchArgs[1]).toEqual('https://github.com/apache/cordova-ios');
            expect(fetchArgs[2]).toContain('cordova-windows');
            expect(fetchArgs[3]).toEqual('atari@1.0.0'); 
            //test pkgJson releated commands aren't being called
            expect(fs.writeFileSync.calls.count()).toEqual(0);
            expect(pkgJson.cordova).toBeUndefined();
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(0);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    it('should succeed with save, package.json and no fetch. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
        //spy for package.json to exist
        spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'package.json') {
                return true;
            } else {
                return false;
            }
        });
        
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
        
        platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': false, 'save': true})
        .then(function() {
            expect(cordova_util.projectConfig.calls.count()).toEqual(1);
            expect(shell.mkdir.calls.count()).toEqual(1);
            expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
            expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
            expect(cordova.prepare.calls.count()).toEqual(4);
            expect(prepare.preparePlatforms.calls.count()).toEqual(4);
            expect(platformMetadata.save.calls.count()).toEqual(4);
            expect(lazy_load.git_clone.calls.count()).toEqual(1);
            expect(lazy_load.based_on_config.calls.count()).toEqual(2);
            //expect correct arguments to be passed to cordova-fetch
            expect(fetchArgs.length).toEqual(0);
            //test pkgJson is being built correctly
            expect(fs.writeFileSync.calls.count()).toEqual(1);
            expect(pkgJson.cordova).toBeDefined();
            expect(pkgJson.cordova.platforms).toEqual([ 'android', 'atari', 'cordova-ios', 'cordova-windows' ]);
            expect(cordova_util.requireNoCache.calls.count()).toEqual(5);
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(4);
            expect(configEngines).toEqual(
                [ { name: 'android', spec: pinnedAndroidVer },
                { name: 'cordova-ios',
                spec: 'https://github.com/apache/cordova-ios' },
                { name: 'cordova-windows',
                spec: windowsPath },
                { name: 'atari', spec: '~1.0.0' } ]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    it('should succeed with save, no package.json and no fetch. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
        //spy for package.json to not exist
        spyOn(fs,'existsSync').and.returnValue(false);
                
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
        
        platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': false, 'save': true})
        .then(function() {
            expect(cordova_util.projectConfig.calls.count()).toEqual(1);
            expect(shell.mkdir.calls.count()).toEqual(1);
            expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
            expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
            expect(cordova.prepare.calls.count()).toEqual(4);
            expect(prepare.preparePlatforms.calls.count()).toEqual(4);
            expect(platformMetadata.save.calls.count()).toEqual(4);
            expect(lazy_load.git_clone.calls.count()).toEqual(1);
            expect(lazy_load.based_on_config.calls.count()).toEqual(2);
            //expect correct arguments to be passed to cordova-fetch
            expect(fetchArgs.length).toEqual(0);
            //test pkgJson releated commands aren't being called
            expect(fs.writeFileSync.calls.count()).toEqual(0);
            expect(pkgJson.cordova).toBeUndefined();
            expect(cordova_util.requireNoCache.calls.count()).toEqual(0);
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(4);
            expect(configEngines).toEqual(
                [ { name: 'android', spec: pinnedAndroidVer },
                { name: 'cordova-ios',
                spec: 'https://github.com/apache/cordova-ios' },
                { name: 'cordova-windows',
                spec: windowsPath },
                { name: 'atari', spec: '~1.0.0' } ]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    //no need to worry about packagae.json in this case
    it('should succeed with no fetch, no save. Tests npm package, gitURL, local path and non core platforms with spec as targets', function(done) {
        //spy for package.json to not exist
        spyOn(fs,'existsSync').and.returnValue(false);
 
        platform.add(hooksRunnerMock, projectRoot, ['android', 'https://github.com/apache/cordova-ios', windowsPath, 'atari@1.0.0'], {'fetch': false, 'save': false})
        .then(function() {
            expect(cordova_util.projectConfig.calls.count()).toEqual(1);
            expect(shell.mkdir.calls.count()).toEqual(1);
            expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(4);
            expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(4);
            expect(cordova.prepare.calls.count()).toEqual(4);
            expect(prepare.preparePlatforms.calls.count()).toEqual(4);
            expect(platformMetadata.save.calls.count()).toEqual(4);
            expect(lazy_load.git_clone.calls.count()).toEqual(1);
            expect(lazy_load.based_on_config.calls.count()).toEqual(2);
            //test pkgJson releated commands aren't being called
            expect(fs.writeFileSync.calls.count()).toEqual(0);
            expect(pkgJson.cordova).toBeUndefined();
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(0);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    it('should succeed with fetch, save and package.json. Gets android spec from package.json', function(done) {
        //spy for package.json to exist
        spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'package.json') {
                return true;
            } else {
                return false;
            }
        });
        
        pkgJson = {
            'dependencies': {
                'cordova-android': '^6.2.1'
            }
        };
        //require packge.json object
        spyOn(cordova_util, 'requireNoCache').and.returnValue(pkgJson);
        
        platform.add(hooksRunnerMock, projectRoot, ['android'], {'fetch': true, 'save': true})
        .then(function() {
            expect(cordova_util.projectConfig.calls.count()).toEqual(1);
            expect(shell.mkdir.calls.count()).toEqual(1);
            expect(platform.getPlatformDetailsFromDir.calls.count()).toEqual(1);
            expect(cordova_util.getPlatformApiFunction.calls.count()).toEqual(1);
            expect(cordova.prepare.calls.count()).toEqual(1);
            expect(prepare.preparePlatforms.calls.count()).toEqual(1);
            expect(platformMetadata.save.calls.count()).toEqual(1);
            expect(lazy_load.git_clone.calls.count()).toEqual(0);
            expect(lazy_load.based_on_config.calls.count()).toEqual(0);
            //expect correct arugments to be passed to cordova-fetch
            expect(fetchArgs).toEqual([ 'cordova-android@^6.2.1']);
            //test pkgJson is being built correctly
            expect(fs.writeFileSync.calls.count()).toEqual(1);
            expect(pkgJson.cordova).toBeDefined();
            expect(pkgJson.cordova.platforms).toEqual([ 'android']);
            expect(cordova_util.requireNoCache.calls.count()).toEqual(2);
            //test cfg.engines code is being run with correct arugments
            expect(configEngines.length).toEqual(1);
            expect(configEngines).toEqual(
                [ { name: 'android', spec: '~6.2.1'}]);
        }).fail(function(e) {
            expect(e).toBeUndefined();
        })
        .fin(done);
    });

    it('throws if platform already added', function(done) {
        //spy for android to exist
        spyOn(fs,'existsSync').and.callFake(function(filePath) {
            if(path.basename(filePath) === 'android') {
                return true;
            } else {
                return false;
            }
        });

        platform.add(hooksRunnerMock, projectRoot, ['android'], {'fetch': true, 'save': true})
        .then(false)
        .fail(function(e) {
            expect(e.message).toBe('Platform android already added.');
        })
        .fin(done);
    });

    it('throws if the target list is undefined', function (done) {
        var targets; // = undefined;
        platform.add(hooksRunnerMock, projectRoot, targets, {})
        .then(false)
        .fail(function (error) {
            expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
        }).fin(done);
    });

    it('throws if the target list is null', function (done) {
        var targets = null; // = undefined;
        platform.add(hooksRunnerMock, projectRoot, targets, {})
        .then(false)
        .fail(function (error) {
            expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
        }).fin(done);
    });

    it('throws if the target list is empty', function (done) {
        var targets = []; // = undefined;
        platform.add(hooksRunnerMock, projectRoot, targets, {})
        .then(false)
        .fail(function (error) {
            expect(error.message).toBe('No platform specified. Please specify a platform to add. See `cordova platform list`.');
        }).fin(done);
    });
});
