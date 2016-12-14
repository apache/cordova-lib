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

var shell = require('shelljs'),
    path = require('path'),
    CordovaCheck = require('../src/CordovaCheck');

var cwd = process.cwd();
var home = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
var origPWD = process.env.PWD;

describe('findProjectRoot method', function() {
    afterEach(function() {
        process.env.PWD = origPWD;
        process.chdir(cwd);
    });
function removeDir(someDirectory) {
    shell.rm('-rf', someDirectory);
}
    it('should return false if it hits the home directory', function() {
        var somedir = path.join(home, 'somedir');
        removeDir(somedir);
        shell.mkdir(somedir);
        expect(CordovaCheck.findProjectRoot(somedir)).toEqual(false);
    });
    it('should return false if it cannot find a .cordova directory up the directory tree', function() {
        var somedir = path.join(home, '..');
        expect(CordovaCheck.findProjectRoot(somedir)).toEqual(false);
    });
    it('should return the first directory it finds with a .cordova folder in it', function() {
        var somedir = path.join(home,'somedir');
        var anotherdir = path.join(somedir, 'anotherdir');
        removeDir(somedir);
        shell.mkdir('-p', anotherdir);
        shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
        expect(CordovaCheck.findProjectRoot(somedir)).toEqual(somedir);
    });
    it('should ignore PWD when its undefined', function() {
        delete process.env.PWD;
        var somedir = path.join(home,'somedir');
        var anotherdir = path.join(somedir, 'anotherdir');
        removeDir(somedir);
        shell.mkdir('-p', anotherdir);
        shell.mkdir('-p', path.join(somedir, 'www'));
        shell.mkdir('-p', path.join(somedir, 'config.xml'));
        process.chdir(anotherdir);
        expect(CordovaCheck.findProjectRoot()).toEqual(somedir);
    });
    it('should use PWD when available', function() {
        var somedir = path.join(home,'somedir');
        var anotherdir = path.join(somedir, 'anotherdir');
        removeDir(somedir);
        shell.mkdir('-p', anotherdir);
        shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
        process.env.PWD = anotherdir;
        process.chdir(path.sep);
        expect(CordovaCheck.findProjectRoot()).toEqual(somedir);
    });
    it('should use cwd as a fallback when PWD is not a cordova dir', function() {
        var somedir = path.join(home,'somedir');
        var anotherdir = path.join(somedir, 'anotherdir');
        removeDir(somedir);
        shell.mkdir('-p', anotherdir);
        shell.mkdir('-p', path.join(somedir, 'www', 'config.xml'));
        process.env.PWD = path.sep;
        process.chdir(anotherdir);
        expect(CordovaCheck.findProjectRoot()).toEqual(somedir);
    });
    it('should ignore platform www/config.xml', function() {
        var somedir = path.join(home,'somedir');
        var anotherdir = path.join(somedir, 'anotherdir');
        removeDir(somedir);
        shell.mkdir('-p', anotherdir);
        shell.mkdir('-p', path.join(anotherdir, 'www', 'config.xml'));
        shell.mkdir('-p', path.join(somedir, 'www'));
        shell.mkdir('-p', path.join(somedir, 'config.xml'));
        expect(CordovaCheck.findProjectRoot(anotherdir)).toEqual(somedir);
    });
});