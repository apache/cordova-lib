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

var rewire = require('rewire');
var fs = require('fs');
var save = rewire('../../../src/cordova/plugin/save');
var cordova_util = require('../../../src/cordova/util');
var semver = require('semver');

describe('cordova/plugin/save', function () {
    var projectRoot = '/some/path';
    var cfg_parser_mock = function () {};
    var cfg_parser_revert_mock;
    var fake_plugin_list = ['VRPlugin', 'MastodonSocialPlugin'];
    var fake_fetch_json = {'VRPlugin': {}, 'MastodonSocialPlugin': {}};
    var plugin_info_provider_mock = function () {};
    var plugin_info_provider_revert_mock;

    beforeEach(function () {
        cfg_parser_mock.prototype = jasmine.createSpyObj('config parser protytpe mock', ['getPluginIdList', 'removePlugin', 'write', 'addPlugin']);
        cfg_parser_mock.prototype.getPluginIdList.and.returnValue(fake_plugin_list);
        cfg_parser_revert_mock = save.__set__('ConfigParser', cfg_parser_mock);
        spyOn(cordova_util, 'projectConfig').and.returnValue(projectRoot + '/config.xml');
        spyOn(fs, 'readFileSync').and.returnValue(JSON.stringify(fake_fetch_json));
        spyOn(save, 'versionString');
        plugin_info_provider_mock.prototype = jasmine.createSpyObj('plugin info provider mock', ['get']);
        plugin_info_provider_revert_mock = save.__set__('PluginInfoProvider', plugin_info_provider_mock);
    });
    afterEach(function () {
        cfg_parser_revert_mock();
        plugin_info_provider_revert_mock();
    });
    describe('error conditions', function () {
        it('should explode if there was an issue parsing or reading from fetch.json file', function () {
            fs.readFileSync.and.callFake(function () {
                throw new Error('massive explosions during file reading!');
            });
            return save(projectRoot).then(function () {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err).toContain('massive explosions');
            });
        });
    });
    describe('happy path', function () {
        it('check that existing plugins are getting removed', function () {
            return save(projectRoot).then(function () {
                expect(cfg_parser_mock.prototype.removePlugin).toHaveBeenCalledWith('VRPlugin');
                expect(cfg_parser_mock.prototype.removePlugin).toHaveBeenCalledWith('MastodonSocialPlugin');
            });
        });

        it('plugins are being removed first and then only top level plugins are being restored', function () {
            var fake_fetch_json =
                {'VRPlugin': {'source': {
                    'type': 'registry',
                    'id': 'id'
                },
                'is_top_level': true
                },
                'MastodonSocialPlugin': { 'source': {
                    'type': 'registry',
                    'id': 'id'
                },
                'is_top_level': false }};

            fs.readFileSync.and.returnValue(JSON.stringify(fake_fetch_json));
            return save(projectRoot).then(function () {
                expect(cfg_parser_mock.prototype.removePlugin).toHaveBeenCalledWith('VRPlugin');
                expect(cfg_parser_mock.prototype.removePlugin).toHaveBeenCalledWith('MastodonSocialPlugin');
                expect(cfg_parser_mock.prototype.addPlugin).toHaveBeenCalledWith(Object({ name: 'VRPlugin' }), [ ]);
                expect(cfg_parser_mock.prototype.addPlugin).not.toHaveBeenCalledWith(Object({ name: 'MastodonSocialPlugin' }), [ ]);
                expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
            });
        });

        it('should write individual plugin specs to config.xml', function () {
            var fake_fetch_json =
                {'VRPlugin': {'source': {
                    'type': 'registry',
                    'id': 'id'
                },
                'is_top_level': true }};
            fs.readFileSync.and.returnValue(JSON.stringify(fake_fetch_json));
            spyOn(save, 'getSpec').and.returnValue('1.0.0');
            return save(projectRoot).then(function () {
                expect(cfg_parser_mock.prototype.addPlugin).toHaveBeenCalledWith(Object({ name: 'VRPlugin', spec: '1.0.0' }), jasmine.any(Object));
                expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
            });
        });

        it('should write individual plugin variables to config.xml', function () {
            var fake_fetch_json =
                {'VRPlugin': {'source': {
                    'type': 'registry',
                    'id': 'id'
                },
                'is_top_level': true,
                'variables': {
                    'var 1': ' '
                }}};
            fs.readFileSync.and.returnValue(JSON.stringify(fake_fetch_json));
            return save(projectRoot).then(function () {
                expect(cfg_parser_mock.prototype.addPlugin).toHaveBeenCalledWith(jasmine.any(Object), [ Object({ name: 'var 1', value: ' ' }) ]);
                expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
            });
        });
    });
    describe('getSpec helper method', function () {
        it('should return a plugin source\'s url or path property immediately', function () {
            spyOn(save, 'getSpec').and.callThrough();
            save.getSpec({ url: 'https://git-wip-us.apache.org/repos/asf/cordova-plugin-camera.git' }, '/some/path', 'VRPlugin');
            expect(save.getSpec).toHaveBeenCalledWith(Object({ url: 'https://git-wip-us.apache.org/repos/asf/cordova-plugin-camera.git' }), '/some/path', 'VRPlugin');
            expect(save.getSpec({ url: 'https://git-wip-us.apache.org/repos/asf/cordova-plugin-camera.git' }, '/some/path', 'VRPlugin')).toEqual('https://git-wip-us.apache.org/repos/asf/cordova-plugin-camera.git');
        });

        it('getSpec should return a version if a version was provided to plugin id', function () {
            save.versionString.and.callThrough();
            expect(save.getSpec({id: 'cordova-plugin-camera@^1.1.0'}, '/some/path', 'cordova-plugin-camera')).toEqual('^1.1.0');
        });

        it('should return a version that includes scope if scope was part of plugin id', function () {
            save.versionString.and.callThrough();
            expect(save.getSpec({ type: 'registry', id: '@scoped/package@^1.0.0' }, '/some/path', 'cordova-plugin-camera')).toEqual('@scoped/package@^1.0.0');
        });

        it('should fall back to using PluginInfoProvider to retrieve a version as last resort', function () {
            expect(save.getSpec({ id: 'cordova-plugin-camera' }, '/some/path', 'cordova-plugin-camera')).toEqual(null);
            expect(plugin_info_provider_mock.prototype.get).toHaveBeenCalled();
        });
    });

    describe('getPluginVariables helper method', function () {
        it('if no variables are passed in, should return empty', function () {
            expect(save.getPluginVariables()).toEqual([]);
        });
        it('if variables are passed in, should return result & get added to name and value', function () {
            expect(save.getPluginVariables({ variable: 'var 1' })).toEqual([ { name: 'variable', value: 'var 1' } ]);
        });
    });

    describe('versionString helper method', function () {
        it('if no version, should return null', function () {
            save.versionString.and.callThrough();
            spyOn(semver, 'valid').and.returnValue(null);
            spyOn(semver, 'validRange').and.returnValue(null);
            expect(save.versionString()).toBe(null);
        });
        it('return version passed in, if it is within the valid range', function () {
            save.versionString.and.callThrough();
            spyOn(semver, 'valid').and.returnValue(null);
            spyOn(semver, 'validRange').and.returnValue('^1.3.2');
            expect(save.versionString('^1.3.2')).toBe('^1.3.2');
        });
        it('should check and return a valid version', function () {
            save.versionString.and.callThrough();
            spyOn(semver, 'valid').and.returnValue('1.3.2');
            expect(save.versionString('1.3.2')).toBe('~1.3.2');
        });
    });
});
