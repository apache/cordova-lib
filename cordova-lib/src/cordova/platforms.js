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

/* jshint node:true, bitwise:true, undef:true, trailing:true, quotmark:true,
          indent:4, unused:vars, latedef:nofunc
*/

module.exports = {
    'ios' : {
        hostos : ['darwin'],
        parser : './metadata/ios_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-ios.git',
        version: '3.6.0'
    },
    'android' : {
        parser : './metadata/android_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-android.git',
        version: '3.6.0'
    },
    'ubuntu' : {
        hostos : ['linux'],
        parser : './metadata/ubuntu_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-ubuntu.git',
        version: '3.6.0'
    },
    'amazon-fireos' : {
        parser : './metadata/amazon_fireos_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-amazon-fireos.git',
        version: '3.6.0'
    },
    'wp8' : {
        hostos : ['win32'],
        parser : './metadata/wp8_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-wp8.git',
        version: '3.6.0',
        altplatform: 'wp',
        subdirectory: 'wp8'
    },
    'blackberry10' : {
        parser : './metadata/blackberry10_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-blackberry.git',
        version: '3.6.0'
    },
    'www':{
        hostos : [],
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-app-hello-world.git',
        source : 'git',
        version: '3.6.0'
    },
    'firefoxos':{
        parser: './metadata/firefoxos_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-firefoxos.git',
        version: '3.6.0'
    },
    'windows8':{
        hostos : ['win32'],
        parser: './metadata/windows_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-windows.git',
        version: '3.6.0',
        subdirectory: 'windows'
    },
    'windows':{
        hostos : ['win32'],
        parser: './metadata/windows_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-windows.git',
        version: '3.6.0',
        subdirectory: 'windows'
    },
    'browser':{
        parser : './metadata/browser_parser',
        url    : 'https://git-wip-us.apache.org/repos/asf?p=cordova-browser.git',
        version: 'master'
    }
};

var addModuleProperty = require('./util').addModuleProperty;
Object.keys(module.exports).forEach(function(key) {
    var obj = module.exports[key];
    if (obj.parser) {
        addModuleProperty(module, 'parser', obj.parser, false, obj);
    }
});
