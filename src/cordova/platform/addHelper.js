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

const path = require('path');
const fs = require('fs-extra');
const semver = require('semver');
const fetch = require('cordova-fetch');
const CordovaError = require('cordova-common').CordovaError;
const ConfigParser = require('cordova-common').ConfigParser;
const PlatformJson = require('cordova-common').PlatformJson;
const events = require('cordova-common').events;
const cordova_util = require('../util');
const promiseutil = require('../../util/promise-util');
const platforms = require('../../platforms');
const detectIndent = require('detect-indent');
const getPlatformDetailsFromDir = require('./getPlatformDetailsFromDir');
const preparePlatforms = require('../prepare/platforms');

module.exports = addHelper;
module.exports.getVersionFromConfigFile = getVersionFromConfigFile;
module.exports.downloadPlatform = downloadPlatform;
module.exports.installPluginsForNewPlatform = installPluginsForNewPlatform;

function addHelper (cmd, hooksRunner, projectRoot, targets, opts) {
    let msg;
    if (!targets || !targets.length) {
        msg = 'No platform specified. Please specify a platform to ' + cmd + '. ' +
              'See `' + cordova_util.binname + ' platform list`.';
        return Promise.reject(new CordovaError(msg));
    }

    for (let i = 0; i < targets.length; i++) {
        if (!platforms.hostSupports(targets[i])) {
            msg = 'WARNING: Applications for platform ' + targets[i] +
                  ' can not be built on this OS - ' + process.platform + '.';
            events.emit('warning', msg);
        }
    }

    const xml = cordova_util.projectConfig(projectRoot);
    const cfg = new ConfigParser(xml);
    opts = opts || {};

    // The "platforms" dir is safe to delete, it's almost equivalent to
    // cordova platform rm <list of all platforms>
    const platformsDir = path.join(projectRoot, 'platforms');
    fs.ensureDirSync(platformsDir);

    return hooksRunner.fire('before_platform_' + cmd, opts)
        .then(function () {
            const platformsToSave = [];

            return promiseutil.Q_chainmap(targets, function (target) {
                // For each platform, download it and call its helper script.
                let platform;
                let spec;
                const parts = target.split('@');
                if (parts.length > 1 && parts[0] === '') {
                    // scoped package
                    platform = '@' + parts[1];
                    spec = parts[2];
                } else {
                    platform = parts[0];
                    spec = parts[1];
                }
                return Promise.resolve().then(function () {
                    // if platform is a local path or url, it should be assigned
                    // to spec
                    if (cordova_util.isDirectory(path.resolve(platform)) ||
                        cordova_util.isUrl(platform)) {
                        spec = platform;
                        platform = null;
                    }

                    // If there is no spec specified, try to get spec from package.json
                    if (spec === undefined && cmd === 'add') {
                        const pkgJson = readPackageJsonIfExists(projectRoot);
                        spec = getVersionFromPackageJson(platform, pkgJson);
                    }

                    // if we still have no spec, try to get it from config.xml
                    if (platform && spec === undefined && cmd === 'add') {
                        events.emit('verbose', 'No version supplied. Retrieving version from config.xml...');
                        spec = module.exports.getVersionFromConfigFile(platform, cfg);
                    }

                    // If spec still doesn't exist, try to use pinned version
                    if (!spec && platforms.info[platform]) {
                        events.emit('verbose', 'Grabbing pinned version.');
                        spec = platforms.info[platform].version;
                    }

                    // Handle local paths
                    if (spec) {
                        const maybeDir = cordova_util.fixRelativePath(spec);
                        if (cordova_util.isDirectory(maybeDir)) {
                            return fetch(path.resolve(maybeDir), projectRoot, opts)
                                .then(function (directory) {
                                    return getPlatformDetailsFromDir(directory, platform);
                                });
                        }
                    }
                    return module.exports.downloadPlatform(projectRoot, platform, spec, opts);
                }).then(function (platDetails) {
                    platform = platDetails.platform;
                    const platformPath = path.join(projectRoot, 'platforms', platform);
                    const platformAlreadyAdded = fs.existsSync(platformPath);

                    if (cmd === 'add') {
                        // TODO: Can we check for this before downloading the platform?
                        if (platformAlreadyAdded) {
                            throw new CordovaError('Platform ' + platform + ' already added.');
                        }

                        // Remove the <platform>.json file from the plugins directory, so we start clean (otherwise we
                        // can get into trouble not installing plugins if someone deletes the platform folder but
                        // <platform>.json still exists).
                        cordova_util.removePlatformPluginsJson(projectRoot, target);
                    } else if (cmd === 'update') {
                        // TODO: can we check for this before downloading the platform?
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

                    // TODO: NIT: can we rename this to platformapi options so as to not confuse with addHelper options?
                    const options = {
                        // We need to pass a platformDetails into update/create
                        // since PlatformApiPoly needs to know something about
                        // platform, it is going to create.
                        platformDetails: platDetails,
                        link: opts.link
                    };

                    events.emit('log', (cmd === 'add' ? 'Adding ' : 'Updating ') + platform + ' project...');
                    const PlatformApi = cordova_util.getPlatformApiFunction(platDetails.libDir, platform);
                    const destination = path.resolve(projectRoot, 'platforms', platform);
                    const promise = cmd === 'add'
                        ? PlatformApi.createPlatform.bind(null, destination, cfg, options, events)
                        : PlatformApi.updatePlatform.bind(null, destination, options, events);
                    // TODO: if we return the promise immediately, can we not unindent the promise .then()s by one indent?
                    return promise()
                        .then(function () {
                            if (!opts.restoring) {
                                return preparePlatforms([platform], projectRoot, { searchpath: opts.searchpath });
                            }
                        })
                        .then(function () {
                            if (cmd === 'add') {
                                return module.exports.installPluginsForNewPlatform(platform, projectRoot, opts);
                            }
                        })
                        .then(function () {
                            // TODO: didnt we just do this two promise then's ago?
                            if (!opts.restoring) {
                                // Call prepare for the current platform if we're not restoring from config.xml.
                                const prepOpts = {
                                    platforms: [platform],
                                    searchpath: opts.searchpath,
                                    save: opts.save || false
                                };
                                // delete require.cache[require.resolve('../cordova')]
                                return require('../prepare')(prepOpts);
                            }
                        })
                        .then(function () {
                            const saveVersion = !spec || semver.validRange(spec, true);
                            // Save platform@spec into platforms.json, where 'spec' is a version or a soure location. If a
                            // source location was specified, we always save that. Otherwise we save the version that was
                            // actually installed.
                            const versionToSave = saveVersion ? platDetails.version : spec;
                            events.emit('verbose', 'Saving ' + platform + '@' + versionToSave + ' into platforms.json');

                            if (opts.save) {
                                // Similarly here, we save the source location if that was specified, otherwise the version that
                                // was installed. However, we save it with the "~" attribute (this allows for patch updates).
                                spec = saveVersion ? '~' + platDetails.version : spec;

                                // Save to add to pacakge.json's cordova.platforms array in the next then.
                                platformsToSave.push(platform);
                            }
                        });
                });
            }).then(function () {
                // save installed platforms to cordova.platforms array in package.json
                let pkgJson;
                const pkgJsonPath = path.join(projectRoot, 'package.json');
                let modifiedPkgJson = false;

                if (fs.existsSync(pkgJsonPath)) {
                    pkgJson = cordova_util.requireNoCache(path.join(pkgJsonPath));
                }

                if (pkgJson === undefined) {
                    return;
                }
                if (pkgJson.cordova === undefined) {
                    pkgJson.cordova = {};
                }
                if (pkgJson.cordova.platforms === undefined) {
                    pkgJson.cordova.platforms = [];
                }
                platformsToSave.forEach(function (plat) {
                    if (pkgJson.cordova.platforms.indexOf(plat) === -1) {
                        events.emit('verbose', 'adding ' + plat + ' to cordova.platforms array in package.json');
                        pkgJson.cordova.platforms.push(plat);
                        modifiedPkgJson = true;
                    }
                });
                // Save to package.json.
                if (modifiedPkgJson === true) {
                    const file = fs.readFileSync(pkgJsonPath, 'utf8');
                    const indent = detectIndent(file).indent || '  ';
                    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent), 'utf8');
                }
            });
        }).then(function () {
            return hooksRunner.fire('after_platform_' + cmd, opts);
        });
}

