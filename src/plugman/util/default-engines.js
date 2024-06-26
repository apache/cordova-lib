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

const path = require('node:path');

module.exports = function (project_dir) {
    return {
        cordova:
            { platform: '*', currentVersion: require('../../../package.json').version },
        'cordova-plugman':
            { platform: '*', currentVersion: require('../../../package.json').version },
        'cordova-android':
            { platform: 'android', scriptSrc: path.join(project_dir, 'cordova', 'version') },
        'cordova-ios':
            { platform: 'ios', scriptSrc: path.join(project_dir, 'cordova', 'version') },
        'cordova-osx':
            { platform: 'osx', scriptSrc: path.join(project_dir, 'cordova', 'version') },
        'cordova-windows':
            { platform: 'windows', scriptSrc: path.join(project_dir, 'cordova', 'version') },
        'cordova-browser':
            { platform: 'browser', scriptSrc: path.join(project_dir, 'cordova', 'version') },
        'cordova-electron':
            { platform: 'electron', scriptSrc: path.join(project_dir, 'cordova', 'version') },
        'apple-xcode':
            { platform: 'ios', scriptSrc: path.join(project_dir, 'cordova', 'apple_xcode_version') },
        'apple-ios':
            { platform: 'ios', scriptSrc: path.join(project_dir, 'cordova', 'apple_ios_version') },
        'apple-osx':
            { platform: 'ios', scriptSrc: path.join(project_dir, 'cordova', 'apple_osx_version') },
        'android-sdk':
            { platform: 'android', scriptSrc: path.join(project_dir, 'cordova', 'android_sdk_version') }
    };
};
