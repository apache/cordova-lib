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

var opener = require('opener');
var Q = require('q');

module.exports = search;

function search (hooksRunner, opts) {
    return hooksRunner.fire('before_plugin_search', opts)
        .then(function () {
            var link = 'http://cordova.apache.org/plugins/';
            if (opts.plugins.length > 0) {
                var keywords = (opts.plugins).join(' ');
                var query = link + '?q=' + encodeURI(keywords);
                opener(query);
            } else {
                opener(link);
            }

            return Q.resolve();
        }).then(function () {
            return hooksRunner.fire('after_plugin_search', opts);
        });
}
