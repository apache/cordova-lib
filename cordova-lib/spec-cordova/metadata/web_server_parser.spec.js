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

jasmine.getEnv().addReporter(new jasmine.ConsoleReporter(console.log));

var cfg = new ConfigParser(path.join(__dirname, '..', 'test-config.xml'));
describe('web_server project parser', function() {
    var proj = path.join('some', 'path');
    // var exists, exec, custom;
    beforeEach(function() {
    });

    describe('constructions', function() {
        it('should create an instance with a path and tech choice', function() {
            expect(function() {
                var p = new platforms.web_server.parser(proj);
                expect(p.tech).toEqual('nodejs');
                expect(p.path).toEqual(path.join(proj, p.tech));
            }).not.toThrow();
        });
    });

    describe('instance', function() {
        var p, read, write;
        var ff_proj = path.join(proj, 'platforms', 'web_server');
        beforeEach(function() {
            p = new platforms.web_server.parser(ff_proj);
            write = spyOn(fs, 'writeFileSync');
            read = spyOn(fs, 'readFileSync').andReturn('{}');
        });

        describe('update_from_config method', function() {
            beforeEach(function() {
                cfg.name = function() { return 'testname'; };
                cfg.description = function() {return 'test description yo!'};
            });

    		it('should write name and description of cordova app in package.json', function() {
                // Mocking this method lets us inspect that we are writing out the correct data.
                fs.writeFileSync.andCallFake(function(file, data, format) {
                    expect(JSON.parse(data).name).toEqual(cfg.name());
                    expect(JSON.parse(data).description).toEqual(cfg.description());
                });

                p.update_from_config(cfg);
            });
        });
    });
});
