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
var config            = require('./config'),
    cordova           = require('./cordova'),
    prepare           = require('./prepare'),
    cordova_util      = require('./util'),
    ConfigParser      = require('cordova-common').ConfigParser,
    fs                = require('fs'),
    os                = require('os'),
    path              = require('path'),
    HooksRunner       = require('../hooks/HooksRunner'),
    events            = require('cordova-common').events,
    lazy_load         = require('./lazy_load'),
    CordovaError      = require('cordova-common').CordovaError,
    Q                 = require('q'),
    platforms         = require('../platforms/platforms'),
    promiseutil       = require('../util/promise-util'),
    superspawn        = require('cordova-common').superspawn,
    semver            = require('semver'),
    shell             = require('shelljs'),
    _                 = require('underscore'),
    PlatformJson      = require('cordova-common').PlatformJson,
    fetch             = require('cordova-fetch'),
    npmUninstall      = require('cordova-fetch').uninstall,
    platformMetadata  = require('./platform_metadata');

// Expose the platform parsers on top of this command
for (var p in platforms) {
    module.exports[p] = platforms[p];
}

function update(hooksRunner, projectRoot, targets, opts) {
    return addHelper('update', hooksRunner, projectRoot, targets, opts);
}

function add(hooksRunner, projectRoot, targets, opts) {
    return addHelper('add', hooksRunner, projectRoot, targets, opts);
}

