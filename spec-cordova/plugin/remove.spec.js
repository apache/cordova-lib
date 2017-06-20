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

var remove = require('../../src/cordova/plugin/remove');

describe('cordova/plugin/remove', function () {
    describe('error/warning conditions', function () {
        it('should require that a plugin be provided');
        it('should require that a provided plugin be installed in the current project');
    });
    describe('happy path', function () {
        it('should fire the before_plugin_rm hook');
        it('should call plugman.uninstall.uninstallPlatform for each platform installed in the project and for each provided plugin');
        it('should trigger a prepare if plugman.uninstall.uninstallPlatform returned something falsy');
        it('should call plugman.uninstall.uninstallPlugin once plugin has been uninstalled for each platform');
        describe('when save option is provided or autosave config is on', function () {
            it('should remove provided plugins from config.xml');
            it('should remove provided plugins from package.json (if exists)');
        });
        it('should remove fetch metadata from fetch.json');
        it('should fire the after_plugin_rm hook');
    });
});
