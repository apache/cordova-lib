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

var  Q             = require('q'),
     shell         = require('shelljs'),
     events        = require('cordova-common').events,
     path          = require('path'),
     superspawn    = require('cordova-common').superspawn,
     os            = require('os');

exports.clone = clone;

//  clone_dir, if provided is the directory that git will clone into.
//  if no clone_dir is supplied, a temp directory will be created and used by git.
function clone(git_url, git_ref, clone_dir){

    var needsGitCheckout = false,
        cloneArgs        = ['clone'],
        checkRemoteRef   = Q.resolve(),
        tmp_dir          = clone_dir;

    git_ref = git_ref || 'master';

    if (!shell.which('git')) {
        return Q.reject(new Error('"git" command line tool is not installed: make sure it is accessible on your PATH.'));
    }

    // If no clone_dir is specified, create a tmp dir which git will clone into.
    if (!tmp_dir) {
        tmp_dir = path.join(os.tmpdir(), 'git', String((new Date()).valueOf()));
    }
    shell.rm('-rf', tmp_dir);
    shell.mkdir('-p', tmp_dir);

    // if git_ref is not 'master' check if it's a branch or tag so we can shallow clone.
    if (git_ref !== 'master') {
        var lsRemoteArgs = ['ls-remote', '--tags', '--heads', '--exit-code', git_url, git_ref];
        checkRemoteRef = superspawn.spawn('git', lsRemoteArgs);
    }

    return checkRemoteRef
    .then(function() {
        cloneArgs.push('--depth=1', '-b', git_ref);
    })
    .fail(function() {
        needsGitCheckout = true;
    })
    .then(function() { 
        cloneArgs.push(git_url, tmp_dir);
    })
    .then(function() {
        return superspawn.spawn('git', cloneArgs);
    })
    .then(function() {
        if (needsGitCheckout) {
            return superspawn.spawn('git', ['checkout', git_ref], {
                cwd: tmp_dir
            });
        }
    })
    .then(function() {
        return superspawn.spawn('git', ['rev-parse', '--short', 'HEAD'], {
            cwd: tmp_dir
        });
    })
    .then(function(sha) {
        events.emit('log', 'Repository "' + git_url + '" cloned from git ref "' + git_ref + '" (' + sha + ').');
        return tmp_dir;
    })
    .fail(function(err) {
        shell.rm('-rf', tmp_dir);
        return Q.reject(err);
    });
}
