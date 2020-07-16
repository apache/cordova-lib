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

var cordova_util = require('../util');
var plugin_util = require('./util');
var cordova_pkgJson = require('../../../package.json');
var pluginSpec = require('./plugin_spec_parser');
var plugman = require('../../plugman/plugman');
var chainMap = require('../../util/promise-util').Q_chainmap;
var ConfigParser = require('cordova-common').ConfigParser;
var CordovaError = require('cordova-common').CordovaError;
var PluginInfoProvider = require('cordova-common').PluginInfoProvider;
var events = require('cordova-common').events;
var path = require('path');
var fs = require('fs-extra');
var semver = require('semver');
var url = require('url');
var detectIndent = require('detect-indent');
var preparePlatforms = require('../prepare/platforms');

module.exports = add;
module.exports.determinePluginTarget = determinePluginTarget;
module.exports.parseSource = parseSource;
module.exports.getVersionFromConfigFile = getVersionFromConfigFile;
module.exports.getFetchVersion = getFetchVersion;
module.exports.determinePluginVersionToFetch = determinePluginVersionToFetch;
module.exports.getFailedRequirements = getFailedRequirements;
module.exports.findVersion = findVersion;
module.exports.listUnmetRequirements = listUnmetRequirements;

function add (projectRoot, hooksRunner, opts) {
    if (!opts.plugins || !opts.plugins.length) {
        return Promise.reject(new CordovaError('No plugin specified. Please specify a plugin to add.'));
    }
    var pluginInfo;
    var shouldRunPrepare = false;
    var pluginPath = path.join(projectRoot, 'plugins');
    var platformList = cordova_util.listPlatforms(projectRoot);
    var xml = cordova_util.projectConfig(projectRoot);
    var cfg = new ConfigParser(xml);

    var searchPath = opts.searchpath;
    if (typeof searchPath === 'string') {
        searchPath = searchPath.split(path.delimiter);
    }
    // Blank it out to appease unit tests.
    if (searchPath && searchPath.length === 0) {
        searchPath = undefined;
    }

    opts.cordova = { plugins: cordova_util.findPlugins(pluginPath) };
    return hooksRunner.fire('before_plugin_add', opts)
        .then(function () {
            var pluginInfoProvider = new PluginInfoProvider();
            return opts.plugins.reduce(function (soFar, target) {
                return soFar.then(function () {
                    if (target[target.length - 1] === path.sep) {
                        target = target.substring(0, target.length - 1);
                    }

                    // Fetch the plugin first.
                    var fetchOptions = {
                        searchpath: searchPath,
                        noregistry: opts.noregistry,
                        save: opts.save,
                        nohooks: opts.nohooks,
                        link: opts.link,
                        pluginInfoProvider: pluginInfoProvider,
                        variables: opts.cli_variables,
                        is_top_level: true,
                        save_exact: opts.save_exact || false,
                        production: opts.production
                    };

                    return module.exports.determinePluginTarget(projectRoot, cfg, target, fetchOptions).then(function (resolvedTarget) {
                        target = resolvedTarget;
                        events.emit('verbose', 'Calling plugman.fetch on plugin "' + target + '"');
                        return plugman.fetch(target, pluginPath, fetchOptions);
                    });
                }).then(function (directory) {
                    return pluginInfoProvider.get(directory);
                }).then(function (plugInfoProvider) {
                    pluginInfo = plugInfoProvider;
                    return plugin_util.mergeVariables(pluginInfo, cfg, opts);
                }).then(function (variables) {
                    opts.cli_variables = variables;

                    // Iterate (in serial!) over all platforms in the project and install the plugin.
                    return chainMap(platformList, function (platform) {
                        var platformRoot = path.join(projectRoot, 'platforms', platform);
                        var options = {
                            cli_variables: opts.cli_variables || {},
                            save: opts.save,
                            searchpath: searchPath,
                            noregistry: opts.noregistry,
                            link: opts.link,
                            pluginInfoProvider: pluginInfoProvider,
                            // Set up platform to install asset files/js modules to <platform>/platform_www dir
                            // instead of <platform>/www. This is required since on each prepare platform's www dir is changed
                            // and files from 'platform_www' merged into 'www'. Thus we need to persist these
                            // files platform_www directory, so they'll be applied to www on each prepare.
                            usePlatformWww: true,
                            nohooks: opts.nohooks,
                            force: opts.force,
                            save_exact: opts.save_exact || false,
                            production: opts.production
                        };

                        events.emit('verbose', 'Calling plugman.install on plugin "' + pluginInfo.dir + '" for platform "' + platform);
                        return plugman.install(platform, platformRoot, pluginInfo.id, pluginPath, options)
                            .then(function (didPrepare) {
                                // If platform does not returned anything we'll need
                                // to trigger a prepare after all plugins installed
                                if (!didPrepare) shouldRunPrepare = true;
                            });
                    })
                        .then(_ => pluginInfo);
                }).then(function (pluginInfo) {
                    var pkgJson;
                    var pkgJsonPath = path.join(projectRoot, 'package.json');

                    // save to package.json
                    if (opts.save) {
                        // If statement to see if pkgJsonPath exists in the filesystem
                        if (fs.existsSync(pkgJsonPath)) {
                            // Delete any previous caches of require(package.json)
                            pkgJson = cordova_util.requireNoCache(pkgJsonPath);
                        }
                        // If package.json exists, the plugin object and plugin name
                        // will be added to package.json if not already there.
                        if (pkgJson) {
                            pkgJson.cordova = pkgJson.cordova || {};
                            pkgJson.cordova.plugins = pkgJson.cordova.plugins || {};
                            // Plugin and variables are added.
                            pkgJson.cordova.plugins[pluginInfo.id] = opts.cli_variables;
                            events.emit('log', 'Adding ' + pluginInfo.id + ' to package.json');

                            // Write to package.json
                            var file = fs.readFileSync(pkgJsonPath, 'utf8');
                            var indent = detectIndent(file).indent || '  ';
                            fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, indent), 'utf8');
                        }

                        var src = module.exports.parseSource(target, opts);
                        var attributes = {
                            name: pluginInfo.id
                        };

                        if (src) {
                            attributes.spec = src;
                        } else {
                            var ver = '~' + pluginInfo.version;
                            if (pkgJson && pkgJson.dependencies && pkgJson.dependencies[pluginInfo.id]) {
                                attributes.spec = pkgJson.dependencies[pluginInfo.id];
                            } else if (pkgJson && pkgJson.devDependencies && pkgJson.devDependencies[pluginInfo.id]) {
                                attributes.spec = pkgJson.devDependencies[pluginInfo.id];
                            } else {
                                attributes.spec = ver;
                            }
                        }
                    }
                });
            }, Promise.resolve());
        }).then(function () {
            // CB-11022 We do not need to run prepare after plugin install until shouldRunPrepare flag is set to true
            if (!shouldRunPrepare) {
                return Promise.resolve();
            }
            // Need to require right here instead of doing this at the beginning of file
            // otherwise tests are failing without any real reason.
            // TODO: possible circular dependency?
            return preparePlatforms(platformList, projectRoot, opts);
        }).then(function () {
            opts.cordova = { plugins: cordova_util.findPlugins(pluginPath) };
            return hooksRunner.fire('after_plugin_add', opts);
        });
}

