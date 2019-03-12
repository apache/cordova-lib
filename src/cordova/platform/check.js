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

var fs = require('fs-extra');
var path = require('path');
var os = require('os');
var semver = require('semver');
var events = require('cordova-common').events;
var superspawn = require('cordova-common').superspawn;
var cordova_util = require('../util');
var HooksRunner = require('../../hooks/HooksRunner');

module.exports = check;

function check (hooksRunner, projectRoot) {
    return Promise.all([
        getCordovaUpdateMessage(), getPlatformUpdateMessages(projectRoot)
    ]).then(messages => {
        events.emit('results', messages.join('\n'));
    });
}

function getCordovaUpdateMessage () {
    return superspawn.spawn('npm',
        ['--loglevel=silent', '--json', 'outdated', 'cordova-lib'],
        { cwd: path.dirname(require.main.filename) }
    ).then(function (output) {
        var vers;
        try {
            var json = JSON.parse(output)['cordova-lib'];
            vers = [json.latest, json.current];
        } catch (e) {
            vers = ('' || output).match(/cordova-lib@(\S+)\s+\S+\s+current=(\S+)/);
        }
        if (vers) {
            return [vers[1], vers[2]];
        }
    }).catch(function () {
        /* oh well */
    }).then(function (versions) {
        var message = '';
        if (versions && semver.gt(versions[0], versions[1])) {
            message = 'An update of cordova is available: ' + versions[0];
        }
        return message;
    });
}

function getPlatformUpdateMessages (projectRoot) {
    var installedPlatforms = cordova_util.listPlatforms(projectRoot);
    var scratch = path.join(os.tmpdir(), 'cordova-platform-check-' + Date.now());
    var listeners = events._events;
    events._events = {};
    function cleanup () {
        events._events = listeners;
        fs.removeSync(scratch);
    }

    // Acquire the version number of each platform we have installed, and output that too.
    return require('../cordova').create(scratch)
        .then(function () {
            var h = new HooksRunner(scratch);
            return Promise.all(installedPlatforms.map(p =>
                getPlatformUpdateMessage(p, h, projectRoot, scratch)
            ));
        })
        .then(platformsText => {
            var platformResults = '';

            if (platformsText) {
                platformResults = platformsText.filter(p => p).sort().join('\n');
            }
            if (!platformResults) {
                platformResults = 'No platforms can be updated at this time.';
            }
            return platformResults;
        })
        // .finally(cleanup)
        .then(
            res => { cleanup(); return res; },
            err => { cleanup(); throw err; }
        );
}

function getPlatformUpdateMessage (platform, h, projectRoot, scratch) {
    const availableVersionPromise = require('.').add(h, scratch, [platform], { spawnoutput: { stdio: 'ignore' } })
        .then(function () {
            return getPlatformVersion(scratch, platform).then(
                avail => avail || 'version-empty',
                _ => 'version-failed'
            );
        }, function () {
            /* If a platform doesn't install, then we can't realistically suggest updating */
            return 'install-failed';
        });

    const currentVersionPromise = getPlatformVersion(projectRoot, platform)
        .then(
            v => v || '',
            _ => 'broken'
        );

    return Promise.all([availableVersionPromise, currentVersionPromise])
        .then(([avail, v]) => {
            var prefix = platform + ' @ ' + (v || 'unknown');
            switch (avail) {
            case 'install-failed':
                return prefix + '; current did not install, and thus its version cannot be determined';
            case 'version-failed':
                return prefix + '; current version script failed, and thus its version cannot be determined';
            case 'version-empty':
                return prefix + '; current version script failed to return a version, and thus its version cannot be determined';
            default:
                if (!v || v === 'broken' || semver.gt(avail, v)) {
                    return prefix + ' could be updated to: ' + avail;
                }
            }
        })
        .catch(function () {});
}

function getPlatformVersion (projectRoot, platform) {
    const bin = path.join(projectRoot, 'platforms', platform, 'cordova/version');
    return superspawn.maybeSpawn(bin, [], { chmod: true });
}
