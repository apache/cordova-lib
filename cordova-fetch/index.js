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
var depls = require('dependency-ls');
var path = require('path');
var fs = require('fs');

/* 
 * A module that npm installs a module from npm or a git url
 *
 * @param {String} spec     the packageID or git url
 * @param {String} dest     destination of where to install the module
 * @param {Object} opts     [opts={save:true}] options to pass to fetch module
 *
 * @return {String||Promise}    Returns string of the absolute path to the installed module.
 *
 */
module.exports = function(spec, dest, opts) {
    var fetchArgs = ['install'];
    opts = opts || {};
    var tree1;

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
        events.emit('verbose', 'saving');
        fetchArgs.push('--save'); 
    } 

    //Grab json object of installed modules before npm install
    return depls(dest)
    .then(function(depTree) {
        tree1 = depTree;
        //install new module
        return superspawn.spawn('npm', fetchArgs, opts);
    })
    .then(function(output) {
        //Grab object of installed modules after npm install
        return depls(dest);
    })
    .then(function(depTree2) {
        var tree2 = depTree2;
        var id = getJsonDiff(tree1, tree2); 

        return getPath(id, dest);
    }) 
    .fail(function(err){
        return Q.reject(err);
    });
};


/*
 * Takes two JSON objects and returns the key of the new property as a string
 *
 * @param {Object} obj1     json object representing installed modules before latest npm install
 * @param {Object} obj2     json object representing installed modules after latest npm install
 *
 * @return {String}         String containing the key value of the difference between the two objects
 *
 */
function getJsonDiff(obj1, obj2) {
    var result = '';

    //regex to filter out peer dependencies from result
    var re = /UNMET PEER DEPENDENCY/;

    for (var key in obj2) {
        //if it isn't a unmet peer dependency, continue
        if (key.search(re) === -1) {
            if(obj2[key] != obj1[key]) result = key;
        }
    }
    return result;
}

/* 
 * Takes the moduleID and destination and returns an absolute path to the module
 *
 * @param {String} id       the packageID or git url
 * @param {String} dest     destination of where to fetch the modules
 *
 * @return {String||Error}  Returns the absolute url for the module or throws a error
 *
 */

function getPath(id, dest) {
    var finalDest;
    if (path.basename(dest) !== 'node_modules') {
        //add node_modules to dest if it isn't already added
        finalDest = path.resolve(path.join(dest, 'node_modules', id));
    } else {
        //assume path already has node_modules
        finalDest = path.resolve(path.join(dest, id));
    }
    
    //Sanity check it exists
    if(fs.existsSync(finalDest)){
        return path.resolve(finalDest);
    } else return Q.reject('failed to get absolute path to installed module');

}
