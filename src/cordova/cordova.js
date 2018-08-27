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

var cordova_events = require('cordova-common').events;
var cordova_util = require('./util');

var off = function () {
    cordova_events.removeListener.apply(cordova_events, arguments);
};

var emit = function () {
    cordova_events.emit.apply(cordova_events, arguments);
};

exports = module.exports = {
    get binname () { return cordova_util.binname; },
    set binname (name) { cordova_util.binname = name; },
    on: function () {
        cordova_events.on.apply(cordova_events, arguments);
    },
    off: off,
    removeListener: off,
    removeAllListeners: function () {
        cordova_events.removeAllListeners.apply(cordova_events, arguments);
    },
    emit: emit,
    trigger: emit,
    findProjectRoot: function (opt_startDir) {
        return cordova_util.isCordova(opt_startDir);
    },
    prepare: require('./prepare'),
    build: require('./build'),
    config: require('./config'),
    create: require('./create'),
    emulate: require('./emulate'),
    plugin: require('./plugin'),
    plugins: require('./plugin'),
    serve: require('./serve'),
    platform: require('./platform'),
    platforms: require('./platform'),
    compile: require('./compile'),
    run: require('./run'),
    info: require('./info'),
    targets: require('./targets'),
    requirements: require('./requirements'),
    projectMetadata: require('./project_metadata'),
    clean: require('./clean')
};
