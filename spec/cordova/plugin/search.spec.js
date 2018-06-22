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
/* globals fail */

var Q = require('q');
var rewire = require('rewire');
var search = rewire('../../../src/cordova/plugin/search');

describe('cordova/plugin/search', function () {
    var hook_mock;
    var opener_mock;
    var opener_revert_mock;
    beforeEach(function () {
        hook_mock = jasmine.createSpyObj('hooks runner mock', ['fire']);
        hook_mock.fire.and.returnValue(Q());
        opener_mock = jasmine.createSpy('opener mock');
        opener_revert_mock = search.__set__('opener', opener_mock);
    });
    afterEach(function () {
        opener_revert_mock();
    });
    it('should fire the before_plugin_search hook', function () {
        var opts = {important: 'options', plugins: []};
        return search(hook_mock, opts).then(function () {
            expect(hook_mock.fire).toHaveBeenCalledWith('before_plugin_search', opts);
        });
    });

    it('should open a link to cordova.apache.org/plugins if no plugins are provided as parameter', function () {
        var opts = {important: 'options', plugins: []};
        return search(hook_mock, opts).then(function () {
            expect(opener_mock).toHaveBeenCalled();
        });
    });

    it('should open a link to cordova.apache.org/plugins, providing the plugins passed in as a query-string parameter', function () {
        var opts = {important: 'options', plugins: ['cordova-plugin-camera', 'cordova-plugin-splashscreen']};
        return search(hook_mock, opts).then(function () {
            expect(opener_mock).toHaveBeenCalled();
        });
    });

    it('should fire the after_plugin_search hook', function () {
        var opts = {important: 'options', plugins: []};
        return search(hook_mock, opts).then(function () {
            expect(hook_mock.fire).toHaveBeenCalledWith('after_plugin_search', opts);
        });
    });
});
