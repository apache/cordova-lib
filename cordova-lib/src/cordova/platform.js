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

var config            = require('./config'),
    cordova           = require('./cordova'),
    cordova_util      = require('./util'),
    ConfigParser      = require('../configparser/ConfigParser'),
    fs                = require('fs'),
    os                = require('os'),
    path              = require('path'),
    HooksRunner       = require('../hooks/HooksRunner'),
    events            = require('../events'),
    lazy_load         = require('./lazy_load'),
    CordovaError      = require('../CordovaError'),
    Q                 = require('q'),
    platforms         = require('./platforms'),
    promiseutil       = require('../util/promise-util'),
    superspawn        = require('./superspawn'),
    semver            = require('semver'),
    unorm             = require('unorm'),
    shell             = require('shelljs');

// Expose the platform parsers on top of this command
for (var p in platforms) {
    module.exports[p] = platforms[p];
}

function add(hooksRunner, projectRoot, targets, opts) {
    var msg;
    if ( !targets || !targets.length ) {
        msg = 'No platform specified. Please specify a platform to add. ' +
              'See `' + cordova_util.binname + ' platform list`.';
        return Q.reject(new CordovaError(msg));
    }

    for (var i= 0 ; i < targets.length; i++) {
        if ( !hostSupports(targets[i]) ) {
            msg = 'WARNING: Applications for platform ' + targets[i] +
                  ' can not be built on this OS - ' + process.platform + '.';
            events.emit('log', msg);
        }
    }

    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);
    var config_json = config.read(projectRoot);
    var platformsDir = path.join(projectRoot, 'platforms');
    opts = opts || {};
    opts.searchpath = opts.searchpath || config_json.plugin_search_path;

    // The "platforms" dir is safe to delete, it's almost equivalent to
    // cordova platform rm <list of all platforms>
    if ( !fs.existsSync(platformsDir)) {
        shell.mkdir('-p', platformsDir);
    }

    return hooksRunner.fire('before_platform_add', opts)
    .then(function() {
        return promiseutil.Q_chainmap(targets, function (t) {
            // For each platform, download it and call its "create" script.
            var p;  // The promise to be returned by this function.
            var platform = t.split('@')[0];
            // If t is not a platform or platform@version, it must be a dir.
            // In this case get platform name from package.json in that dir and
            // skip lazy-load.
            if( !(platform in platforms) ) {
                var pPath = resolvePath(t);
                var pkg;
                // Prep the message in advance, we might need it in several places.
                msg = 'The provided path does not seem to contain a ' +
                      'Cordova platform: ' + t;
                try {
                    pkg = getPackageJsonContent(pPath);
                } catch(e) {
                    throw new CordovaError(msg + '\n' + e.message);
                }
                if ( !pkg || !pkg.name ) {
                    throw new CordovaError(msg);
                }
                // Package names for Cordova platforms look like "cordova-ios".
                var nameParts = pkg.name.split('-');
                var name = nameParts[1];
                if (name == 'amazon') {
                    name = 'amazon-fireos';
                }
                if( !platforms[name] ) {
                    throw new CordovaError(msg);
                }
                platform = name;

                // Use a fulfilled promise with the path as value to skip dloading.
                p = Q(pPath);
            } else {
                // Using lazy_load for a platform specified by name
                p = lazy_load.based_on_config(projectRoot, t, opts)
                .fail(function(err) {
                    throw new CordovaError('Unable to fetch platform ' + t + ': ' + err);
                });
            }

            return p
            .then(function(libDir) {
                var template = config_json && config_json.lib && config_json.lib[platform] && config_json.lib[platform].template || null;
                return call_into_create(platform, projectRoot, cfg, libDir, template, opts);
            });
        });
    })
    .then(function() {
        return hooksRunner.fire('after_platform_add', opts);
    });
}

function resolvePath(pPath){
    return path.resolve(pPath);
}