function determinePluginTarget (projectRoot, cfg, target, fetchOptions) {
    var parsedSpec = pluginSpec.parse(target);
    var id = parsedSpec.package || target;
    // CB-10975 We need to resolve relative path to plugin dir from app's root before checking whether if it exists
    var maybeDir = cordova_util.fixRelativePath(id);
    if (parsedSpec.version || cordova_util.isUrl(id) || cordova_util.isDirectory(maybeDir)) {
        return Promise.resolve(target);
    }
    // Require project pkgJson.
    var pkgJson;
    var pkgJsonPath = path.join(projectRoot, 'package.json');
    var cordovaVersion = cordova_pkgJson.version;
    if (fs.existsSync(pkgJsonPath)) {
        pkgJson = cordova_util.requireNoCache(pkgJsonPath);
    }

    // If no parsedSpec.version, use the one from pkg.json or config.xml.
    if (!parsedSpec.version) {
        // Retrieve from pkg.json.
        if (pkgJson && pkgJson.dependencies && pkgJson.dependencies[id]) {
            events.emit('verbose', 'No version specified for ' + id + ', retrieving version from package.json');
            parsedSpec.version = pkgJson.dependencies[id];
        } else if (pkgJson && pkgJson.devDependencies && pkgJson.devDependencies[id]) {
            events.emit('verbose', 'No version specified for ' + id + ', retrieving version from package.json');
            parsedSpec.version = pkgJson.devDependencies[id];
        } else {
            // If no version is specified, retrieve the version (or source) from config.xml.
            events.emit('verbose', 'No version specified for ' + id + ', retrieving version from config.xml');
            parsedSpec.version = module.exports.getVersionFromConfigFile(id, cfg);
        }
    }

    // If parsedSpec.version satisfies pkgJson version, no writing to pkg.json. Only write when
    // it does not satisfy.
    /* if (parsedSpec.version) {
        if (pkgJson && pkgJson.dependencies && pkgJson.dependencies[parsedSpec.package]) {
            //it can only go in here if
            var noSymbolVersion = parsedSpec.version;
            if (parsedSpec.version.charAt(0) === '^' || parsedSpec.version.charAt(0) === '~') {
                noSymbolVersion = parsedSpec.version.slice(1);
            }

            if (cordova_util.isUrl(parsedSpec.version) || cordova_util.isDirectory(parsedSpec.version)) {
                if (pkgJson.dependencies[parsedSpec.package] !== parsedSpec.version) {
                    pkgJson.dependencies[parsedSpec.package] = parsedSpec.version;
                }
                if (fetchOptions.save === true) {
                    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf8');
                }
            } else if (!semver.satisfies(noSymbolVersion, pkgJson.dependencies[parsedSpec.package])) {
                pkgJson.dependencies[parsedSpec.package] = parsedSpec.version;
                if (fetchOptions.save === true) {
                    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2), 'utf8');
                }
            }
        }
    } */

    if (cordova_util.isUrl(parsedSpec.version) || cordova_util.isDirectory(parsedSpec.version)) {
        return Promise.resolve(parsedSpec.version);
    }

    // If version exists in pkg.json or config.xml, use that.
    if (parsedSpec.version) {
        return Promise.resolve(id + '@' + parsedSpec.version);
    }
    // If no version is given at all and we are fetching from npm, we
    // can attempt to use the Cordova dependencies the plugin lists in
    // their package.json
    var shouldUseNpmInfo = !fetchOptions.searchpath && !fetchOptions.noregistry;

    events.emit('verbose', 'No version for ' + parsedSpec.package + ' saved in config.xml or package.json');
    if (shouldUseNpmInfo) {
        events.emit('verbose', 'Attempting to use npm info for ' + parsedSpec.package + ' to choose a compatible release');
    } else {
        events.emit('verbose', 'Not checking npm info for ' + parsedSpec.package + ' because searchpath or noregistry flag was given');
    }
    // if noregistry or searchpath are true, then shouldUseNpmInfo is false. Just return target
    // else run `npm info` on the target via registry.info so we could get
    // engines elemenent in package.json. Pass that info to getFetchVersion
    // which determines the correct plugin to fetch based on engines element.
    return (shouldUseNpmInfo ? plugin_util.info([id])
        .then(function (pluginInfo) {
            return module.exports.getFetchVersion(projectRoot, pluginInfo, cordovaVersion);
        }) : Promise.resolve(null))
        .then(function (fetchVersion) {
            return fetchVersion ? (id + '@' + fetchVersion) : target;
        });
}

