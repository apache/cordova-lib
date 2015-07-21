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
/* jshint quotmark:false */

var util = require('util');

/**
 * Used to handle plugin merges and clobbers
 * @param {string} target - target namespace to clobber or merge with
 * @param {boolean} doClobber - Determines if clobbers or merges. Clobbers if true.
 * @param {string} scriptPath - Path to the javascript file
 */
module.exports = prepare_namespace;

function prepare_namespace(target, doClobber, scriptPath) {
    var old = target;
    target = target.replace(/^window(\.)?/, '');
    var lastDot = target.lastIndexOf('.');
    var lastName = target.substr(lastDot + 1);
    var props = target.split('.');
    var code = '';

    if(target !== '') {
        for(var i = 1, len = props.length ; i <= len ; i++) {
            var sub = props.slice(0, i).join('.');
            code += util.format('window.%s = window.%s || {};\n', sub, sub);
        }
    }
    props.unshift('window');
    var object = props.slice(0, props.length - 1).join('.');
    if(doClobber === true) {
        return util.format(
                "%s\n;require('cordova/builder').assignOrWrapInDeprecateGetter(%s, '%s', require('%s'));",
                code,
                object,
                lastName,
                scriptPath
                );
    } else if(old !== '') {
        return util.format(
                "%s\n;require('cordova/builder').recursiveMerge(%s, require('%s'));",
                code,
                old,
                scriptPath
                );
    }
}
