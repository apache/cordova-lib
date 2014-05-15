//spec-cordova/metadata/web_server_parser.spec.js

/**
    The spec case to test my web server. This was copied from
    firefoxos so we should be careful to double check each method.

    Need to design the operations neccessary for success.
*/
var platforms = require('../../src/cordova/platforms'),
    util = require('../../src/cordova/util'),
    path = require('path'),
    shell = require('shelljs'),
    fs = require('fs'),
    config = require('../../src/cordova/config'),
    ConfigParser = require('../../src/cordova/ConfigParser'),
    cordova = require('../../src/cordova/cordova');

var cfg = new ConfigParser(path.join(__dirname, '..', 'test-config.xml'));
describe('web_server project parser', function() {
    // var proj = path.join('some', 'path');
    // var exists, exec, custom;
    beforeEach(function() {
        // exists = spyOn(fs, 'existsSync').andReturn(true);
        // exec = spyOn(shell, 'exec').andCallFake(function(cmd, opts, cb) {
        //     cb(0, '');
        // });
        // custom = spyOn(config, 'has_custom_path').andReturn(false);
    });

    describe('constructions', function() {
        it('should create an instance with a path', function() {
            // expect(function() {
            //     var p = new platforms.android.parser(proj);
            //     expect(p.path).toEqual(proj);
            // }).not.toThrow();
        });
    });

    describe('instance', function() {
        // var p, cp, rm, is_cordova, write, read;
        // var ff_proj = path.join(proj, 'platforms', 'web_server');
        beforeEach(function() {
            // p = new platforms.web_server.parser(ff_proj);
            // cp = spyOn(shell, 'cp');
            // rm = spyOn(shell, 'rm');
            // is_cordova = spyOn(util, 'isCordova').andReturn(proj);
            // write = spyOn(fs, 'writeFileSync');
            // read = spyOn(fs, 'readFileSync').andReturn('');
        });

        describe('update_from_config method', function() {
            beforeEach(function() {
                // cfg.name = function() { return 'testname'; };
                // cfg.packageName = function() { return 'testpkg'; };
                // cfg.version = function() { return '1.0'; };
            });

    		it('should write manifest.webapp', function() {
                //p.update_from_config(cfg);
                //expect(write.mostRecentCall.args[0]).toEqual('manifest.webapp');
            });
        });
    });
});