function parseSource (target, opts) {
    // @todo Use 'url.URL' constructor instead since 'url.parse' was deprecated since v11.0.0
    var uri = url.parse(target); // eslint-disable-line
    if (uri.protocol && uri.protocol !== 'file:' && uri.protocol[1] !== ':' && !target.match(/^\w+:\\/)) {
        return target;
    } else {
        var plugin_dir = cordova_util.fixRelativePath(path.join(target, (opts.subdir || '.')));
        if (fs.existsSync(plugin_dir)) {
            return target;
        }
    }
    return null;
}

function getVersionFromConfigFile (plugin, cfg) {
    var parsedSpec = pluginSpec.parse(plugin);
    var pluginEntry = cfg.getPlugin(parsedSpec.id);

    return pluginEntry && pluginEntry.spec;
}

/**
 * Gets the version of a plugin that should be fetched for a given project based
 * on the plugin's engine information from NPM and the platforms/plugins installed
 * in the project. The cordovaDependencies object in the package.json's engines
 * entry takes the form of an object that maps plugin versions to a series of
 * constraints and semver ranges. For example:
 *
 *     { plugin-version: { constraint: semver-range, ...}, ...}
 *
 * Constraint can be a plugin, platform, or cordova version. Plugin-version
 * can be either a single version (e.g. 3.0.0) or an upper bound (e.g. <3.0.0)
 *
 * @param {string}  projectRoot     The path to the root directory of the project
 * @param {object}  pluginInfo      The NPM info of the plugin to be fetched (e.g. the
 *                                  result of calling `registry.info()`)
 * @param {string}  cordovaVersion  The semver version of cordova-lib
 *
 * @return {Promise}                A promise that will resolve to either a string
 *                                  if there is a version of the plugin that this
 *                                  project satisfies or null if there is not
 */
