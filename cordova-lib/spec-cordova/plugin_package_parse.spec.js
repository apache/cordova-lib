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

var pluginSpec = require('../src/cordova/plugin_spec_parser');

describe('methods for parsing npm plugin packages', function() {

    function checkPluginSpecParsing(testString, scope, id, version) {
        var parsedSpec = pluginSpec.parse(testString);
        expect(parsedSpec.scope).toEqual(scope);
        expect(parsedSpec.id).toEqual(id || testString);
        expect(parsedSpec.version).toEqual(version);
        expect(parsedSpec.package).toEqual(scope ? scope + id : id);
    }

    it('should handle package names with no scope or version', function() {
        checkPluginSpecParsing('test-plugin', null, 'test-plugin', null);
    });
    it('should handle package names with a version', function() {
        checkPluginSpecParsing('test-plugin@1.0.0', null, 'test-plugin', '1.0.0');
        checkPluginSpecParsing('test-plugin@latest', null, 'test-plugin', 'latest');
    });
    it('should handle package names with a scope', function() {
        checkPluginSpecParsing('@test/test-plugin', '@test/', 'test-plugin', null);
    });
    it('should handle package names with a scope and a version', function() {
        checkPluginSpecParsing('@test/test-plugin@1.0.0', '@test/', 'test-plugin', '1.0.0');
        checkPluginSpecParsing('@test/test-plugin@latest', '@test/', 'test-plugin', 'latest');
    });
    it('should handle invalid package specs', function() {
        checkPluginSpecParsing('@nonsense', null, null, null);
        checkPluginSpecParsing('@/nonsense', null, null, null);
        checkPluginSpecParsing('@', null, null, null);
        checkPluginSpecParsing('@nonsense@latest', null, null, null);
        checkPluginSpecParsing('@/@', null, null, null);
        checkPluginSpecParsing('/', null, null, null);
        checkPluginSpecParsing('../../@directory', null, null, null);
        checkPluginSpecParsing('@directory/../@directory', null, null, null);
        checkPluginSpecParsing('./directory', null, null, null);
        checkPluginSpecParsing('directory/directory', null, null, null);
        checkPluginSpecParsing('http://cordova.apache.org', null, null, null);
    });
});
