/**
 Licensed to the Apache Software Foundation (ASF) under one
 or more contributor license agreements.  See the NOTICE file
 distributed with this work for additional information
 regarding copyright ownership.  The ASF licenses this file
 to you under the Apache License, Version 2.0 (the
 'License'); you may not use this file except in compliance
 with the License.  You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing,
 software distributed under the License is distributed on an
 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 KIND, either express or implied.  See the License for the
 specific language governing permissions and limitations
 under the License.
 */

var Q = require('q');
var shell = require('shelljs');
var superspawn = require('cordova-common').superspawn;
var events = require('cordova-common').events;
var util = require('./src/util');
var path = require('path');

module.exports = function(spec, dest, opts) {
    var d = Q.defer();
    var fetchArgs = ['install'];
    var opts = opts || {};

    if(!shell.which('npm')) {
        return Q.reject(new Error('"npm" command line tool is not installed: make sure it is accessible on your PATH.'));
    }

    if(spec) {
        fetchArgs.push(spec);
    }
    //d.resolve({spec});

    console.log(util.libDirectory)
    console.log(fetchArgs)

    //todo: REMOVE!
    //Directory should be passed in as a arg
    opts.cwd = util.libDirectory;
    console.log(opts)

    return superspawn.spawn('npm', fetchArgs, opts)


};