function getFetchVersion (projectRoot, pluginInfo, cordovaVersion) {
    // Figure out the project requirements
    if (pluginInfo.engines && pluginInfo.engines.cordovaDependencies) {
        // grab array of already installed plugins
        var pluginList = plugin_util.getInstalledPlugins(projectRoot);
        var pluginMap = {};
        pluginList.forEach(function (plugin) {
            pluginMap[plugin.id] = plugin.version;
        });
        return cordova_util.getInstalledPlatformsWithVersions(projectRoot)
            .then(function (platformVersions) {
                return module.exports.determinePluginVersionToFetch(
                    pluginInfo,
                    pluginMap,
                    platformVersions,
                    cordovaVersion);
            });
    } else {
        // If we have no engine, we want to fall back to the default behavior
        events.emit('verbose', 'npm info for ' + pluginInfo.name + ' did not contain any engine info. Fetching latest release');
        return Promise.resolve(null);
    }
}

// For upper bounds in cordovaDependencies
var UPPER_BOUND_REGEX = /^<\d+\.\d+\.\d+$/;
/*
 * The engine entry maps plugin versions to constraints like so:
 *  {
 *      '1.0.0' : { 'cordova': '<5.0.0' },
 *      '<2.0.0': {
 *          'cordova': '>=5.0.0',
 *          'cordova-ios': '~5.0.0',
 *          'cordova-plugin-camera': '~5.0.0'
 *      },
 *      '3.0.0' : { 'cordova-ios': '>5.0.0' }
 *  }
 *
 * TODO: provide a better function description once logic is groked
 * TODO: update comment below once tests are rewritten/moved around.
 * See cordova-spec/plugin_fetch.spec.js for test cases and examples
 */
