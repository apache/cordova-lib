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

var list = require('../../src/cordova/plugin/list');

describe('cordova/plugin/list', function () {
    it('should fire the before_plugin_ls hook');
    it('should emit a "no plugins added" result if there are no installed plugins');
    it('should warn if plugin list contains dependencies that are missing');
    it('should warn if plugin list contains a plugin dependency that does not have a version satisfied');
    it('should emit a result containing a description of plugins installed');
    it('should fire the after_plugin_ls hook');
    it('should resolve the promise by returning an array of plugin ids installed');
});
