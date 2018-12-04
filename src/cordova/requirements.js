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

const { object: zipObject } = require('underscore');
const cordova_util = require('./util');
const { CordovaError } = require('cordova-common');
const knownPlatforms = require('../platforms/platforms');

/**
 * Runs requirements check against platforms specified in 'platfoms' argument
 *
 * @param  {String[]} platforms List of platforms for requirements check. If
 *   none, all platforms, added to project will be checked
 *
 * @return {Promise<Object>}    Promise fullfilled with map of platforms and
 *   requirements check results for each platform.
 */
module.exports = function check_reqs (platforms) {
    return Promise.resolve().then(() => {
        const normalizedPlatforms = cordova_util.preProcessOptions(platforms).platforms;

        return Promise.all(
            normalizedPlatforms.map(getPlatformRequirementsOrError)
        ).then(results => zipObject(normalizedPlatforms, results));
    });
};

function getPlatformRequirementsOrError (platform) {
    return knownPlatforms
        .getPlatformApi(platform)
        .requirements()
        .catch(err => new CordovaError(err));
}
