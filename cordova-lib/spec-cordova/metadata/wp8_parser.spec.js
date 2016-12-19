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

/* jshint boss:true, sub:true */

var wp8Parser = require('../../src/cordova/metadata/wp8_parser'),
    util = require('../../src/cordova/util'),
    path = require('path'),
    shell = require('shelljs'),
    fs = require('fs'),
    et = require('elementtree'),
    xmlHelpers = require('cordova-common').xmlHelpers,
    Q = require('q'),
    child_process = require('child_process'),
    config = require('../../src/cordova/config'),
    Parser = require('../../src/cordova/metadata/parser'),
    ConfigParser = require('cordova-common').ConfigParser,
    CordovaError = require('cordova-common').CordovaError,
    HooksRunner = require('../../src/hooks/HooksRunner');

// Create a real config object before mocking out everything.
var cfg = new ConfigParser(path.join(__dirname, '..', 'test-config.xml'));

var MANIFEST_XML, PROJ_XML, MAINPAGEXAML_XML, XAML_XML;
MANIFEST_XML = PROJ_XML = XAML_XML = '<foo><App Title="s"><PrimaryToken /><RootNamespace/><SilverlightAppEntry/><XapFilename/><AssemblyName/></App></foo>';
MAINPAGEXAML_XML = '<phone:PhoneApplicationPage x:Class="io.cordova.hellocordova.MainPage"' +
    'FontFamily="{StaticResource PhoneFontFamilyNormal}" FontSize="{StaticResource PhoneFontSizeNormal}"' +
    'Foreground="{StaticResource PhoneForegroundBrush}" Background="Black"' +
    'SupportedOrientations="PortraitOrLandscape" Orientation="VAL"' +
    'shell:SystemTray.IsVisible="True" d:DesignHeight="768" d:DesignWidth="480" xmlns:my="clr-namespace:WPCordovaClassLib">' +
    '<Grid x:Name="LayoutRoot" Background="Transparent" HorizontalAlignment="Stretch">' +
        '<Grid.RowDefinitions>' +
            '<RowDefinition Height="*"/>' +
        '</Grid.RowDefinitions>' +
        '<my:CordovaView HorizontalAlignment="Stretch" Margin="0,0,0,0"  x:Name="CordovaView" VerticalAlignment="Stretch" />' +
    '</Grid>' +
    '</phone:PhoneApplicationPage>';

