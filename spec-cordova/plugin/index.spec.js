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

var plugin = require('../../src/cordova/plugin');

describe('cordova/plugin', function () {
    describe('error conditions', function () {
        // TODO: what about search cmd?
        it('should require at least one target for add and rm commands');
    });
    describe('handling/massaging of parameters', function () {
        it('should be able to handle an array of targets');
        it('should be able to handle a single string as a target');
        it('should transform targets that start with a dash into options');
        it('should also include targets into a plugins property on options');
    });
    describe('happy path', function () {
        it('should direct "add" command to the "add" submodule');
        it('should direct "rm" and "remove" commands to the "remove" submodule');
        it('should direct "search" command to the "search" submodule');
        it('should direct "save" command to the "save" submodule');
        it('should direct "list", all other commands and no command at all to the "list" submodule');
    });
});
