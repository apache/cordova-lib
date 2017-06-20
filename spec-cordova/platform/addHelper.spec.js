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

describe('cordova/platform/addHelper', function () {
    describe('error/warning conditions', function () {
        it('should require specifying at least one platform');
        it('should warn if host OS does not support the specified platform');
    });
    describe('happy path (success conditions)', function () {
        it('should fire the before_platform_* hook');
        it('should warn about deprecated platforms');
        /*
         * first "leg" (`then`) of the promise is platform "spec" support:
         * - tries to infer spec from either package.json or config.xml
         * - defaults to pinned version for platform.
         * - downloads the platform, passing in spec.
         * --> how to test: spy on downloadPlatform, validate spec passed.
         * --> should mock out downloadPlatform completely for all happy path tests. this would short-circuit the first addHelper promise `then`.
         * second "leg" (`then`) of the promise:
         * - checks for already-added or not-added platform requirements. TODO: couldnt we move this up to before downloading, to the initial error/warning checks?
         * - invokes platform api createPlatform or updatePlatform
         * - if not restoring, runs a `prepare`
         * - if just added, installsPluginsForNewPlatform (TODO for fil: familiarize yourself why not just a regular "install plugin for platform" - why the 'newPlatform' API?)
         * - if not restoring, run a prepare. TODO: didnt we just do this? we just installed plugins, so maybe its needed, but couldnt we just run a single prepare after possibly installing plugins?
         * third `then`:
         * - save particular platform version installed to platform metadata.
         * - if autosaving or opts.save is provided, write platform to config.xml
         * fourth `then`:
         * - save added platform to package.json if exists.
         * fifth `then`:
         * - fire after_platform_add/update hook
         */
    });
});
