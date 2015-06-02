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

var platforms = require('./platformsConfig.json'),
    platformApi = require('./PlatformApi');

// Remove this block soon. The parser property is no longer used in
// cordova-lib but some downstream tools still use it.
var addModuleProperty = require('../cordova/util').addModuleProperty;
Object.keys(platforms).forEach(function(key) {
    var obj = platforms[key];
    if (obj.parser_file) {
        addModuleProperty(module, 'parser', obj.parser_file, false, obj);
    }
});

module.exports = platforms;

// We don't want these methods to be enumerable on the platforms object, because we expect enumerable properties of the
// platforms object to be platforms.
Object.defineProperties(module.exports, {
    'getPlatformApi': {value: platformApi.getPlatformApi, configurable: true, writable: true},
    'BasePlatformApi': {value: platformApi.BasePlatformApi, configurable: true, writable: true}
});
