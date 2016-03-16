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

/* jshint laxcomma: true, multistr: true */

var path = require('path')
  , xml_helpers = require('../../src/util/xml-helpers')
  , et = require('elementtree')

  , title = et.XML('<title>HELLO</title>')
  , usesNetworkOne = et.XML('<uses-permission ' +
            'android:name="PACKAGE_NAME.permission.C2D_MESSAGE"/>')
  , usesNetworkTwo = et.XML('<uses-permission android:name=\
            "PACKAGE_NAME.permission.C2D_MESSAGE" />')
  , usesReceive = et.XML('<uses-permission android:name=\
            "com.google.android.c2dm.permission.RECEIVE"/>')
  , helloTagOne = et.XML('<h1>HELLO</h1>')
  , goodbyeTag = et.XML('<h1>GOODBYE</h1>')
  , helloTagTwo = et.XML('<h1>  HELLO  </h1>');

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

describe('xml-helpers', function(){
    describe('parseElementtreeSync', function() {
        it('should parse xml with a byte order mark', function() {
            var xml_path = path.join(__dirname, '../fixtures/projects/windows/bom_test.xml');
            expect(function() {
                xml_helpers.parseElementtreeSync(xml_path);
            }).not.toThrow();
        });
    });
    describe('equalNodes', function() {
        it('should return false for different tags', function(){
            expect(xml_helpers.equalNodes(usesNetworkOne, title)).toBe(false);
        });

        it('should return true for identical tags', function(){
            expect(xml_helpers.equalNodes(usesNetworkOne, usesNetworkTwo)).toBe(true);
        });

        it('should return false for different attributes', function(){
            expect(xml_helpers.equalNodes(usesNetworkOne, usesReceive)).toBe(false);
        });

        it('should distinguish between text', function(){
            expect(xml_helpers.equalNodes(helloTagOne, goodbyeTag)).toBe(false);
        });

        it('should ignore whitespace in text', function(){
            expect(xml_helpers.equalNodes(helloTagOne, helloTagTwo)).toBe(true);
        });

        describe('should compare children', function(){
            it('by child quantity', function(){
                var one = et.XML('<i><b>o</b></i>'),
                    two = et.XML('<i><b>o</b><u></u></i>');

                expect(xml_helpers.equalNodes(one, two)).toBe(false);
            });

            it('by child equality', function(){
                var one = et.XML('<i><b>o</b></i>'),
                    two = et.XML('<i><u></u></i>'),
                    uno = et.XML('<i>\n<b>o</b>\n</i>');

                expect(xml_helpers.equalNodes(one, uno)).toBe(true);
                expect(xml_helpers.equalNodes(one, two)).toBe(false);
            });
        });
    });
    describe('pruneXML', function() {
        var config_xml;

        beforeEach(function() {
            config_xml = xml_helpers.parseElementtreeSync(path.join(__dirname, '../fixtures/projects/android/res/xml/config.xml'));
        });

        it('should remove any children that match the specified selector', function() {
            var children = config_xml.findall('plugins/plugin');
            xml_helpers.pruneXML(config_xml, children, 'plugins');
            expect(config_xml.find('plugins').getchildren().length).toEqual(0);
        });
        it('should do nothing if the children cannot be found', function() {
            var children = [title];
            xml_helpers.pruneXML(config_xml, children, 'plugins');
            expect(config_xml.find('plugins').getchildren().length).toEqual(17);
        });
        it('should be able to handle absolute selectors', function() {
            var children = config_xml.findall('plugins/plugin');
            xml_helpers.pruneXML(config_xml, children, '/cordova/plugins');
            expect(config_xml.find('plugins').getchildren().length).toEqual(0);
        });
        it('should be able to handle absolute selectors with wildcards', function() {
            var children = config_xml.findall('plugins/plugin');
            xml_helpers.pruneXML(config_xml, children, '/*/plugins');
            expect(config_xml.find('plugins').getchildren().length).toEqual(0);
        });
    });

    describe('graftXML', function() {
        var config_xml, plugin_xml;

        beforeEach(function() {
            config_xml = xml_helpers.parseElementtreeSync(path.join(__dirname, '../fixtures/projects/android/res/xml/config.xml'));
            plugin_xml = xml_helpers.parseElementtreeSync(path.join(__dirname, '../fixtures/plugins/ChildBrowser/plugin.xml'));
        });

        it('should add children to the specified selector', function() {
            var children = plugin_xml.find('config-file').getchildren();
            xml_helpers.graftXML(config_xml, children, 'plugins');
            expect(config_xml.find('plugins').getchildren().length).toEqual(19);
        });
        it('should be able to handle absolute selectors', function() {
            var children = plugin_xml.find('config-file').getchildren();
            xml_helpers.graftXML(config_xml, children, '/cordova');
            expect(config_xml.findall('access').length).toEqual(3);
        });
        it('should be able to handle absolute selectors with wildcards', function() {
            var children = plugin_xml.find('config-file').getchildren();
            xml_helpers.graftXML(config_xml, children, '/*');
            expect(config_xml.findall('access').length).toEqual(3);
        });
    });

    describe('mergeXml', function () {
        var dstXml;
        beforeEach(function() {
            dstXml = et.XML(TEST_XML);
        });
        it('should merge attributes and text of the root element without clobbering', function () {
            var testXml = et.XML('<widget foo="bar" id="NOTANID">TEXT</widget>');
            xml_helpers.mergeXml(testXml, dstXml);
            expect(dstXml.attrib.foo).toEqual('bar');
            expect(dstXml.attrib.id).not.toEqual('NOTANID');
            expect(dstXml.text).not.toEqual('TEXT');
        });

        it('should merge attributes and text of the root element with clobbering', function () {
            var testXml = et.XML('<widget foo="bar" id="NOTANID">TEXT</widget>');
            xml_helpers.mergeXml(testXml, dstXml, 'foo', true);
            expect(dstXml.attrib.foo).toEqual('bar');
            expect(dstXml.attrib.id).toEqual('NOTANID');
            expect(dstXml.text).toEqual('TEXT');
        });

        it('should not merge platform tags with the wrong platform', function () {
            var testXml = et.XML('<widget><platform name="bar"><testElement testAttrib="value">testTEXT</testElement></platform></widget>'),
                origCfg = et.tostring(dstXml);

            xml_helpers.mergeXml(testXml, dstXml, 'foo', true);
            expect(et.tostring(dstXml)).toEqual(origCfg);
        });

        it('should merge platform tags with the correct platform', function () {
            var testXml = et.XML('<widget><platform name="bar"><testElement testAttrib="value">testTEXT</testElement></platform></widget>'),
                origCfg = et.tostring(dstXml);

            xml_helpers.mergeXml(testXml, dstXml, 'bar', true);
            expect(et.tostring(dstXml)).not.toEqual(origCfg);
            var testElement = dstXml.find('testElement');
            expect(testElement).toBeDefined();
            expect(testElement.attrib.testAttrib).toEqual('value');
            expect(testElement.text).toEqual('testTEXT');
        });

        it('should merge singelton children without clobber', function () {
            var testXml = et.XML('<widget><author testAttrib="value" href="http://www.nowhere.com">SUPER_AUTHOR</author></widget>');

            xml_helpers.mergeXml(testXml, dstXml);
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

            xml_helpers.mergeXml(testXml, dstXml, '', true);
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

            xml_helpers.mergeXml(testXml, dstXml, '', true);
            var testElements = dstXml.findall('preference');
            expect(testElements.length).toEqual(4);
        });

        it('should handle namespaced elements', function () {
            var testXml = et.XML('<widget><foo:bar testAttrib="value">testText</foo:bar></widget>');

            xml_helpers.mergeXml(testXml, dstXml, 'foo', true);
            var testElement = dstXml.find('foo:bar');
            expect(testElement).toBeDefined();
            expect(testElement.attrib.testAttrib).toEqual('value');
            expect(testElement.text).toEqual('testText');
        });

        it('should not append duplicate non singelton children', function () {
            var testXml = et.XML('<widget><preference name="fullscreen" value="true"/></widget>');

            xml_helpers.mergeXml(testXml, dstXml, '', true);
            var testElements = dstXml.findall('preference');
            expect(testElements.length).toEqual(2);
        });

        it('should not skip partial duplicate non singelton children', function () {
            //remove access tags from dstXML
            var testElements = dstXml.findall('access');
            for(var i = 0; i < testElements.length; i++) {
                dstXml.remove(testElements[i]);
            }
            testElements = dstXml.findall('access');
            expect(testElements.length).toEqual(0);
            //add an external whitelist access tag
            var testXml = et.XML('<widget><access origin="*" launch-external="yes"/></widget>');
            xml_helpers.mergeXml(testXml, dstXml, '', true);
            testElements = dstXml.findall('access');
            expect(testElements.length).toEqual(1);
            //add an internal whitelist access tag
            testXml = et.XML('<widget><access origin="*"/></widget>');
            xml_helpers.mergeXml(testXml, dstXml, '', true);
            testElements = dstXml.findall('access');
            expect(testElements.length).toEqual(2);

        });
        
        it('should remove duplicate preferences (by name attribute value)', function () {
            var testXml = et.XML(
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<widget xmlns     = "http://www.w3.org/ns/widgets"\n' +
                '        xmlns:cdv = "http://cordova.apache.org/ns/1.0"\n' +
                '        id        = "io.cordova.hellocordova"\n' +
                '        version   = "0.0.1">\n' +
                '    <preference name="Orientation" value="default" />\n' +
                '    <preference name="Orientation" value="portrait" />\n' +
                '    <preference name="Orientation" value="landscape" />\n' +
                '    <platform name="ios">\n' +
                '        <preference name="Orientation" value="all" />\n' +
                '        <preference name="Orientation" value="portrait" />\n' +
                '    </platform>\n' +
                '</widget>\n'
            );
            xml_helpers.mergeXml(testXml, dstXml, 'ios');
            var testElements = dstXml.findall('preference[@name="Orientation"]');
            expect(testElements.length).toEqual(1);
        });
                
        it('should merge preferences, with platform preferences written last', function () {
            var testXml = et.XML(
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<widget xmlns     = "http://www.w3.org/ns/widgets"\n' +
                '        xmlns:cdv = "http://cordova.apache.org/ns/1.0"\n' +
                '        id        = "io.cordova.hellocordova"\n' +
                '        version   = "0.0.1">\n' +
                '    <preference name="Orientation" value="default" />\n' +
                '    <platform name="ios">\n' +
                '        <preference name="Orientation" value="all" />\n' +
                '    </platform>\n' +
                '</widget>\n'
            );
            xml_helpers.mergeXml(testXml, dstXml, 'ios');
            var testElements = dstXml.findall('preference[@name="Orientation"]');
            expect(testElements.length).toEqual(2);
            expect(testElements[0].attrib.value).toEqual('default');
            expect(testElements[1].attrib.value).toEqual('all');
        });
    });
});
