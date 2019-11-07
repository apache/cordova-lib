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

const path = require('path');
const rewire = require('rewire');
const util = require('../../../src/cordova/util');
const platforms = require('../../../src/platforms/platforms');
const PlatformJson = require('cordova-common').PlatformJson;

const project_dir = '/some/path';

describe('cordova/prepare/platforms', () => {
    let preparePlatforms, platform_munger_mock;

    beforeEach(function () {
        preparePlatforms = rewire('../../../src/cordova/prepare/platforms');

        platform_munger_mock = class { add_config_changes () {} };
        spyOn(platform_munger_mock.prototype, 'add_config_changes').and.returnValue({
            save_all: jasmine.createSpy('platform munger save mock')
        });
        preparePlatforms.__set__({
            ConfigParser: class {},
            PlatformMunger: platform_munger_mock
        });

        spyOn(platforms, 'getPlatformApi').and.returnValue({
            prepare: jasmine.createSpy('prepare').and.returnValue(Promise.resolve())
        });
        spyOn(PlatformJson, 'load');
        spyOn(util, 'projectConfig').and.returnValue(project_dir);
        spyOn(util, 'projectWww').and.returnValue(path.join(project_dir, 'www'));
    });

    it('should retrieve the platform API via getPlatformApi per platform provided, and invoke the prepare method from that API', () => {
        return preparePlatforms(['android'], project_dir, {}).then(() => {
            expect(platforms.getPlatformApi).toHaveBeenCalledWith('android');
            expect(platforms.getPlatformApi().prepare).toHaveBeenCalled();
        });
    });

    it('should handle config changes by invoking add_config_changes and save_all', () => {
        const pmmp = platform_munger_mock.prototype;
        return preparePlatforms(['android'], project_dir, {}).then(() => {
            expect(pmmp.add_config_changes).toHaveBeenCalled();
            expect(pmmp.add_config_changes().save_all).toHaveBeenCalled();
        });
    });
});
