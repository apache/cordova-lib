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

var path = require('path'),
    events = require('../../events');

exports.checkIfOnePathEscape = function (src, prefix, opt) {
    // resolve symbolic links
    var real_prefix = path.resolve(prefix);
    var src_path;
    try {
        opt = opt || {};
        if (opt.nojoin) {
            src_path = src;
        } else {
            src_path = path.join(prefix, src);
        }
        src_path = path.resolve(src_path);       // resolve . and ..
    } catch (e) {
        if (opt.rootdir) {
            if (src_path.indexOf(opt.rootdir) !== 0) {
                throw new Error('Plugin attempted to access files outside the plugin.');
            }
        } else if (src_path.indexOf(real_prefix) !== 0) {
            throw new Error('Plugin attempted to access files outside the plugin.');
        } else {
            events.emit('verbose', 'path does not exist: '+src_path);
        }
    }

    if (opt.rootdir) {
        if (src_path.indexOf(opt.rootdir) !== 0) {
            throw new Error('Plugin attempted to access files outside the plugin.');
        }
    } else if (src_path.indexOf(real_prefix) !== 0) {
        throw new Error('Plugin attempted to access files outside the plugin.');
    }
}

/**
 * check if the src attribute path escapes the src_prefix.
 * check if the other attribute paths escape the dst_prefix.
 * @param {Object} elem - plugin.xml element <source-file>, <header-file>, <resource-file>, etc.
 * @param {String[]} attributes - array of attributes strings for various path. e.g, "src".
 * @param {String} src_prefix - path to be prefixed to "src" attributes.
 * @param {String} dst_prefix - path to be prefixed to other attributes, e.g., "target-dir".
 * @returns {Boolean} false if path is legal
 * @throws {Error} if violates the security policy.
 */
exports.checkIfPathsEscape = function(elem, attributes, src_prefix, dst_prefix, root_dir) {
    if (!elem || !attributes) {
        return;
    }

    // resolve symbolic links
    for (var i=0; i<attributes.length; i++) {
        if(!elem.hasOwnProperty(attributes[i]))
          continue;
      
        var attrib_dir = elem[attributes[i]];
        if (!attrib_dir)
            continue;

        if (attributes[i] === 'src' || attributes[i] === 'scriptSrc') {
            exports.checkIfOnePathEscape(attrib_dir, src_prefix);
        } else if (root_dir) {
            exports.checkIfOnePathEscape(attrib_dir, dst_prefix, {rootdir: root_dir});
        } else {
            exports.checkIfOnePathEscape(attrib_dir, dst_prefix);
        }
    }
}