function readPackageJsonIfExists (packageDir) {
    const pkgJsonPath = path.join(packageDir, 'package.json');
    return fs.existsSync(pkgJsonPath)
        ? cordova_util.requireNoCache(pkgJsonPath)
        : undefined;
}

function getVersionFromPackageJson (platform, { dependencies, devDependencies } = {}) {
    const deps = { ...dependencies, ...devDependencies };
    return deps[`cordova-${platform}`] || deps[platform];
}

function getVersionFromConfigFile (platform, cfg) {
    // Get appropriate version from config.xml
    const engine = cfg.getEngines().find(eng => {
        return eng.name.toLowerCase() === platform.toLowerCase();
    });

    return engine && engine.spec;
}

// Downloads via npm or via git clone (tries both)
// Returns a Promise
function downloadPlatform (projectRoot, platform, version, opts) {
    let target = version ? (platform + '@' + version) : platform;
    return Promise.resolve().then(function () {
        // append cordova to platform
        if (platform in platforms.info) {
            target = 'cordova-' + target;
        }

        // gitURLs don't supply a platform, it equals null
        if (!platform) {
            target = version;
        }
        events.emit('log', 'Using cordova-fetch for ' + target);
        return fetch(target, projectRoot, opts);
    }).catch(function (error) {
        const message = 'Failed to fetch platform ' + target +
            '\nProbably this is either a connection problem, or platform spec is incorrect.' +
            '\nCheck your connection and platform name/version/URL.' +
            '\n' + error;
        return Promise.reject(new CordovaError(message));
    }).then(function (libDir) {
        return getPlatformDetailsFromDir(libDir, platform);
    });
}