function determinePluginVersionToFetch (pluginInfo, pluginMap, platformMap, cordovaVersion) {
    var allVersions = pluginInfo.versions;
    var engine = pluginInfo.engines.cordovaDependencies;
    var name = pluginInfo.name;

    // Filters out pre-release versions
    var latest = semver.maxSatisfying(allVersions, '>=0.0.0');

    var versions = [];
    var upperBound = null;
    var upperBoundRange = null;
    var upperBoundExists = false;

    // TODO: lots of 'versions' being thrown around in this function: cordova version,
    // platform version, plugin version. The below for loop: what version is it
    // iterating over? plugin version? please clarify the variable name.
    for (var version in engine) {
        // if a single version && less than latest
        if (semver.valid(semver.clean(version)) && semver.lte(version, latest)) {
            versions.push(version);
        } else {
            // Check if this is an upperbound; validRange() handles whitespace
            var cleanedRange = semver.validRange(version);
            if (cleanedRange && UPPER_BOUND_REGEX.exec(cleanedRange)) {
                upperBoundExists = true;
                // We only care about the highest upper bound that our project does not support
                if (module.exports.getFailedRequirements(engine[version], pluginMap, platformMap, cordovaVersion).length !== 0) {
                    var maxMatchingUpperBound = cleanedRange.substring(1);
                    if (maxMatchingUpperBound && (!upperBound || semver.gt(maxMatchingUpperBound, upperBound))) {
                        upperBound = maxMatchingUpperBound;
                        upperBoundRange = version;
                    }
                }
            } else {
                events.emit('verbose', 'Ignoring invalid version in ' + name + ' cordovaDependencies: ' + version + ' (must be a single version <= latest or an upper bound)');
            }
        }
    }
    // If there were no valid requirements, we fall back to old behavior
    if (!upperBoundExists && versions.length === 0) {
        events.emit('verbose', 'Ignoring ' + name + ' cordovaDependencies entry because it did not contain any valid plugin version entries');
        return null;
    }

    // Handle the lower end of versions by giving them a satisfied engine
    if (!module.exports.findVersion(versions, '0.0.0')) {
        versions.push('0.0.0');
        engine['0.0.0'] = {};
    }

    // Add an entry after the upper bound to handle the versions above the
    // upper bound but below the next entry. For example: 0.0.0, <1.0.0, 2.0.0
    // needs a 1.0.0 entry that has the same engine as 0.0.0
    if (upperBound && !module.exports.findVersion(versions, upperBound) && !semver.gt(upperBound, latest)) {
        versions.push(upperBound);
        var below = semver.maxSatisfying(versions, upperBoundRange);

        // Get the original entry without trimmed whitespace
        below = below ? module.exports.findVersion(versions, below) : null;
        engine[upperBound] = below ? engine[below] : {};
    }

    // Sort in descending order; we want to start at latest and work back
    versions.sort(semver.rcompare);

    for (var i = 0; i < versions.length; i++) {
        if (upperBound && semver.lt(versions[i], upperBound)) {
            // Because we sorted in desc. order, if the upper bound we found
            // applies to this version (and thus the ones below) we can just
            // quit
            break;
        }

        var range = i ? ('>=' + versions[i] + ' <' + versions[i - 1]) : ('>=' + versions[i]);
        var maxMatchingVersion = semver.maxSatisfying(allVersions, range);

        if (maxMatchingVersion && module.exports.getFailedRequirements(engine[versions[i]], pluginMap, platformMap, cordovaVersion).length === 0) {
            // Because we sorted in descending order, we can stop searching once
            // we hit a satisfied constraint
            if (maxMatchingVersion !== latest) {
                var failedReqs = module.exports.getFailedRequirements(engine[versions[0]], pluginMap, platformMap, cordovaVersion);

                // Warn the user that we are not fetching latest
                module.exports.listUnmetRequirements(name, failedReqs);
                events.emit('warn', 'Fetching highest version of ' + name + ' that this project supports: ' + maxMatchingVersion + ' (latest is ' + latest + ')');
            }
            return maxMatchingVersion;
        }
    }

    // No version of the plugin is satisfied. In this case, we fall back to
    // fetching the latest version, but also output a warning
    var latestFailedReqs = versions.length > 0 ? module.exports.getFailedRequirements(engine[versions[0]], pluginMap, platformMap, cordovaVersion) : [];

    // If the upper bound is greater than latest, we need to combine its engine
    // requirements with latest to print out in the warning
    if (upperBound && semver.satisfies(latest, upperBoundRange)) {
        var upperFailedReqs = module.exports.getFailedRequirements(engine[upperBoundRange], pluginMap, platformMap, cordovaVersion);
        upperFailedReqs.forEach(function (failedReq) {
            for (var i = 0; i < latestFailedReqs.length; i++) {
                if (latestFailedReqs[i].dependency === failedReq.dependency) {
                    // Not going to overcomplicate things and actually merge the ranges
                    latestFailedReqs[i].required += ' AND ' + failedReq.required;
                    return;
                }
            }

            // There is no req to merge it with
            latestFailedReqs.push(failedReq);
        });
    }

    module.exports.listUnmetRequirements(name, latestFailedReqs);
    events.emit('warn', 'Current project does not satisfy the engine requirements specified by any version of ' + name + '. Fetching latest version of plugin anyway (may be incompatible)');

    // No constraints were satisfied
    return null;
}

