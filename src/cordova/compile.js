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

var Q = require('q');
var cordova_util = require('./util');
var HooksRunner = require('../hooks/HooksRunner');
var promiseUtil = require('../util/promise-util');
var platform_lib = require('../platforms/platforms');
var _ = require('underscore');

// Returns a promise.
module.exports = function compile (options) {
    return Q()
        .then(function () {
            var projectRoot = cordova_util.cdProjectRoot();
            options = cordova_util.preProcessOptions(options);

            var hooksRunner = new HooksRunner(projectRoot);
            return hooksRunner.fire('before_compile', options)
                .then(function () {
                    return promiseUtil.Q_chainmap(options.platforms, function (platform) {
                        return platform_lib
                            .getPlatformApi(platform)
                            .build(_.clone(options.options));
                    });
                }).then(function () {
                    return hooksRunner.fire('after_compile', options);
                });
        });
};
