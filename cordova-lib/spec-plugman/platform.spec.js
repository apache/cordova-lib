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
var platforms = require('../src/plugman/platforms')
var pluginTags = ["source-file", "header-file", "lib-file", "resource-file", "framework"];

function getTest(platformId, pluginTag) {
    return function() {
        it('should exist', function() {
            expect(platforms[platformId][pluginTag] ).toBeDefined();
        });
        it('with an install method', function() {
            expect(platforms[platformId][pluginTag].install ).toBeDefined();
        });
        it('with an uninstall method', function() {
            expect(platforms[platformId][pluginTag].uninstall ).toBeDefined();
        });
    }
}

for(var platformId in platforms) {
    for(var index = 0, len = pluginTags.length; index < len; index++) {
        var funk = getTest(platformId,pluginTags[index]);
        describe(platformId + " should have a " + pluginTags[index] + " object", funk);
    }

}