function getPackageJsonContent(pPath) {
    return require(path.join(pPath, 'package'));
}

function remove(hooksRunner, projectRoot, targets, opts) {
    if (!targets || !targets.length) {
        return Q.reject(new CordovaError('No platform[s] specified. Please specify platform[s] to remove. See `'+cordova_util.binname+' platform list`.'));
    }
    return hooksRunner.fire('before_platform_rm', opts)
    .then(function() {
        targets.forEach(function(target) {
            shell.rm('-rf', path.join(projectRoot, 'platforms', target));
            var plugins_json = path.join(projectRoot, 'plugins', target + '.json');
            if (fs.existsSync(plugins_json)) shell.rm(plugins_json);
        });
    }).then(function() {
        return hooksRunner.fire('after_platform_rm', opts);
    });
}

function update(hooksRunner, projectRoot, targets, opts) {
    // Shell out to the update script provided by the named platform.
    var msg;
    if ( !targets || !targets.length ) {
        msg = 'No platform specified. Please specify a platform to update. See `' +
              cordova_util.binname + ' platform list`.';
        return Q.reject(new CordovaError(msg));
    } else if (targets.length > 1) {
        msg = 'Platform update can only be executed on one platform at a time.';
        return Q.reject(new CordovaError(msg));
    }
    var plat = targets[0];
    var platformPath = path.join(projectRoot, 'platforms', plat);
    var installed_platforms = cordova_util.listPlatforms(projectRoot);
    if (installed_platforms.indexOf(plat) < 0) {
        msg = 'Platform "' + plat + '" is not installed. See `' +
              cordova_util.binname + ' platform list`.';
        return Q.reject(new CordovaError(msg));
    }
    // CB-6976 Windows Universal Apps. Special case to upgrade from windows8 to windows platform
    if (plat == 'windows8' && !fs.existsSync(path.join(projectRoot, 'platforms', 'windows'))) {
        var platformPathWindows = path.join(projectRoot, 'platforms', 'windows');
        fs.renameSync(platformPath, platformPathWindows);
        plat = 'windows';
        platformPath = platformPathWindows;
    }

    // First, lazy_load the latest version.
    return hooksRunner.fire('before_platform_update', opts)
    .then(function() {
        return lazy_load.based_on_config(projectRoot, plat, opts);
    })
    .then(function(libDir) {
        // Call the platform's update script.
        var script = path.join(libDir, 'bin', 'update');
        return superspawn.spawn(script, [platformPath], { stdio: 'inherit' });
    })
    .then(function() {
        // Copy the new cordova.js from www -> platform_www.
        copy_cordova_js(projectRoot, plat);
        // Leave it to the update script to log out "updated to v FOO".
    });
}

