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

/* 
 * A module that fetches npm modules and git urls
 *
 * @param {String} spec     the packageID or git url
 * @param {String} dest     destination of where to fetch the modules
 * @param {Object} opts     [opts={save:true}] options to pass to fetch module
 *
 * @return {boolean||Promise}   Returns true for a successful fetch or a rejected promise.
 *
 */
module.exports = function(spec, dest, opts) {
    var fetchArgs = ['install'];
    opts = opts || {};

    if(!shell.which('npm')) {
        return Q.reject(new Error('"npm" command line tool is not installed: make sure it is accessible on your PATH.'));
    }

    if(spec) {
        fetchArgs.push(spec);
    }

    //set the directory where npm install will be run
    opts.cwd = dest;

    //if user added --save flag, pass it to npm install command
    if(opts.save) {
        fetchArgs.push('--save'); 
        console.log('save');
    } 

    return superspawn.spawn('npm', fetchArgs, opts)
    .then(function(output) {
        events.emit('verbose', 'fetched ' + spec);
        return true;
    })
    .fail(function(err){
        return Q.reject(err);
    });
};