function addHelper(cmd, hooksRunner, projectRoot, targets, opts) {
    var msg;
    if ( !targets || !targets.length ) {
        msg = 'No platform specified. Please specify a platform to ' + cmd + '. ' +
              'See `' + cordova_util.binname + ' platform list`.';
        return Q.reject(new CordovaError(msg));
    }

    for (var i = 0 ; i < targets.length; i++) {
        if (!hostSupports(targets[i])) {
            msg = 'WARNING: Applications for platform ' + targets[i] +
                  ' can not be built on this OS - ' + process.platform + '.';
            events.emit('log', msg);
        }
    }

    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);
    var config_json = config.read(projectRoot);
    var autosave =  config_json.auto_save_platforms || false;
    opts = opts || {};
    opts.searchpath = opts.searchpath || config_json.plugin_search_path;

    // The "platforms" dir is safe to delete, it's almost equivalent to
    // cordova platform rm <list of all platforms>
    var platformsDir = path.join(projectRoot, 'platforms');
    shell.mkdir('-p', platformsDir);

    return hooksRunner.fire('before_platform_' + cmd, opts)
    .then(function() {
        var platformsToSave = [];

        return promiseutil.Q_chainmap(targets, function(target) {
            // For each platform, download it and call its helper script.
            var pkgJson;
            var platform;
            var spec;
            var parts = target.split('@');
            if (parts.length > 1 && parts[0] === '') {
                //scoped package
                platform = '@' + parts[1];
                spec = parts[2];
            } else {
                platform = parts[0];
                spec = parts[1];
            }
            return Q.when().then(function() {
                // if platform is a local path or url, it should be assigned
                // to spec
                if (cordova_util.isDirectory(path.resolve(platform)) || 
                    cordova_util.isUrl(platform)) {
                    spec = platform;
                    platform = null;
                }

                if(fs.existsSync(path.join(projectRoot,'package.json'))) {
                    pkgJson = cordova_util.requireNoCache(path.join(projectRoot, 'package.json'));
                }

                // If there is no spec specified, try to get spec from package.json
                // else, if there is no spec specified, try to get spec from config.xml
                if (spec === undefined && pkgJson && pkgJson.dependencies && cmd === 'add') {
                    if (pkgJson.dependencies['cordova-'+platform]) {
                        spec = pkgJson.dependencies['cordova-'+platform];
                    } else if (pkgJson.dependencies[platform]) {
                        spec = pkgJson.dependencies[platform];
                    }
                } else if (platform && spec === undefined && cmd === 'add') {
                    events.emit('verbose', 'No version supplied. Retrieving version from config.xml...');
                    spec = getVersionFromConfigFile(platform, cfg);
                }

                // If --save/autosave on && no version specified, use the pinned version
                // e.g: 'cordova platform add android --save', 'cordova platform update android --save'
                if( (opts.save || autosave) && !spec && platforms[platform]) {
                    spec = platforms[platform].version;
                }

                // Handle local paths
                if (spec) {
                    var maybeDir = cordova_util.fixRelativePath(spec);
                    if (cordova_util.isDirectory(maybeDir)) {
                        if (opts.fetch) {
                            return fetch(path.resolve(maybeDir), projectRoot, opts)
                            .then(function (directory) {
                                return getPlatformDetailsFromDir(directory, platform);
                            });
                        } else {
                            return getPlatformDetailsFromDir(maybeDir, platform);
                        }
                    }
                }
                return downloadPlatform(projectRoot, platform, spec, opts);
            }).then(function(platDetails) {
                platform = platDetails.platform;
                var platformPath = path.join(projectRoot, 'platforms', platform);
                var platformAlreadyAdded = fs.existsSync(platformPath);

                if (cmd == 'add') {
                    if (platformAlreadyAdded) {
                        throw new CordovaError('Platform ' + platform + ' already added.');
                    }

                    // Remove the <platform>.json file from the plugins directory, so we start clean (otherwise we
                    // can get into trouble not installing plugins if someone deletes the platform folder but
                    // <platform>.json still exists).
                    removePlatformPluginsJson(projectRoot, target);
                } else if (cmd == 'update') {
                    if (!platformAlreadyAdded) {
                        throw new CordovaError('Platform "' + platform + '" is not yet added. See `' +
                            cordova_util.binname + ' platform list`.');
                    }
                }

                if (/-nightly|-dev$/.exec(platDetails.version)) {
                    msg = 'Warning: using prerelease platform ' + platform +
                          '@' + platDetails.version +
                          '.\nUse \'cordova platform add ' +
                          platform + '@latest\' to add the latest published version instead.';
                    events.emit('warn', msg);
                }

                var options = {
                    // We need to pass a platformDetails into update/create
                    // since PlatformApiPoly needs to know something about
                    // platform, it is going to create.
                    platformDetails: platDetails,
                    link: opts.link
                };

                if (config_json && config_json.lib && config_json.lib[platform] &&
                    config_json.lib[platform].template) {
                    options.customTemplate = config_json.lib[platform].template;
                }

                events.emit('log', (cmd === 'add' ? 'Adding ' : 'Updating ') + platform + ' project...');
                var PlatformApi;
                try {
                    // Try to get PlatformApi class from platform
                    // Get an entry point for platform package
                    var apiEntryPoint = require.resolve(platDetails.libDir);
                    // Validate entry point filename. This is required since most of platforms
                    // defines 'main' entry in package.json pointing to bin/create which is
                    // basically a valid NodeJS script but intended to be used as a regular
                    // executable script.
                    if (path.basename(apiEntryPoint) === 'Api.js') {
                        PlatformApi = cordova_util.requireNoCache(apiEntryPoint);
                        events.emit('verbose', 'PlatformApi successfully found for platform ' + platform);
                    }
                } catch (e) {
                } finally {
                    if (!PlatformApi) {
                        events.emit('verbose', 'Failed to require PlatformApi instance for platform "' + platform +
                            '". Using polyfill instead.');
                        PlatformApi = require('../platforms/PlatformApiPoly');
                    }
                }
                var destination = path.resolve(projectRoot, 'platforms', platform);
                var promise = cmd === 'add' ?
                    PlatformApi.createPlatform.bind(null, destination, cfg, options, events) :
                    PlatformApi.updatePlatform.bind(null, destination, options, events);
                return promise()
                .then(function () {
                    if (!opts.restoring) {
                        return prepare.preparePlatforms([platform], projectRoot, { searchpath: opts.searchpath });
                    }
                })
                .then(function() {
                    if (cmd == 'add') {
                        return installPluginsForNewPlatform(platform, projectRoot, opts);
                    }
                })
                .then(function () {
                    if (!opts.restoring) {
                        // Call prepare for the current platform if we're not restoring from config.xml.
                        var prepOpts = {
                            platforms :[platform],
                            searchpath :opts.searchpath,
                            fetch: opts.fetch || false,
                            save: opts.save || false
                        };
                        return require('./cordova').raw.prepare(prepOpts);
                    }
                })
                .then(function() {

                    var saveVersion = !spec || semver.validRange(spec, true);

                    // Save platform@spec into platforms.json, where 'spec' is a version or a soure location. If a
                    // source location was specified, we always save that. Otherwise we save the version that was
                    // actually installed.
                    var versionToSave = saveVersion ? platDetails.version : spec;
                    events.emit('verbose', 'Saving ' + platform + '@' + versionToSave + ' into platforms.json');
                    platformMetadata.save(projectRoot, platform, versionToSave);

                    if(opts.save || autosave){
                        // Similarly here, we save the source location if that was specified, otherwise the version that
                        // was installed. However, we save it with the "~" attribute (this allows for patch updates).

                        spec = saveVersion ? '~' + platDetails.version : spec;

                        // Save target into config.xml, overriding already existing settings.
                        events.emit('log', '--save flag or autosave detected');
                        events.emit('log', 'Saving ' + platform + '@' + spec + ' into config.xml file ...');
                        cfg.removeEngine(platform);
                        cfg.addEngine(platform, spec);
                        cfg.write();

                        // Save to add to pacakge.json's cordova.platforms array in the next then.
                        platformsToSave.push(platform);
                    }
                });
            });
        }).then(function() {
            var pkgJson;
            var pkgJsonPath = path.join(projectRoot, 'package.json');
            var modifiedPkgJson = false;
            
            if(fs.existsSync(pkgJsonPath)) {
                pkgJson = cordova_util.requireNoCache(path.join(pkgJsonPath)); 
            }

            if (pkgJson === undefined) {
                return;
            }
            if (pkgJson.cordova === undefined) {
                pkgJson.cordova = {};
            }
            if (pkgJson.cordova.platforms === undefined && platformsToSave.length) {
                pkgJson.cordova.platforms = platformsToSave;
                modifiedPkgJson = true;
            } else {
                platformsToSave.forEach(function(plat){
                    if(pkgJson.cordova.platforms.indexOf(plat) === -1) {
                        events.emit('verbose','adding '+plat+' to cordova.platforms array in package.json');
                        pkgJson.cordova.platforms.push(plat);
                        modifiedPkgJson = true;
                    }
                });
            }
            // Save to package.json.
            if (modifiedPkgJson === true) {
                pkgJson.cordova.platforms = pkgJson.cordova.platforms.sort();
                fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
            }
        });
    }).then(function(){
        return hooksRunner.fire('after_platform_' + cmd, opts);
    });
}