function check(hooksRunner, projectRoot) {
    var platformsText = [],
        platforms_on_fs = cordova_util.listPlatforms(projectRoot),
        scratch = path.join(os.tmpdir(), 'cordova-platform-check-' + Date.now()),
        listeners = events._events;
    events._events = {};
    var result = Q.defer();
    var updateCordova = Q.defer();
    superspawn.spawn('npm',
                     ['--loglevel=silent', '--json', 'outdated', 'cordova-lib'],
                     {cwd: path.dirname(require.main.filename)}
                    ).then(
        function (output) {
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
        }
    ).catch(function (){
        /* oh well */
        updateCordova.resolve();
    });
    cordova.raw.create(scratch)
    .then(function () {
        var h = new HooksRunner(scratch);
        // Acquire the version number of each platform we have installed, and output that too.
        Q.all(platforms_on_fs.map(function(p) {
            var d = Q.defer(),
                d_avail = Q.defer(),
                d_cur = Q.defer();
            add(h, scratch, [p], {spawnoutput: {stdio: 'ignore'}})
            .then(function() {
                superspawn.maybeSpawn(path.join(scratch, 'platforms', p, 'cordova', 'version'))
                .then(function(avail) {
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

            superspawn.maybeSpawn(path.join(projectRoot, 'platforms', p, 'cordova', 'version'))
            .then(function(v) {
                d_cur.resolve(v || '');
            }).catch(function () {
                d_cur.resolve('broken');
            });

            Q.all([d_avail.promise, d_cur.promise]).spread(function (avail, v) {
                var m, prefix = p + ' @ ' + (v || 'unknown');
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
            })
            .catch(function () {
                d.resolve(p + ' ?');
            })
            .done();

            return d.promise;
        })).then(function() {
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
        })
        .done();
    }).catch(function (){
        events._events = listeners;
        shell.rm('-rf', scratch);
    })
    .done();
    return result.promise;
}

function list(hooksRunner, projectRoot) {
    var platforms_on_fs = cordova_util.listPlatforms(projectRoot);
    return hooksRunner.fire('before_platform_ls')
    .then(function() {
        // Acquire the version number of each platform we have installed, and output that too.
        return Q.all(platforms_on_fs.map(function(p) {
            return superspawn.maybeSpawn(path.join(projectRoot, 'platforms', p, 'cordova', 'version'))
            .then(function(v) {
                if (!v) return p;
                return p + ' ' + v;
            }, function(v) {
                return p + ' broken';
            });
        }));
    }).then(function(platformsText) {
        var results = 'Installed platforms: ' + platformsText.sort().join(', ') + '\n';
        var available = Object.keys(platforms).filter(hostSupports);

        available = available.filter(function(p) {
            return platforms_on_fs.indexOf(p) < 0; // Only those not already installed.
        });
        results += 'Available platforms: ' + available.sort().join(', ');

        events.emit('results', results);
    }).then(function() {
        return hooksRunner.fire('after_platform_ls');
    });
}

// Returns a promise.
module.exports = platform;
function platform(command, targets, opts) {
    var projectRoot = cordova_util.cdProjectRoot();
    var msg;
    var hooksRunner = new HooksRunner(projectRoot);

    if (arguments.length === 0) command = 'ls';

    // Verify that targets look like platforms. Examples:
    // - android
    // - android@3.5.0
    // - ../path/to/dir/with/platform/files
    if (targets) {
        if (!(targets instanceof Array)) targets = [targets];
        targets.forEach(function(t) {
            // Trim the @version part if it's there.
            var p = t.split('@')[0];
            // OK if it's one of known platform names.
            if ( p in platforms ) return;
            // Not a known platform name, check if its a real path.
            var pPath = path.resolve(t);
            if (fs.existsSync(pPath)) return;
            // Neither path, nor platform name - throw.
            var msg;
            if (/[~:/\\.]/.test(t)) {
                msg = 'Platform path "' + t + '" not found.';
            } else {
                msg = 'Platform "' + t +
                '" not recognized as a core cordova platform. See `' +
                cordova_util.binname + ' platform list`.'
                ;
            }
            throw new CordovaError(msg);
        });
    } else if (command == 'add' || command == 'rm') {
        msg = 'You need to qualify `add` or `remove` with one or more platforms!';
        return Q.reject(new CordovaError(msg));
    }


    opts = opts || {};
    opts.platforms = targets;

    switch(command) {
        case 'add':
            // CB-6976 Windows Universal Apps. windows8 is now alias for windows
            var idxWindows8 = targets.indexOf('windows8');
            if (idxWindows8 >=0) {
                targets[idxWindows8] = 'windows';
            }
            return add(hooksRunner, projectRoot, targets, opts);
        case 'rm':
        case 'remove':
            return remove(hooksRunner, projectRoot, targets, opts);
        case 'update':
        case 'up':
            return update(hooksRunner, projectRoot, targets, opts);
        case 'check':
            return check(hooksRunner, projectRoot);
        default:
            return list(hooksRunner, projectRoot);
    }
}

// Used to prevent attempts of installing platforms that are not supported on
// the host OS. E.g. ios on linux.
function hostSupports(platform) {
    var p = platforms[platform] || {},
        hostos = p.hostos || null;
    if (!hostos)
        return true;
    if (hostos.indexOf('*') >= 0)
        return true;
    if (hostos.indexOf(process.platform) >= 0)
        return true;
    return false;
}

// Returns a promise.
function call_into_create(target, projectRoot, cfg, libDir, template_dir, opts) {
    var output = path.join(projectRoot, 'platforms', target);
    var msg;

    // Check if output directory already exists.
    if (fs.existsSync(output)) {
        msg = 'Platform ' + target + ' already added';
        return Q.reject(new CordovaError(msg));
    }

    events.emit('log', 'Creating ' + target + ' project...');
    var bin = path.join(libDir, 'bin', 'create');
    var args = [];
    var platformVersion;
    if (target == 'android') {
        platformVersion = fs.readFileSync(path.join(libDir, 'VERSION'), 'UTF-8').trim();
        if (semver.gt(platformVersion, '3.3.0')) {
            args.push('--cli');
        }
    } else if (target == 'ios') {
        platformVersion = fs.readFileSync(path.join(libDir, 'CordovaLib', 'VERSION'), 'UTF-8').trim();
        if (semver.gt(platformVersion, '3.3.0')) {
            args.push('--cli');
        }
    }

    var pkg = cfg.packageName().replace(/[^\w.]/g,'_');
    // CB-6992 it is necessary to normalize characters
    // because node and shell scripts handles unicode symbols differently
    // We need to normalize the name to NFD form since iOS uses NFD unicode form
    var name = target == 'ios' ? unorm.nfd(cfg.name()) : cfg.name();
    args.push(output, pkg, name);
    if (template_dir) {
        args.push(template_dir);
    }

    var copts = { stdio: 'inherit' };
    if ('spawnoutput' in opts) {
        copts = { stdio: opts.spawnoutput };
    }
    return superspawn.spawn(bin, args, copts)
    .then(function() {
        copy_cordova_js(projectRoot, target);
    })
    .then(function() {
        return require('./cordova').raw.prepare(target);
    })
    .then(function() {
        // Install all currently installed plugins into this new platform.
        var plugins_dir = path.join(projectRoot, 'plugins');
        var plugins = cordova_util.findPlugins(plugins_dir);
        if (!plugins) return Q();

        var plugman = require('../plugman/plugman');
        // Install them serially.
        return plugins.reduce(function(soFar, plugin) {
            return soFar.then(function() {
                events.emit('verbose', 'Installing plugin "' + plugin + '" following successful platform add of ' + target);
                plugin = path.basename(plugin);
                var options = (function(){
                    // Get plugin preferences from config features if have any
                    // Pass them as cli_variables to plugman
                    var feature = cfg.getFeature(plugin);
                    var variables = feature && feature.variables;
                    if (!!variables) {
                        events.emit('verbose', 'Found variables for "' + plugin + '". Processing as cli_variables.');
                        return {
                            cli_variables: variables
                        };
                    }
                    return {};
                })();
                options.searchpath = opts.searchpath;

                return plugman.raw.install(target, output, plugin, plugins_dir, options);
            });
        }, Q());
    });
}


// Copty the cordova.js file to platforms/<platform>/platform_www/
// The www dir is nuked on each prepare so we keep cordova.js in platform_www
function copy_cordova_js(projectRoot, platform) {
    var platformPath = path.join(projectRoot, 'platforms', platform);
    var parser = new platforms[platform].parser(platformPath);
    var platform_www = path.join(platformPath, 'platform_www');
    shell.mkdir('-p', platform_www);
    shell.cp('-f', path.join(parser.www_dir(), 'cordova.js'), path.join(platform_www, 'cordova.js'));
}

module.exports.add = add;
module.exports.remove = remove;
module.exports.update = update;
module.exports.check = check;
module.exports.list = list;
