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
    platforms         = require('../platforms/platforms'),
    promiseutil       = require('../util/promise-util'),
    superspawn        = require('./superspawn'),
    semver            = require('semver'),
    unorm             = require('unorm'),
    shell             = require('shelljs'),
    _                 = require('underscore'),
    PlatformJson      = require('../plugman/util/PlatformJson'),
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

    if (opts.usegit) {
        msg = '\nWARNING: The --usegit flag has been deprecated! \n' +
              'Instead, please use: `cordova platform add git-url#custom-branch`. \n' +
              'e.g: cordova platform add https://github.com/apache/cordova-android.git#2.4.0 \n';
        events.emit('warning', msg);
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
        return promiseutil.Q_chainmap(targets, function(target) {
            // For each platform, download it and call its helper script.
            var parts = target.split('@');
            var platform = parts[0];
            var spec = parts[1];

            return Q.when().then(function() {
                if (!(platform in platforms)) {
                    spec = platform;
                    platform = null;
                }

                if (platform && !spec && cmd == 'add') {
                    events.emit('verbose', 'No version supplied. Retrieving version from config.xml...');
                    spec = getVersionFromConfigFile(platform, cfg);
                }

                // If --save/autosave on && no version specified, use the pinned version
                // e.g: 'cordova platform add android --save', 'cordova platform update android --save'
                if( (opts.save || autosave) && !spec ){
                    spec = platforms[platform].version;
                }

                if (spec) {
                    var maybeDir = cordova_util.fixRelativePath(spec);
                    if (cordova_util.isDirectory(maybeDir)) {
                        return getPlatformDetailsFromDir(maybeDir, platform);
                    }
                }
                return downloadPlatform(projectRoot, platform, spec, opts);
            }).then(function(platDetails) {
                platform = platDetails.platform;
                var platformPath = path.join(projectRoot, 'platforms', platform);
                var platformAlreadyAdded = fs.existsSync(platformPath);

                return Q().then(function() {
                    if (cmd == 'add') {
                        if (platformAlreadyAdded) {
                            throw new CordovaError('Platform ' + platform + ' already added.');
                        }

                        // Remove the <platform>.json file from the plugins directory, so we start clean (otherwise we
                        // can get into trouble not installing plugins if someone deletes the platform folder but
                        // <platform>.json still exists).
                        removePlatformPluginsJson(projectRoot, target);

                        var template_dir = config_json && config_json.lib && config_json.lib[platform] && config_json.lib[platform].template || null;
                        events.emit('log', 'Adding ' + platform + ' project...');

                        return getCreateArgs(platDetails, projectRoot, cfg, template_dir, opts);
                    } else if (cmd == 'update') {
                        if (!platformAlreadyAdded) {
                            throw new CordovaError('Platform "' + platform + '" is not yet added. See `' +
                                cordova_util.binname + ' platform list`.');
                        }
                        events.emit('log', 'Updating ' + platform + ' project...');

                        // CB-6976 Windows Universal Apps. Special case to upgrade from windows8 to windows platform
                        if (platform == 'windows8' && !fs.existsSync(path.join(projectRoot, 'platforms', 'windows'))) {
                            var platformPathWindows = path.join(projectRoot, 'platforms', 'windows');
                            fs.renameSync(platformPath, platformPathWindows);
                            platform = 'windows';
                            platformPath = platformPathWindows;
                        }
                        // Call the platform's update script.
                        var args = [platformPath];
                        if (opts.link) {
                            args.push('--link');
                        }
                        return args;
                    }
                }).then(function(args) {
                    var bin = path.join(platDetails.libDir, 'bin', cmd == 'add' ? 'create' : 'update');
                    var copts = { stdio: 'inherit', chmod: true };
                    if ('spawnoutput' in opts) {
                        copts = { stdio: opts.spawnoutput };
                    }
                    return superspawn.spawn(bin, args, copts);
                }).then(function() {
                    platform_www = path.join(projectRoot, 'platforms', platform, 'platform_www');

                    // only want to copy cordova_js once, when the platform is added
                    if (!fs.existsSync(path.join(platform_www, 'cordova.js'))) {
                        copy_cordova_js(projectRoot, platform);
                    }

                    // only want to copy cordova-js-src once, when the platform is added
                    if (!fs.existsSync(path.join(platform_www, 'cordova-js-src'))) {
                        copy_cordovajs_src(projectRoot, platform, platDetails.libDir);
                    }
                }).then(function () {
                    // Call prepare for the current platform.
                    var prepOpts = {
                        platforms :[platform],
                        searchpath :opts.searchpath
                    };
                    return require('./cordova').raw.prepare(prepOpts);
                }).then(function() {
                    if (cmd == 'add') {
                        return installPluginsForNewPlatform(platform, projectRoot, opts);
                    }
                }).then(function() {
                    var saveVersion = !spec || semver.validRange(spec, true);

                    // Save platform@spec into platforms.json, where 'spec' is a version or a soure location. If a
                    // source location was specified, we always save that. Otherwise we save the version that was
                    // actually installed.
                    var versionToSave = saveVersion ? platDetails.version : spec;
                    events.emit('verbose', 'saving ' + platform + '@' + versionToSave + ' into platforms.json');
                    platformMetadata.save(projectRoot, platform, versionToSave);

                    if(opts.save || autosave){
                        // Similarly here, we save the source location if that was specified, otherwise the version that
                        // was installed. However, we save it with the "~" attribute (this allows for patch updates).
                        spec = saveVersion ? '~' + platDetails.version : spec;

                        // Save target into config.xml, overriding already existing settings
                        events.emit('log', '--save flag or autosave detected');
                        events.emit('log', 'Saving ' + platform + '@' + spec + ' into config.xml file ...');
                        cfg.removeEngine(platform);
                        cfg.addEngine(platform, spec);
                        cfg.write();
                    }
                });
            });
        });
    }).then(function() {
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
        if (cordova_util.isUrl(version)) {
            events.emit('log', 'git cloning: ' + version);
            var parts = version.split('#');
            var git_url = parts[0];
            var branchToCheckout = parts[1];
            return lazy_load.git_clone(git_url, branchToCheckout).fail(function(err) {
                // If it looks like a url, but cannot be cloned, try handling it differently.
                // it's because it's a tarball of the form:
                //     - wp8@https://git-wip-us.apache.org/repos/asf?p=cordova-wp8.git;a=snapshot;h=3.7.0;sf=tgz
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

function platformFromName(name) {
    var platMatch = /^cordova-([a-z0-9-]+)$/.exec(name);
    return platMatch && platMatch[1];
}

// Returns a Promise
// Gets platform details from a directory
function getPlatformDetailsFromDir(dir, platformIfKnown){
    var libDir = path.resolve(dir);
    var platform;
    var version;

    try {
        var pkg = require(path.join(libDir, 'package'));
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

    if (!version || !platform || !platforms[platform]) {
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
    if(!platform || ( !(platform in platforms) )){
        throw new CordovaError('Invalid platform: ' + platform);
    }

    // Get appropriate version from config.xml
    var engine = _.find(cfg.getEngines(), function(eng){
        return eng.name.toLowerCase() === platform.toLowerCase();
    });

    return engine && engine.spec;
}

function remove(hooksRunner, projectRoot, targets, opts) {
    if (!targets || !targets.length) {
        return Q.reject(new CordovaError('No platform[s] specified. Please specify platform[s] to remove. See `'+cordova_util.binname+' platform list`.'));
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
        if(opts.save || autosave){
            targets.forEach(function(target) {
                var platformName = target.split('@')[0];
                var xml = cordova_util.projectConfig(projectRoot);
                var cfg = new ConfigParser(xml);
                events.emit('log', 'Removing ' + target + ' from config.xml file ...');
                cfg.removeEngine(platformName);
                cfg.write();
        });
    }
    }).then(function() {
        // Remove targets from platforms.json
        targets.forEach(function(target) {
            events.emit('verbose', 'Removing ' + target + ' from platforms.json file ...');
            platformMetadata.remove(projectRoot, target);
        });
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

function list(hooksRunner, projectRoot) {
    var platforms_on_fs = cordova_util.listPlatforms(projectRoot);
    return hooksRunner.fire('before_platform_ls')
    .then(function() {
        // Acquire the version number of each platform we have installed, and output that too.
        return Q.all(platforms_on_fs.map(function(p) {
            return superspawn.maybeSpawn(path.join(projectRoot, 'platforms', p, 'cordova', 'version'), [], { chmod: true })
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
    // - https://github.com/apache/cordova-android.git
    if (targets) {
        if (!(targets instanceof Array)) targets = [targets];
        targets.forEach(function (t) {
            // Trim the @version part if it's there.
            var p = t.split('@')[0];
            // OK if it's one of known platform names.
            if (p in platforms) return;
            // Not a known platform name, check if its a real path.
            var pPath = path.resolve(t);
            if (fs.existsSync(pPath)) return;

            var msg;
        // If target looks like a url, we will try cloning it with git
            if (/[~:/\\.]/.test(t)) {
                return;
            } else {
        // Neither path, git-url nor platform name - throw.
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

    switch (command) {
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
        case 'save':
            return save(hooksRunner, projectRoot, opts);
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
function getCreateArgs(platDetails, projectRoot, cfg, template_dir, opts) {
    var output = path.join(projectRoot, 'platforms', platDetails.platform);

    var args = [];
    if (/android|ios/.exec(platDetails.platform) && semver.gt(platDetails.version, '3.3.0')) {
        args.push('--cli');
    }

    var pkg = cfg.packageName().replace(/[^\w.]/g,'_');
    // CB-6992 it is necessary to normalize characters
    // because node and shell scripts handles unicode symbols differently
    // We need to normalize the name to NFD form since iOS uses NFD unicode form
    var name = platDetails.platform == 'ios' ? unorm.nfd(cfg.name()) : cfg.name();
    args.push(output, pkg, name);

    var activityName = cfg.android_activityName();
    if (activityName && platDetails.platform === 'android' && semver.gte(platDetails.version, '4.0.0-dev')) {
        activityName = activityName.replace(/\W/g, '');
        args.push('--activity-name', activityName);
    }

    if (template_dir) {
        args.push(template_dir);
    }
    if (opts.link) {
        args.push('--link');
    }
    return args;
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

            var options = {
                searchpath: opts.searchpath
            };

            // Get plugin variables from fetch.json if have any and pass them as cli_variables to plugman
            var pluginMetadata = fetchMetadata.get_fetch_metadata(path.join(plugins_dir, plugin));
            var variables = pluginMetadata && pluginMetadata.variables;
            if (variables) {
                events.emit('verbose', 'Found variables for "' + plugin + '". Processing as cli_variables.');
                options.cli_variables = variables;
            }

            return plugman.raw.install(platform, output, plugin, plugins_dir, options);
        });
    }, Q());
}

// Copy the cordova.js file to platforms/<platform>/platform_www/
// The www dir is nuked on each prepare so we keep cordova.js in platform_www
function copy_cordova_js(projectRoot, platform) {
    var platformPath = path.join(projectRoot, 'platforms', platform);
    var parser = platforms.getPlatformProject(platform, platformPath);
    var platform_www = path.join(platformPath, 'platform_www');
    shell.mkdir('-p', platform_www);
    shell.cp('-f', path.join(parser.www_dir(), 'cordova.js'), path.join(platform_www, 'cordova.js'));
}

// Copy cordova-js-src directory into platform_www directory.
// We need these files to build cordova.js if using browserify method.
function copy_cordovajs_src(projectRoot, platform, platLib) {
    var platformPath = path.join(projectRoot, 'platforms', platform);
    var parser = platforms.getPlatformProject(platform, platformPath);
    var platform_www = path.join(platformPath, 'platform_www');
    var cordovaJsSrcPath = parser.cordovajs_src_path(platLib);
    //only exists for platforms that have shipped cordova-js-src directory
    if(fs.existsSync(cordovaJsSrcPath)) {
        shell.cp('-rf', cordovaJsSrcPath, platform_www);
    }
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