function save(hooksRunner, projectRoot, opts) {
    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);

    // First, remove all platforms that are already in config.xml
    cfg.getEngines().forEach(function(engine){
        cfg.removeEngine(engine.name);
    });

    // Save installed platforms into config.xml
    return platformMetadata.getPlatformVersions(projectRoot).then(function(platformVersions){
        platformVersions.forEach(function(platVer){
            cfg.addEngine(platVer.platform, getSpecString(platVer.version));
        });
        cfg.write();
    });
}

function getSpecString(spec) {
    var validVersion = semver.valid(spec, true);
    return validVersion ? '~' + validVersion : spec;

}

// Downloads via npm or via git clone (tries both)
// Returns a Promise
function downloadPlatform(projectRoot, platform, version, opts) {
    var target = version ? (platform + '@' + version) : platform;
    return Q().then(function() {
        if (opts.fetch) {
            //append cordova to platform
            if(platform in platforms) {
                target = 'cordova-'+target;
            }

            //gitURLs don't supply a platform, it equals null
            if(!platform) {
                target = version;
            }
            events.emit('log', 'Using cordova-fetch for '+ target);
            return fetch(target, projectRoot, opts);
        }

        if (cordova_util.isUrl(version)) {
            events.emit('log', 'git cloning: ' + version);
            var parts = version.split('#');
            var git_url = parts[0];
            var branchToCheckout = parts[1];
            return lazy_load.git_clone(git_url, branchToCheckout).fail(function(err) {
                // If it looks like a url, but cannot be cloned, try handling it differently.
                // it's because it's a tarball of the form:
                //     - https://api.github.com/repos/msopenTech/cordova-browser/tarball/my-branch
                events.emit('verbose', err.message);
                events.emit('verbose', 'Cloning failed. Let\'s try handling it as a tarball');
                return lazy_load.based_on_config(projectRoot, target, opts);
            });
        }
        return lazy_load.based_on_config(projectRoot, target, opts);
    }).fail(function (error) {
        var message = 'Failed to fetch platform ' + target +
            '\nProbably this is either a connection problem, or platform spec is incorrect.' +
            '\nCheck your connection and platform name/version/URL.' +
            '\n' + error;
        return Q.reject(new CordovaError(message));
    }).then(function(libDir) {
        return getPlatformDetailsFromDir(libDir, platform);
    });
}

