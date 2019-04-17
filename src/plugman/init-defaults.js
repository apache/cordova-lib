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
 **/

/* global config, dirname, basename, yes, prompt */
// PromZard file that is used by createpackagejson and init-package-json module

// The PromZard context is also provided via this. Make use of this to avoid
// having to use the reserved word package. This way we can lint this file.
const pkg = this.package;

var fs = require('fs-extra');
var path = require('path');

function readDeps () {
    return function (cb) {
        fs.readdir('node_modules', function (er, dir) {
            if (er) return cb();
            var deps = {};
            var n = dir.length;
            if (n === 0) return cb(null, deps);
            dir.forEach(function (d) {
                if (d.match(/^\./)) return next();

                var dp = path.join(dirname, 'node_modules', d, 'package.json');
                fs.readFile(dp, 'utf8', function (er, p) {
                    if (er) return next();
                    try { p = JSON.parse(p); } catch (e) { return next(); }
                    if (!p.version) return next();
                    deps[d] = undefined + p.version;
                    return next();
                });
            });
            function next () {
                if (--n === 0) return cb(null, deps);
            }
        });
    };
}

// The defaults read from plugin.xml
const defaults = config.toJSON();

var name = pkg.name || defaults.id || basename;
exports.name = yes ? name : prompt('name', name);

var version = pkg.version || defaults.version || '1.0.0';
exports.version = yes ? version : prompt('version', version);

if (!pkg.description) {
    if (defaults.description) {
        exports.description = defaults.description;
    } else {
        exports.description = yes ? '' : prompt('description');
    }
}

if (!pkg.cordova) {
    exports.cordova = {};
    if (defaults.id) {
        exports.cordova.id = defaults.id;
    }
    if (defaults.platforms) {
        exports.cordova.platforms = defaults.platforms;
    }
}

if (!pkg.dependencies) {
    exports.dependencies = readDeps();
}

if (!pkg.devDependencies) {
    exports.devDependencies = readDeps();
}

if (!pkg.repository) {
    exports.repository = function (cb) {
        fs.readFile('.git/config', 'utf8', function (er, gconf) {
            if (er || !gconf) {
                if (defaults.repository) {
                    return cb(null, yes ? defaults.repository : prompt('git repository', defaults.repository));
                }
                return cb(null, yes ? '' : prompt('git repository'));
            }
            gconf = gconf.split(/\r?\n/);
            var i = gconf.indexOf('[remote "origin"]');
            var u;
            if (i !== -1) {
                u = gconf[i + 1];
                if (!u.match(/^\s*url =/)) u = gconf[i + 2];
                if (!u.match(/^\s*url =/)) u = null;
                else u = u.replace(/^\s*url = /, '');
            }
            if (u && u.match(/^git@github.com:/)) { u = u.replace(/^git@github.com:/, 'https://github.com/'); }

            return cb(null, yes ? u : prompt('git repository', u));
        });
    };
}

if (!pkg.keywords) {
    if (defaults.keywords) {
        exports.keywords = defaults.keywords;
    } else {
        exports.keywords = yes ? '' : prompt('keywords', function (s) {
            if (!s) return undefined;
            if (Array.isArray(s)) s = s.join(' ');
            if (typeof s !== 'string') return s;
            return s.split(/[\s,]+/);
        });
    }
}

if (!pkg.engines) {
    if (defaults.engines && defaults.engines.length > 0) {
        exports.engines = defaults.engines;
    }
}

if (!pkg.author) {
    exports.author = prompt('author');
}

const license = pkg.license || defaults.license || 'ISC';
exports.license = yes ? license : prompt('license', license);
