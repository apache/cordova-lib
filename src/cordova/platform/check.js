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

var Q = require('q');
var path = require('path');
var os = require('os');
var semver = require('semver');
var shell = require('shelljs');
var events = require('cordova-common').events;
var superspawn = require('cordova-common').superspawn;
var cordova_util = require('../util');
var HooksRunner = require('../../hooks/HooksRunner');

module.exports = check;

function check (hooksRunner, projectRoot) {
    var platformsText = [];
    var platforms_on_fs = cordova_util.listPlatforms(projectRoot);
    var scratch = path.join(os.tmpdir(), 'cordova-platform-check-' + Date.now());
    var listeners = events._events;
    events._events = {};
    var result = Q.defer();
    var updateCordova = Q.defer();
    superspawn.spawn('npm',
        ['--loglevel=silent', '--json', 'outdated', 'cordova-lib'],
        {cwd: path.dirname(require.main.filename)}
    ).then(function (output) {
        var vers;
        try {
            var json = JSON.parse(output)['cordova-lib'];
            vers = [json.latest, json.current];
        } catch (e) {
            vers = ('' || output).match(/cordova-lib@(\S+)\s+\S+\s+current=(\S+)/);
        }
        if (vers) {
            updateCordova.resolve([vers[1], vers[2]]);
        } else {
            updateCordova.resolve();
        }
    }).catch(function () {
        /* oh well */
        updateCordova.resolve();
    });
    require('../cordova').create(scratch)
        .then(function () {
            var h = new HooksRunner(scratch);
            // Acquire the version number of each platform we have installed, and output that too.
            Q.all(platforms_on_fs.map(function (p) {
                var d = Q.defer();
                var d_avail = Q.defer();
                var d_cur = Q.defer();
                require('./index').add(h, scratch, [p], {spawnoutput: {stdio: 'ignore'}})
                    .then(function () {
                        // TODO: couldnt we return the promise on the next line, and then
                        // unindent all the promise handlers one level?
                        superspawn.maybeSpawn(path.join(scratch, 'platforms', p, 'cordova', 'version'), [], { chmod: true })
                            .then(function (avail) {
                                if (!avail) {
                                    /* Platform version script was silent, we can't work with this */
                                    d_avail.resolve('version-empty');
                                } else {
                                    d_avail.resolve(avail);
                                }
                            })
                            .catch(function () {
                                /* Platform version script failed, we can't work with this */
                                d_avail.resolve('version-failed');
                            });
                    }).catch(function () {
                        /* If a platform doesn't install, then we can't realistically suggest updating */
                        d_avail.resolve('install-failed');
                    });

                superspawn.maybeSpawn(path.join(projectRoot, 'platforms', p, 'cordova', 'version'), [], { chmod: true })
                    .then(function (v) {
                        d_cur.resolve(v || '');
                    }).catch(function () {
                        d_cur.resolve('broken');
                    });

                Q.all([d_avail.promise, d_cur.promise]).spread(function (avail, v) {
                    var m;
                    var prefix = p + ' @ ' + (v || 'unknown');
                    switch (avail) {
                    case 'install-failed':
                        m = prefix + '; current did not install, and thus its version cannot be determined';
                        break;
                    case 'version-failed':
                        m = prefix + '; current version script failed, and thus its version cannot be determined';
                        break;
                    case 'version-empty':
                        m = prefix + '; current version script failed to return a version, and thus its version cannot be determined';
                        break;
                    default:
                        if (!v || v === 'broken' || semver.gt(avail, v)) {
                            m = prefix + ' could be updated to: ' + avail;
                        }
                    }
                    if (m) {
                        platformsText.push(m);
                    }
                    d.resolve(m);
                }).catch(function () {
                    d.resolve(p + ' ?');
                }).done();

                return d.promise;
            })).then(function () {
                var results = '';
                var resultQ = Q.defer();
                events._events = listeners;
                shell.rm('-rf', scratch);
                updateCordova.promise.then(function (versions) {
                    var message = '';
                    if (versions && semver.gt(versions[0], versions[1])) {
                        message = 'An update of cordova is available: ' + versions[0] + '\n';
                    }
                    resultQ.promise.then(function (output) {
                        var results = message + output;
                        events.emit('results', results);
                        result.resolve();
                    });
                });
                if (platformsText) {
                    results = platformsText.filter(function (p) { return !!p; }).sort().join('\n');
                }
                if (!results) {
                    results = 'No platforms can be updated at this time.';
                }
                resultQ.resolve(results);
            }).done();
        }).catch(function () {
            events._events = listeners;
            shell.rm('-rf', scratch);
        }).done();
    return result.promise;
}
