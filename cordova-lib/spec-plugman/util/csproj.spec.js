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
var csproj  = require('../../src/util/windows/csproj'),
    path    = require('path');

var wp8_project     = path.join(__dirname, '..', 'projects', 'wp8'),
    example_csproj  = path.join(wp8_project, 'CordovaAppProj.csproj');

describe('csproj', function() {
    it('Test 001 : should throw if passed in an invalid xml file path ref', function() {
        expect(function() {
            new csproj('blahblah');
        }).toThrow();
    });
    it('Test 002 : should successfully parse a valid csproj file into an xml document', function() {
        var doc;
        expect(function() {
            doc = new csproj(example_csproj);
        }).not.toThrow();
        expect(doc.xml.getroot()).toBeDefined();
    });

    describe('write method', function() {

    });

    describe('source file', function() {

        var page_test   = path.join('src', 'UI', 'PageTest.xaml');
        var page_test_cs = path.join('src', 'UI', 'PageTest.xaml.cs');
        var lib_test    = path.join('lib', 'LibraryTest.dll');
        var file_test   = path.join('src', 'FileTest.cs');
        var content_test   = path.join('src', 'Content.img');

        describe('add method', function() {
            var test_csproj = new csproj(example_csproj);
            it('Test 003 : should properly add .xaml files', function() {
                test_csproj.addSourceFile(page_test);
                expect(test_csproj.xml.getroot().find('.//Page[@Include="src\\UI\\PageTest.xaml"]')).toBeTruthy();
                expect(test_csproj.xml.getroot().find('.//Page[@Include="src\\UI\\PageTest.xaml"]/Generator').text).toEqual('MSBuild:Compile');
                expect(test_csproj.xml.getroot().find('.//Page[@Include="src\\UI\\PageTest.xaml"]/SubType').text).toEqual('Designer');
            });
            it('Test 004 : should properly add .xaml.cs files', function() {
                test_csproj.addSourceFile(page_test_cs);
                expect(test_csproj.xml.getroot().find('.//Compile[@Include="src\\UI\\PageTest.xaml.cs"]')).toBeTruthy();
                expect(test_csproj.xml.getroot().find('.//Compile[@Include="src\\UI\\PageTest.xaml.cs"]/DependentUpon').text).toEqual('PageTest.xaml');
            });
            it('Test 005 : should properly add .cs files', function() {
                test_csproj.addSourceFile(file_test);
                expect(test_csproj.xml.getroot().find('.//Compile[@Include="src\\FileTest.cs"]')).toBeTruthy();
            });
            it('Test 006 : should properly add content files', function() {
                test_csproj.addSourceFile(content_test);
                expect(test_csproj.xml.getroot().find('.//Content[@Include="src\\Content.img"]')).toBeTruthy();
            });
        });

        describe('remove method', function() {
            var test_csproj = new csproj(example_csproj);
            it('Test 007 : should properly remove .xaml pages', function() {
                test_csproj.removeSourceFile(page_test);
                expect(test_csproj.xml.getroot().find('.//Page[@Include="src\\UI\\PageTest.xaml"]')).toBeFalsy();
            });
            it('Test 008 : should properly remove .xaml.cs files', function() {
                test_csproj.removeSourceFile(page_test_cs);
                expect(test_csproj.xml.getroot().find('.//Compile[@Include="src\\UI\\PageTest.xaml.cs"]')).toBeFalsy();
            });
            it('Test 009 : should properly remove .cs files', function() {
                test_csproj.removeSourceFile(file_test);
                expect(test_csproj.xml.getroot().find('.//Compile[@Include="src\\FileTest.cs"]')).toBeFalsy();
            });
            it('Test 010 : should properly remove content files', function() {
                test_csproj.removeSourceFile(content_test);
                expect(test_csproj.xml.getroot().find('.//Content[@Include="src\\Content.img"]')).toBeFalsy();
            });
            it('Test 011 : should remove all empty ItemGroup\'s', function() {
                test_csproj.removeSourceFile(page_test);
                test_csproj.removeSourceFile(page_test_cs);
                test_csproj.removeSourceFile(lib_test);
                test_csproj.removeSourceFile(file_test);
                var item_groups = test_csproj.xml.findall('ItemGroup');
                for (var i = 0, l = item_groups.length; i < l; i++) {
                    var group = item_groups[i];
                    expect(group._children.length).toBeGreaterThan(0);
                }
            });

        });
    });
});
