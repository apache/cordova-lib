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

const rewire = require('rewire');

const events = require('cordova-common').events;

const platform_list = rewire('../../../src/cordova/platform/list');

describe('cordova/platform/list show deprecated platforms info', function () {
    var hooks_mock;
    var projectRoot = '/some/path';

    beforeEach(function () {
        // use mock platforms info so that this test can working properly
        // with or without any deprecated platforms
        platform_list.__set__({
            cordova_util: {
                getInstalledPlatformsWithVersions: () => Promise.resolve({})
            },
            platforms: {
                hostSupports: () => true,
                info: {
                    android: {
                        version: '1.2.3',
                        deprecated: false
                    },
                    wp7: {
                        version: '4.5.6',
                        deprecated: true
                    }
                },
                list: ['android', 'wp7']
            }
        });

        hooks_mock = jasmine.createSpyObj('hooksRunner mock', ['fire']);
        hooks_mock.fire.and.returnValue(Promise.resolve());

        spyOn(events, 'emit');
    });

    it('shows available platforms with deprecated info', () => {
        return platform_list(hooks_mock, projectRoot, { save: true })
            .then((result) => {
                expect(events.emit).toHaveBeenCalledWith('results', jasmine.stringMatching(/Installed platforms:[\s\S]*Available.*:[\s]*android 1.2.3[\s]*wp7 4.5.6 \(deprecated\)/));
            });
    });

    it('returns platform list with deprecated info', function () {
        var platformList = ['android 1.2.3', 'wp7 4.5.6'];
        expect(platform_list.addDeprecatedInformationToPlatforms(platformList)).toEqual(['android 1.2.3', 'wp7 4.5.6 (deprecated)']);
    });
});
