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
/* eslint-env jasmine */

var save = require('../../src/cordova/plugin/save');

describe('cordova/plugin/save', function () {
    describe('error conditions', function () {
        it('should explode if there was an issue parsing or reading from fetch.json file');
    });
    describe('happy path', function () {
        it('should remove all plugins from config.xml and re-add new ones based on those retrieved from fetch.json');
        it('should only add top-level plugins to config.xml');
        it('should write individual plugin specs to config.xml');
        it('should write individual plugin variables to config.xml');
    });
    describe('getSpec helper method', function () {
        it('should return a plugin source\'s url or path property immediately');
        it('should return a version if a version was provided to plugin id');
        it('should return a version that includes scope if scope was part of plugin id');
        it('should fall back to using PluginInfoProvider to retrieve a version as last resort');
    });
});