/**
 * Removes the cordova- prefix from the platform's name for known platforms.
 * @param {string} name - platform name
 * @returns {string} 
 */
function platformFromName(name) {
    var platName = name;
    var platMatch = /^cordova-([a-z0-9-]+)$/.exec(name);
    if(platMatch && (platMatch[1] in platforms)) {
        platName = platMatch[1];
        events.emit('verbose', 'Removing "cordova-" prefix from ' + name);
    }
    return platName; 
}

// Returns a Promise
// Gets platform details from a directory
function getPlatformDetailsFromDir(dir, platformIfKnown){
    var libDir = path.resolve(dir);
    var platform;
    var version;

    try {
        var pkgPath = path.join(libDir, 'package.json');
        var pkg = cordova_util.requireNoCache(pkgPath);
        platform = platformFromName(pkg.name);
        version = pkg.version;
    } catch(e) {
        // Older platforms didn't have package.json.
        platform = platformIfKnown || platformFromName(path.basename(dir));
        var verFile = fs.existsSync(path.join(libDir, 'VERSION')) ? path.join(libDir, 'VERSION') : 
                      fs.existsSync(path.join(libDir, 'CordovaLib', 'VERSION')) ? path.join(libDir, 'CordovaLib', 'VERSION') : null;
        if (verFile) {
            version = fs.readFileSync(verFile, 'UTF-8').trim();
        }
    }
    
    // platform does NOT have to exist in 'platforms', but it should have a name, and a version
    if (!version || !platform) {
        return Q.reject(new CordovaError('The provided path does not seem to contain a ' +
            'Cordova platform: ' + libDir));
    }

    return Q({
        libDir: libDir,
        platform: platform,
        version: version
    });
}

function getVersionFromConfigFile(platform, cfg) {
    // Get appropriate version from config.xml
    var engine = _.find(cfg.getEngines(), function(eng){
        return eng.name.toLowerCase() === platform.toLowerCase();
    });

    return engine && engine.spec;
}