describe('wp8 project parser', function() {
    var proj = '/some/path';
    var exists, exec, custom, readdir, config_read;
    var manifestXml, projXml, mainPageXamlXml;
    beforeEach(function() {
        exists = spyOn(fs, 'existsSync').and.returnValue(true);
        exec = spyOn(child_process, 'exec').and.callFake(function(cmd, opts, cb) {
            (cb || opts)(0, '', '');
        });
        custom = spyOn(config, 'has_custom_path').and.returnValue(false);
        config_read = spyOn(config, 'read').and.callFake(function() {
            return custom() ? {
                lib: {
                    wp8: {
                        url: custom()
                    }
                }
            }
            : ({});
        });
        readdir = spyOn(fs, 'readdirSync').and.returnValue(['test.csproj']);
        projXml = manifestXml = mainPageXamlXml = null;
        spyOn(xmlHelpers, 'parseElementtreeSync').and.callFake(function(path) {
            if (/WMAppManifest.xml$/.exec(path)) {
                return manifestXml = new et.ElementTree(et.XML(MANIFEST_XML));
            } else if (/csproj$/.exec(path)) {
                return projXml = new et.ElementTree(et.XML(PROJ_XML));
            } else if (/MainPage.xaml$/.exec(path)) {
                return mainPageXamlXml = new et.ElementTree(et.XML(MAINPAGEXAML_XML));
            } else if (/xaml$/.exec(path)) {
                return new et.ElementTree(et.XML(XAML_XML));
            } else {
                throw new CordovaError('Unexpected parseElementtreeSync: ' + path);
            }
        });
    });

    function wrapper(p, done, post) {
        p.then(post, function(err) {
            expect(err).toBeUndefined();
        }).fin(done);
    }

    function errorWrapper(p, done, post) {
        p.then(function() {
            expect('this call').toBe('fail');
        }, post).fin(done);
    }

    describe('constructions', function() {
        it('should throw if provided directory does not contain a csproj file', function() {
            readdir.and.returnValue([]);
            expect(function() {
                new wp8Parser(proj);
            }).toThrow();
        });
        it('should create an instance with path, manifest properties', function() {
            expect(function() {
                var p = new wp8Parser(proj);
                expect(p.wp8_proj_dir).toEqual(proj);
                expect(p.manifest_path).toEqual(path.join(proj, 'Properties', 'WMAppManifest.xml'));
            }).not.toThrow();
        });
        it('should be an instance of Parser', function() {
            expect(new wp8Parser(proj) instanceof Parser).toBe(true);
        });
        it('should call super with the correct arguments', function() {
            var call = spyOn(Parser, 'call');
            var p = new wp8Parser(proj);
            expect(call).toHaveBeenCalledWith(p, 'wp8', proj);
        });
    });

    describe('instance', function() {
        var p, cp, rm, is_cordova, write, read, mv, mkdir, getOrientation;
        var wp8_proj = path.join(proj, 'platforms', 'wp8');
        beforeEach(function() {
            p = new wp8Parser(wp8_proj);
            cp = spyOn(shell, 'cp');
            rm = spyOn(shell, 'rm');
            mv = spyOn(shell, 'mv');
            mkdir = spyOn(shell, 'mkdir');
            is_cordova = spyOn(util, 'isCordova').and.returnValue(proj);
            write = spyOn(fs, 'writeFileSync');
            read = spyOn(fs, 'readFileSync').and.returnValue('');
            getOrientation = spyOn(p.helper, 'getOrientation');
        });

        describe('update_from_config method', function() {
            beforeEach(function() {
                cfg.name = function() { return 'testname'; };
                cfg.content = function() { return 'index.html'; };
                cfg.packageName = function() { return 'testpkg'; };
                cfg.version = function() { return 'one point oh'; };
                readdir.and.returnValue(['test.sln']);
            });

            it('should write out the app name to wmappmanifest.xml', function() {
                p.update_from_config(cfg);
                var appEl = manifestXml.getroot().find('.//App');
                expect(appEl.attrib.Title).toEqual('testname');
            });
            it('should write out the app id to csproj file', function() {
                p.update_from_config(cfg);
                var appEl = projXml.getroot().find('.//RootNamespace');
                expect(appEl.text).toContain('testpkg');
            });
            it('should write out the app version to wmappmanifest.xml', function() {
                p.update_from_config(cfg);
                var appEl = manifestXml.getroot().find('.//App');
                expect(appEl.attrib.Version).toEqual('one point oh');
            });
            it('should write out the orientation preference value', function() {
                getOrientation.and.callThrough();
                p.update_from_config(cfg);
                expect(mainPageXamlXml.getroot().attrib['SupportedOrientations']).toEqual('portrait');
                expect(mainPageXamlXml.getroot().attrib['Orientation']).toEqual('portrait');
            });
            it('should handle no orientation', function() {
                getOrientation.and.returnValue('');
                p.update_from_config(cfg);
                expect(mainPageXamlXml.getroot().attrib['SupportedOrientations']).toBeUndefined();
                expect(mainPageXamlXml.getroot().attrib['Orientation']).toBeUndefined();
            });
            it('should handle default orientation', function() {
                getOrientation.and.returnValue(p.helper.ORIENTATION_DEFAULT);
                p.update_from_config(cfg);
                expect(mainPageXamlXml.getroot().attrib['SupportedOrientations']).toBeUndefined();
                expect(mainPageXamlXml.getroot().attrib['Orientation']).toBeUndefined();
            });
            it('should handle portrait orientation', function() {
                getOrientation.and.returnValue(p.helper.ORIENTATION_PORTRAIT);
                p.update_from_config(cfg);
                expect(mainPageXamlXml.getroot().attrib['SupportedOrientations']).toEqual('portrait');
                expect(mainPageXamlXml.getroot().attrib['Orientation']).toEqual('portrait');
            });
            it('should handle landscape orientation', function() {
                getOrientation.and.returnValue(p.helper.ORIENTATION_LANDSCAPE);
                p.update_from_config(cfg);
                expect(mainPageXamlXml.getroot().attrib['SupportedOrientations']).toEqual('landscape');
                expect(mainPageXamlXml.getroot().attrib['Orientation']).toEqual('landscape');
            });
            it('should handle custom orientation', function() {
                getOrientation.and.returnValue('some-custom-orientation');
                p.update_from_config(cfg);
                expect(mainPageXamlXml.getroot().attrib['SupportedOrientations']).toBeUndefined();
                expect(mainPageXamlXml.getroot().attrib['Orientation']).toEqual('some-custom-orientation');
            });
        });
        describe('www_dir method', function() {
            it('should return www', function() {
                expect(p.www_dir()).toEqual(path.join(wp8_proj, 'www'));
            });
        });
        describe('config_xml method', function() {
            it('should return the location of the config.xml', function() {
                expect(p.config_xml()).toEqual(path.join(wp8_proj, 'config.xml'));
            });
        });
        describe('update_www method', function() {
            var update_project;
            beforeEach(function() {
                update_project = spyOn(p, 'update_project');
            });
            it('should rm project-level www and cp in platform agnostic www', function() {
                p.update_www();
                expect(rm).toHaveBeenCalled();
                expect(cp).toHaveBeenCalled();
            });
        });
        describe('update_project method', function() {
            var config, www, svn, fire;
            beforeEach(function() {
                config = spyOn(p, 'update_from_config');
                www = spyOn(p, 'update_www');
                svn = spyOn(util, 'deleteSvnFolders');
                exists.and.returnValue(false);
                fire = spyOn(HooksRunner.prototype, 'fire').and.returnValue(Q());
            });
            it('should call update_from_config', function(done) {
                wrapper(p.update_project(), done, function() {
                    expect(config).toHaveBeenCalled();
                });
            });
            it('should throw if update_from_config throws', function(done) {
                var err = new Error('uh oh!');
                config.and.callFake(function() { throw err; });
                errorWrapper(p.update_project({}), done, function(e) {
                    expect(e).toEqual(err);
                });
            });
            it('should not call update_www', function(done) {
                wrapper(p.update_project(), done, function() {
                    expect(www).not.toHaveBeenCalled();
                });
            });
            it('should call deleteSvnFolders', function(done) {
                wrapper(p.update_project(), done, function() {
                    expect(svn).toHaveBeenCalled();
                });
            });
        });
    });
});