/*
 * Returns an array full of objects of dependency requirements that are not met.
 * reqs - CordovaDependency object from plugin's package.json
 * pluginMap - previously installed plugins in the project
 * platformMap - previously installed platforms in the project
 * cordovaVersion - version of cordova being used
 */
function getFailedRequirements (reqs, pluginMap, platformMap, cordovaVersion) {
    var failed = [];
    var version = cordovaVersion;
    if (semver.prerelease(version)) {
        //  semver.inc with 'patch' type removes prereleased tag from version
        version = semver.inc(version, 'patch');
    }

    for (var req in reqs) {
        if (Object.prototype.hasOwnProperty.call(reqs, req) && typeof req === 'string' && semver.validRange(reqs[req])) {
            var badInstalledVersion = null;
            // remove potential whitespace
            var trimmedReq = req.trim();

            if (pluginMap[trimmedReq] && !semver.satisfies(pluginMap[trimmedReq], reqs[req])) {
                badInstalledVersion = pluginMap[req];
            } else if (trimmedReq === 'cordova' && !semver.satisfies(version, reqs[req])) {
                badInstalledVersion = cordovaVersion;
            } else if (trimmedReq.indexOf('cordova-') === 0) {
                // Might be a platform constraint
                var platform = trimmedReq.substring(8);
                if (platformMap[platform] && !semver.satisfies(platformMap[platform], reqs[req])) {
                    badInstalledVersion = platformMap[platform];
                }
            }

            if (badInstalledVersion) {
                failed.push({
                    dependency: trimmedReq,
                    installed: badInstalledVersion.trim(),
                    required: reqs[req].trim()
                });
            }
        } else {
            events.emit('verbose', 'Ignoring invalid plugin dependency constraint ' + req + ':' + reqs[req]);
        }
    }

    return failed;
}

// return the version if it is in the versions array
// return null if the version doesn't exist in the array
function findVersion (versions, version) {
    var cleanedVersion = semver.clean(version);
    for (var i = 0; i < versions.length; i++) {
        if (semver.clean(versions[i]) === cleanedVersion) {
            return versions[i];
        }
    }
    return null;
}

// emits warnings to users of failed dependnecy requirements in their projects
function listUnmetRequirements (name, failedRequirements) {
    events.emit('warn', 'Unmet project requirements for latest version of ' + name + ':');

    failedRequirements.forEach(function (req) {
        events.emit('warn', '    ' + req.dependency + ' (' + req.installed + ' in project, ' + req.required + ' required)');
    });
}
