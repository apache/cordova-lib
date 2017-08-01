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

// var Q = require('q');
// var rewire = require('rewire');
// var platform_save = rewire('../../../src/cordova/platform/save');
// var platform_metadata = require('../../../src/cordova/platform_metadata');
// var fail;
// var semver = require('semver');

// describe('cordova/platform/save', function () {
//     var hooks_mock;
//     var projectRoot = '/some/path';
//     var cfg_parser_mock = function () {};
//     var cfg_parser_revert_mock;

//     beforeEach(function () {
//         spyOn(semver, 'valid');
//         cfg_parser_mock.prototype = jasmine.createSpyObj('config parser mock', ['write', 'removeEngine', 'addEngine', 'getEngines']);
//         cfg_parser_revert_mock = platform_save.__set__('ConfigParser', cfg_parser_mock);
//         cfg_parser_mock.prototype.getEngines.and.returnValue(['android']);
//     });

//     afterEach(function () {
//         cfg_parser_revert_mock();
//     });

//     it('should first remove platforms already in config.xml', function (done) {
//         platform_save(hooks_mock, projectRoot, {save: true})
//             .then(function (res) {
//                 expect(cfg_parser_mock.prototype.getEngines).toHaveBeenCalled();
//                 expect(cfg_parser_mock.prototype.removeEngine).toHaveBeenCalled();
//             }).fail(function (err) {
//                 fail('unexpected failure handler invoked!');
//                 console.error(err);
//             }).done(done);
//     });

//     it('add and write to config.xml', function (done) {
//         spyOn(platform_metadata, 'getPlatformVersions').and.returnValue(Q([{platform: 'android', version: '6.3.0'}]));
//         semver.valid.and.returnValue('6.0.0');
//         platform_save(hooks_mock, projectRoot, {save: true})
//             .then(function (result) {
//                 expect(cfg_parser_mock.prototype.addEngine).toHaveBeenCalledWith('android', '~6.0.0');
//                 expect(cfg_parser_mock.prototype.write).toHaveBeenCalled();
//             }).fail(function (err) {
//                 fail('unexpected failure handler invoked!');
//                 console.error(err);
//             }).done(done);
//     });

//     it('should return valid version', function (done) {
//         platform_save.getSpecString('~5.0.0');
//         expect(semver.valid).toHaveBeenCalledWith('~5.0.0', true);
//         done();
//     });
// });
