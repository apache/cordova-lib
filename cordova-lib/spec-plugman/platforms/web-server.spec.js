/*
 * Tests the web-server plugman/platforms file.
*/
// Need to require our actual code we are testing as well as a sample project
// which should reflect the desired project structure.
var web  = require('../../src/plugman/platforms/web-server'),
    path = require('path'),
	fs   = require('fs'),
    web_project = path.join(__dirname, '..', 'projects', 'web');

describe('web project handler', function() {
	describe('www_dir method', function() {
        it('should return cordova-web project www location using www_dir', function() {
            expect(web.www_dir(path.sep)).toEqual(path.sep + path.join('www'));
        });
    });
    describe('package_name method', function() {
        it('should return an web projects proper package name', function() {
            expect(web.package_name(web_project)).toEqual('little test');
        });
    });
});