function remove(hooksRunner, projectRoot, targets, opts) {
    if (!targets || !targets.length) {
        return Q.reject(new CordovaError('No platform(s) specified. Please specify platform(s) to remove. See `'+cordova_util.binname+' platform list`.'));
    }
    return hooksRunner.fire('before_platform_rm', opts)
    .then(function() {
        targets.forEach(function(target) {
            shell.rm('-rf', path.join(projectRoot, 'platforms', target));
            removePlatformPluginsJson(projectRoot, target);
        });
    }).then(function() {
        var config_json = config.read(projectRoot);
        var autosave =  config_json.auto_save_platforms || false;
        var modifiedPkgJson = false;
        var pkgJson;
        var pkgJsonPath = path.join(projectRoot,'package.json');
        // If statement to see if pkgJsonPath exists in the filesystem
        if(fs.existsSync(pkgJsonPath)) {
            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
        }
        if(opts.save || autosave){
            targets.forEach(function(target) {
                var platformName = target.split('@')[0];
                var xml = cordova_util.projectConfig(projectRoot);
                var cfg = new ConfigParser(xml);
                events.emit('log', 'Removing platform ' + target + ' from config.xml file...');
                cfg.removeEngine(platformName);
                cfg.write();
                // If package.json exists and contains a specified platform in cordova.platforms, it will be removed.
                if(pkgJson !== undefined && pkgJson.cordova !== undefined && pkgJson.cordova.platforms !== undefined) {
                    var index = pkgJson.cordova.platforms.indexOf(platformName);
                    // Check if platform exists in platforms array.
                    if (pkgJson.cordova.platforms !== undefined && index > -1) {
                        events.emit('log', 'Removing ' + platformName + ' from cordova.platforms array in package.json');
                        pkgJson.cordova.platforms.splice(index, 1);
                        modifiedPkgJson = true;
                    }
                }
            });
            //Write out new package.json if changes have been made.
            if(modifiedPkgJson === true) {
                fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 4), 'utf8');
            }
        }
    }).then(function() {
        // Remove targets from platforms.json.
        targets.forEach(function(target) {
            events.emit('verbose', 'Removing platform ' + target + ' from platforms.json file...');
            platformMetadata.remove(projectRoot, target);
        });
    }).then(function() {
        // Remove from node_modules if it exists and --fetch was used.
        if(opts.fetch) {
            return promiseutil.Q_chainmap(targets, function(target) {
                if(target in platforms) {
                    target = 'cordova-'+target;
                }
                // Edits package.json.
                return npmUninstall(target, projectRoot, opts);
            });
        }
    }).then(function() {
        return hooksRunner.fire('after_platform_rm', opts);
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
                superspawn.maybeSpawn(path.join(scratch, 'platforms', p, 'cordova', 'version'), [], { chmod: true })
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

            superspawn.maybeSpawn(path.join(projectRoot, 'platforms', p, 'cordova', 'version'), [], { chmod: true })
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

function list(hooksRunner, projectRoot, opts) {
    return hooksRunner.fire('before_platform_ls', opts)
    .then(function() {
        return cordova_util.getInstalledPlatformsWithVersions(projectRoot);
    }).then(function(platformMap) {
        var platformsText = [];
        for (var plat in platformMap) {
            platformsText.push(platformMap[plat] ? plat + ' ' + platformMap[plat] : plat);
        }

        platformsText = addDeprecatedInformationToPlatforms(platformsText);
        var results = 'Installed platforms:\n  ' + platformsText.sort().join('\n  ') + '\n';
        var available = Object.keys(platforms).filter(hostSupports);

        available = available.filter(function(p) {
            return !platformMap[p]; // Only those not already installed.
        });

        available = available.map(function (p){
            return p.concat(' ', platforms[p].version);
        });

        available = addDeprecatedInformationToPlatforms(available);
        results += 'Available platforms: \n  ' + available.sort().join('\n  ');

        events.emit('results', results);
    }).then(function() {
        return hooksRunner.fire('after_platform_ls', opts);
    });
}

function addDeprecatedInformationToPlatforms(platformsList){
    platformsList = platformsList.map(function(p){
        var platformKey = p.split(' ')[0]; //Remove Version Information
        // allow for 'unknown' platforms, which will not exist in platforms
        if(platforms[platformKey] && platforms[platformKey].deprecated){
            p = p.concat(' ', '(deprecated)');
        }
        return p;
    });
    return platformsList;
}

/**
 * Handles all cordova platform commands. 

 * @param {string} command - Command to execute (add, rm, ls, update, save)
 * @param {Object[]} targets - Array containing platforms to execute commands on
 * @param {Object} opts
 * @returns {Promise} 
 */
module.exports = platform;
function platform(command, targets, opts) {
    // CB-10519 wrap function code into promise so throwing error
    // would result in promise rejection instead of uncaught exception
    return Q().then(function() {
        var msg;
        var projectRoot = cordova_util.cdProjectRoot();
        var hooksRunner = new HooksRunner(projectRoot);

        if (arguments.length === 0) command = 'ls';

        if (targets && !(targets instanceof Array)) targets = [targets];

        if (!targets && (command == 'add' || command == 'rm')) {
            msg = 'You need to qualify `add` or `remove` with one or more platforms!';
            return Q.reject(new CordovaError(msg));
        }

        opts = opts || {};
        opts.platforms = targets;

        switch (command) {
            case 'add':
                return add(hooksRunner, projectRoot, targets, opts);
            case 'rm':
            case 'remove':
                return remove(hooksRunner, projectRoot, targets, opts);
            case 'update':
            case 'up':
                return update(hooksRunner, projectRoot, targets, opts);
            case 'check':
                return check(hooksRunner, projectRoot);
            case 'save':
                return save(hooksRunner, projectRoot, opts);
            default:
                return list(hooksRunner, projectRoot, opts);
        }
    });
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

function installPluginsForNewPlatform(platform, projectRoot, opts) {
    // Install all currently installed plugins into this new platform.
    var plugins_dir = path.join(projectRoot, 'plugins');

    // Get a list of all currently installed plugins, ignoring those that have already been installed for this platform
    // during prepare (installed from config.xml).
    var platformJson = PlatformJson.load(plugins_dir, platform);
    var plugins = cordova_util.findPlugins(plugins_dir).filter(function (plugin) {
        return !platformJson.isPluginInstalled(plugin);
    });
    if (plugins.length === 0) {
        return Q();
    }

    var output = path.join(projectRoot, 'platforms', platform);
    var plugman = require('../plugman/plugman');
    var fetchMetadata = require('../plugman/util/metadata');

    // Install them serially.
    return plugins.reduce(function (soFar, plugin) {
        return soFar.then(function () {
            events.emit('verbose', 'Installing plugin "' + plugin + '" following successful platform add of ' + platform);
            plugin = path.basename(plugin);

            // Get plugin variables from fetch.json if have any and pass them as cli_variables to plugman
            var pluginMetadata = fetchMetadata.get_fetch_metadata(path.join(plugins_dir, plugin));

            var options = {
                searchpath: opts.searchpath,
                // Set up platform to install asset files/js modules to <platform>/platform_www dir
                // instead of <platform>/www. This is required since on each prepare platform's www dir is changed
                // and files from 'platform_www' merged into 'www'. Thus we need to persist these
                // files platform_www directory, so they'll be applied to www on each prepare.

                // NOTE: there is another code path for plugin installation (see CB-10274 and the
                // related PR: https://github.com/apache/cordova-lib/pull/360) so we need to
                // specify the option below in both places
                usePlatformWww: true,
                is_top_level: pluginMetadata.is_top_level,
                force: opts.force,
                fetch: opts.fetch || false,
                save: opts.save || false
            };

            var variables = pluginMetadata && pluginMetadata.variables;
            if (variables) {
                events.emit('verbose', 'Found variables for "' + plugin + '". Processing as cli_variables.');
                options.cli_variables = variables;
            }
            return plugman.raw.install(platform, output, plugin, plugins_dir, options);
        });
    }, Q());
}

// Remove <platform>.json file from plugins directory.
function removePlatformPluginsJson(projectRoot, target) {
    var plugins_json = path.join(projectRoot, 'plugins', target + '.json');
    shell.rm('-f', plugins_json);
}

module.exports.add = add;
module.exports.remove = remove;
module.exports.update = update;
module.exports.check = check;
module.exports.list = list;
