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

var fetch = require('cordova-fetch');
var superspawn = require('cordova-common').superspawn;

module.exports = {
    settings: null,

    /**
     * @method info
     * @param {String} name Plugin name
     * @return {Promise.<Object>} Promised package info.
     */
    info: function (plugin, dest, opts) {
        opts = opts || {};
        var fetchArgs = opts.link ? ['link'] : ['install'];
        plugin = plugin.shift();
        // set the directory where npm install will be run
        opts.cwd = dest;
        // check if npm is installed
        return fetch.isNpmInstalled()
            .then(function () {
                return superspawn.spawn('npm', fetchArgs, opts)
                    .then(function (info) {
                        // Plugin info should be accessed as info[version]. If a version
                        // specifier like >=x.y.z was used when calling npm view, info
                        // can contain several versions, but we take the first one here.
                        var version = Object.keys(info)[0];
                        return info[version];
                    });
            });
    }
};
