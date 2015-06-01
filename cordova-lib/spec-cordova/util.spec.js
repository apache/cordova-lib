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

/* jshint sub: true */

var shell = require('shelljs'),
    path = require('path'),
    fs = require('fs'),
    et = require('elementtree'),
    util = require('../src/cordova/util'),
    temp = path.join(__dirname, '..', 'temp');

var cwd = process.cwd();
var home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var origPWD = process.env['PWD'];

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

describe('util module', function() {
    describe('isCordova method', function() {
        afterEach(function() {
            process.env['PWD'] = origPWD;
            process.chdir(cwd);
        });
        it('should return false if it hits the home directory', function() {
            var somedir = path.join(home, 'somedir');
            this.after(function() {
                shell.rm('-rf', somedir);
            });
            shell.mkdir(somedir);
            expect(util.isCordova(somedir)).toEqual(false);
        });
        it('should return false if it cannot find a .cordova directory up the directory tree', function() {
            var somedir = path.join(home, '..');
            expect(util.isCordova(somedir)).toEqual(false);
        });
        it('should return the first directory it finds with a .cordova folder in it', function() {
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            this.after(function() {
                shell.rm('-rf', somedir);
            });
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
            expect(util.isCordova(somedir)).toEqual(somedir);
        });
        it('should ignore PWD when its undefined', function() {
            delete process.env['PWD'];
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            this.after(function() {
                shell.rm('-rf', somedir);
            });
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(somedir, 'www'));
            shell.mkdir('-p', path.join(somedir, 'config.xml'));
            process.chdir(anotherdir);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('should use PWD when available', function() {
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            this.after(function() {
                shell.rm('-rf', somedir);
            });
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
            process.env['PWD'] = anotherdir;
            process.chdir(path.sep);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('should use cwd as a fallback when PWD is not a cordova dir', function() {
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            this.after(function() {
                shell.rm('-rf', somedir);
            });
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
            process.env['PWD'] = path.sep;
            process.chdir(anotherdir);
            expect(util.isCordova()).toEqual(somedir);
        });
        it('should ignore platform www/config.xml', function() {
            var somedir = path.join(home,'somedir');
            var anotherdir = path.join(somedir, 'anotherdir');
            this.after(function() {
                shell.rm('-rf', somedir);
            });
            shell.mkdir('-p', anotherdir);
            shell.mkdir('-p', path.join(anotherdir, 'www', 'config.xml'));
            shell.mkdir('-p', path.join(somedir, 'www'));
            shell.mkdir('-p', path.join(somedir, 'config.xml'));
            expect(util.isCordova(anotherdir)).toEqual(somedir);
        });
    });
    describe('deleteSvnFolders method', function() {
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        it('should delete .svn folders in any subdirectory of specified dir', function() {
            var one = path.join(temp, 'one');
            var two = path.join(temp, 'two');
            var one_svn = path.join(one, '.svn');
            var two_svn = path.join(two, '.svn');
            shell.mkdir('-p', one_svn);
            shell.mkdir('-p', two_svn);
            util.deleteSvnFolders(temp);
            expect(fs.existsSync(one_svn)).toEqual(false);
            expect(fs.existsSync(two_svn)).toEqual(false);
        });
    });
    describe('listPlatforms method', function() {
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        it('should only return supported platform directories present in a cordova project dir', function() {
            var platforms = path.join(temp, 'platforms');
            var android = path.join(platforms, 'android');
            var ios = path.join(platforms, 'ios');
            var wp8_dir = path.join(platforms, 'wp8');
            var atari = path.join(platforms, 'atari');
            shell.mkdir('-p', android);
            shell.mkdir('-p', ios);
            shell.mkdir('-p', wp8_dir);
            shell.mkdir('-p', atari);
            var res = util.listPlatforms(temp);
            expect(res.length).toEqual(3);
            expect(res.indexOf('atari')).toEqual(-1);
        });
    });
    describe('findPlugins method', function() {
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        it('should only return plugin directories present in a cordova project dir', function() {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var wp8_dir = path.join(plugins, 'wp8');
            var atari = path.join(plugins, 'atari');
            shell.mkdir('-p', android);
            shell.mkdir('-p', ios);
            shell.mkdir('-p', wp8_dir);
            shell.mkdir('-p', atari);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(4);
        });
        it('should not return ".svn" directories', function() {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var svn = path.join(plugins, '.svn');
            shell.mkdir('-p', android);
            shell.mkdir('-p', ios);
            shell.mkdir('-p', svn);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(2);
            expect(res.indexOf('.svn')).toEqual(-1);
        });
        it('should not return "CVS" directories', function() {
            var plugins = path.join(temp, 'plugins');
            var android = path.join(plugins, 'android');
            var ios = path.join(plugins, 'ios');
            var cvs = path.join(plugins, 'CVS');
            shell.mkdir('-p', android);
            shell.mkdir('-p', ios);
            shell.mkdir('-p', cvs);
            var res = util.findPlugins(plugins);
            expect(res.length).toEqual(2);
            expect(res.indexOf('CVS')).toEqual(-1);
        });
    });
    describe('mergeXml method', function () {
        var dstXml;
        beforeEach(function() {
            dstXml = et.XML(TEST_XML);
        });
        it('should merge attributes and text of the root element without clobbering', function () {
            var testXml = et.XML('<widget foo="bar" id="NOTANID">TEXT</widget>');
            util.mergeXml(testXml, dstXml);
            expect(dstXml.attrib.foo).toEqual('bar');
            expect(dstXml.attrib.id).not.toEqual('NOTANID');
            expect(dstXml.text).not.toEqual('TEXT');
        });

        it('should merge attributes and text of the root element with clobbering', function () {
            var testXml = et.XML('<widget foo="bar" id="NOTANID">TEXT</widget>');
            util.mergeXml(testXml, dstXml, 'foo', true);
            expect(dstXml.attrib.foo).toEqual('bar');
            expect(dstXml.attrib.id).toEqual('NOTANID');
            expect(dstXml.text).toEqual('TEXT');
        });

        it('should not merge platform tags with the wrong platform', function () {
            var testXml = et.XML('<widget><platform name="bar"><testElement testAttrib="value">testTEXT</testElement></platform></widget>'),
                origCfg = et.tostring(dstXml);

            util.mergeXml(testXml, dstXml, 'foo', true);
            expect(et.tostring(dstXml)).toEqual(origCfg);
        });

        it('should merge platform tags with the correct platform', function () {
            var testXml = et.XML('<widget><platform name="bar"><testElement testAttrib="value">testTEXT</testElement></platform></widget>'),
                origCfg = et.tostring(dstXml);

            util.mergeXml(testXml, dstXml, 'bar', true);
            expect(et.tostring(dstXml)).not.toEqual(origCfg);
            var testElement = dstXml.find('testElement');
            expect(testElement).toBeDefined();
            expect(testElement.attrib.testAttrib).toEqual('value');
            expect(testElement.text).toEqual('testTEXT');
        });

        it('should merge singelton children without clobber', function () {
            var testXml = et.XML('<widget><author testAttrib="value" href="http://www.nowhere.com">SUPER_AUTHOR</author></widget>');

            util.mergeXml(testXml, dstXml);
            var testElements = dstXml.findall('author');
            expect(testElements).toBeDefined();
            expect(testElements.length).toEqual(1);
            expect(testElements[0].attrib.testAttrib).toEqual('value');
            expect(testElements[0].attrib.href).toEqual('http://cordova.io');
            expect(testElements[0].attrib.email).toEqual('dev@cordova.apache.org');
            expect(testElements[0].text).toContain('Apache Cordova Team');
        });

        it('should clobber singelton children with clobber', function () {
            var testXml = et.XML('<widget><author testAttrib="value" href="http://www.nowhere.com">SUPER_AUTHOR</author></widget>');

            util.mergeXml(testXml, dstXml, '', true);
            var testElements = dstXml.findall('author');
            expect(testElements).toBeDefined();
            expect(testElements.length).toEqual(1);
            expect(testElements[0].attrib.testAttrib).toEqual('value');
            expect(testElements[0].attrib.href).toEqual('http://www.nowhere.com');
            expect(testElements[0].attrib.email).toEqual('dev@cordova.apache.org');
            expect(testElements[0].text).toEqual('SUPER_AUTHOR');
        });

        it('should append non singelton children', function () {
            var testXml = et.XML('<widget><preference num="1"/> <preference num="2"/></widget>');

            util.mergeXml(testXml, dstXml, '', true);
            var testElements = dstXml.findall('preference');
            expect(testElements.length).toEqual(4);
        });

        it('should handle namespaced elements', function () {
            var testXml = et.XML('<widget><foo:bar testAttrib="value">testText</foo:bar></widget>');

            util.mergeXml(testXml, dstXml, 'foo', true);
            var testElement = dstXml.find('foo:bar');
            expect(testElement).toBeDefined();
            expect(testElement.attrib.testAttrib).toEqual('value');
            expect(testElement.text).toEqual('testText');
        });

        it('should not append duplicate non singelton children', function () {
            var testXml = et.XML('<widget><preference name="fullscreen" value="true"/></widget>');

            util.mergeXml(testXml, dstXml, '', true);
            var testElements = dstXml.findall('preference');
            expect(testElements.length).toEqual(2);
        });
    });
});
