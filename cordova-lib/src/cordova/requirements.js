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

var cordova_util = require('./util');
var events       = require('../events');
var path         = require('path');
var Q            = require('q');
var CordovaError = require('../CordovaError');

/**
 * Runs requirements check against platforms specified in 'platfoms' argument
 *
 * @param  {String[]} platforms List of platforms for requirements check. If none, all
 *                                      platforms, added to project will be checked
 *
 * @return {Promise}            Promise fullfilled with map of platforms and requirements
 *                                      check results for each platform
 */
module.exports = function check_reqs(platforms) {
    platforms = cordova_util.preProcessOptions(platforms).platforms;

    var projectRoot = cordova_util.isCordova();
    var platformsDir = path.join(projectRoot, 'platforms');
    var platformChecks = platforms.map(function (platform) {
        var modulePath = path.join(platformsDir, platform, 'cordova', 'lib', 'check_reqs');
        try {
            events.emit('verbose', 'Checking requirements for ' + platform + ' platform');
            return require(modulePath).check_all();
        } catch (e) {
            var errorMsg = 'Failed to check requirements for ' + platform + ' platform. ' +
                'check_reqs module is missing for platform. Skipping it...';
            return Q.reject(errorMsg);
        }
    });

    var checks = {};

    return Q.allSettled(platformChecks)
    .then(function (settledChecks) {

        settledChecks.forEach(function (settledCheck, idx) {
            var platformName = platforms[idx];
            var result  = settledCheck.state === 'fulfilled' ?
                settledCheck.value :
                new CordovaError(settledCheck.reason);

            checks[platformName] = result;
        });

        return checks;
    });
};