function installPluginsForNewPlatform (platform, projectRoot, opts) {
    // Install all currently installed plugins into this new platform.
    const plugins_dir = path.join(projectRoot, 'plugins');

    // Get a list of all currently installed plugins, ignoring those that have already been installed for this platform
    // during prepare (installed from config.xml).
    const platformJson = PlatformJson.load(plugins_dir, platform);
    const plugins = cordova_util.findPlugins(plugins_dir).filter(function (plugin) {
        return !platformJson.isPluginInstalled(plugin);
    });
    if (plugins.length === 0) {
        return Promise.resolve();
    }

    const output = path.join(projectRoot, 'platforms', platform);
    const plugman = require('../../plugman/plugman');
    const fetchMetadata = require('../../plugman/util/metadata');

    // Install them serially.
    return plugins.reduce(function (soFar, plugin) {
        return soFar.then(function () {
            events.emit('verbose', 'Installing plugin "' + plugin + '" following successful platform add of ' + platform);

            // Get plugin variables from fetch.json if have any and pass them as cli_variables to plugman
            const pluginMetadata = fetchMetadata.get_fetch_metadata(plugins_dir, plugin);

            const options = {
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
                save: opts.save || false
            };

            const variables = pluginMetadata && pluginMetadata.variables;
            if (variables) {
                events.emit('verbose', 'Found variables for "' + plugin + '". Processing as cli_variables.');
                options.cli_variables = variables;
            }
            return plugman.install(platform, output, plugin, plugins_dir, options);
        });
    }, Promise.resolve());
}
