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

var add = require('../../src/cordova/plugin/add');

describe('cordova/plugin/add', function () {
    describe('main method', function () {
        describe('error/warning conditions', function () {
            it('should error out if at least one plugin is not specified');
            it('should error out if any mandatory plugin variables are not provided');
        });
        describe('happy path', function () {
            it('should fire the before_plugin_add hook');
            it('should determine where to fetch a plugin from using determinePluginTarget and invoke plugman.fetch with the resolved target');
            it('should retrieve any variables for the plugin from config.xml and provide them as cli variables only when the cli variables are not already provided via options');
            it('should invoke plugman.install for each platform added to the project');
            it('should save plugin variable information to package.json file (if exists)');
            it('should overwrite plugin information in config.xml after a successful installation');
            it('should invoke preparePlatforms if plugman.install returned a truthy value');
            it('should fire after_plugin_add hook');
        });
    });
    describe('determinePluginTarget helper method', function () {
        it('should return the target directly if the target is pluginSpec-parseable');
        it('should return the target directly if the target is a URL');
        it('should return the target directly if the target is a directory');
        it('should retrieve plugin version from package.json (if exists)');
        it('should retrieve plugin version from config.xml as a last resort');
        describe('with fetchOptions.save=true, writing out plugin versions retrieved from config files (either config.xml or package.json)', function () {
            it('should write out URL-as-plugin-spec to package.json');
            it('should write out directory-as-plugin-spec to package.json');
        });
        it('should return plugin version retrieved from package.json or config.xml if it is a URL');
        it('should return plugin version retrieved from package.json or config.xml if it is a directory');
        it('should return plugin version retrieved from package.json or config.xml if it has a scope');
        it('should return plugin-id@plugin-version if retrieved from package.json or config.xml ');
        describe('with no version inferred from config files or provided plugin target', function () {
            describe('when searchpath or noregistry flag is provided', function () {
                it('should end up just returning the target passed in');
            });
            describe('when registry/npm is to be used (neither searchpath nor noregistry flag is provided)', function () {
                it('should retrieve plugin info via registry.info');
                it('should feed registry.info plugin information into getFetchVersion');
                it('should return the target as plugin-id@fetched-version');
            });
        });
    });
    // TODO: reorganize these tests once the logic here is understood! -filmaj
    // TODO: rewrite the tests from integration-tests/plugin_fetch.spec.js to here.
    describe('TODO! unit tests to replace integration-tests/plugin_fetch.spec.js', function () {
        describe('getFetchVersion helper method', function () {
            it('should resolve with null if plugin info does not contain engines and engines.cordovaDependencies properties');
            it('should retrieve platform version info via getInstalledPlatformsWithVersions and feed that information into determinePluginVersionToFetch');
        });
        describe('determinePluginVersionToFetch helper method', function () {
            it('should return null if no valid semver versions exist and no upperbound constraints were placed');
        });
        describe('getFailedRequirements helper method', function () {
        });
    });
});
