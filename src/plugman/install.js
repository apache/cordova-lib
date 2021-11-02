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

const execa = require('execa');
const path = require('path');
const fs = require('fs-extra');
const ActionStack = require('cordova-common').ActionStack;
const DepGraph = require('dep-graph');
const semver = require('semver');
const PlatformJson = require('cordova-common').PlatformJson;
const CordovaError = require('cordova-common').CordovaError;
const platform_modules = require('../platforms/platforms');
const os = require('os');
const events = require('cordova-common').events;
const HooksRunner = require('../hooks/HooksRunner');
const isWindows = (os.platform().substr(0, 3) === 'win');
const pluginSpec = require('../cordova/plugin/plugin_spec_parser');
const cordovaUtil = require('../cordova/util');

const PluginInfo = require('cordova-common').PluginInfo;
const PluginInfoProvider = require('cordova-common').PluginInfoProvider;
const variableMerge = require('./variable-merge');
const plugmanFetch = require('./fetch');

/* INSTALL FLOW
   ------------
   There are four functions install "flows" through. Here is an attempt at
   providing a high-level logic flow overview.
   1. module.exports (installPlugin)
     a) checks that the platform is supported
     b) converts oldIds into newIds (CPR -> npm)
     c) invokes possiblyFetch
   2. possiblyFetch
     a) checks that the plugin is fetched. if so, calls runInstall
     b) if not, invokes plugman.fetch, and when done, calls runInstall
   3. runInstall
     a) checks if the plugin is already installed. if so, calls back (done).
     b) if possible, will check the version of the project and make sure it is compatible with the plugin (checks <engine> tags)
     c) makes sure that any variables required by the plugin are specified. if they are not specified, plugman will throw or callback with an error.
     d) if dependencies are listed in the plugin, it will recurse for each dependent plugin, autoconvert IDs to newIDs and call possiblyFetch (2) on each one. When each dependent plugin is successfully installed, it will then proceed to call handleInstall (4)
   4. handleInstall
     a) queues up actions into a queue (asset, source-file, headers, etc)
     b) processes the queue
     c) calls back (done)
*/

// possible options: subdir, cli_variables, www_dir
// Returns a promise.
module.exports = function installPlugin (platform, project_dir, id, plugins_dir, options) {
    project_dir = cordovaUtil.convertToRealPathSafe(project_dir);
    plugins_dir = cordovaUtil.convertToRealPathSafe(plugins_dir);
    options = options || {};
    if (!Object.prototype.hasOwnProperty.call(options, 'is_top_level')) options.is_top_level = true;

    plugins_dir = plugins_dir || path.join(project_dir, 'cordova', 'plugins');

    const current_stack = new ActionStack();
    return possiblyFetch(id, plugins_dir, options)
        .then(function (plugin_dir) {
            return module.exports.runInstall(current_stack, platform, project_dir, plugin_dir, plugins_dir, options);
        });
};

// possible options: subdir, cli_variables, www_dir, git_ref, is_top_level
// Returns a promise.
function possiblyFetch (id, plugins_dir, options) {
    const parsedSpec = pluginSpec.parse(id);

    // if plugin is a relative path, check if it already exists
    const plugin_src_dir = isAbsolutePath(id) ? id : path.join(plugins_dir, parsedSpec.id);

    // Check that the plugin has already been fetched.
    if (fs.existsSync(plugin_src_dir)) {
        return Promise.resolve(plugin_src_dir);
    }

    const opts = Object.assign({}, options, {
        client: 'plugman'
    });
    return plugmanFetch(id, plugins_dir, opts);
}

function checkEngines (engines) {
    for (let i = 0; i < engines.length; i++) {
        const engine = engines[i];

        // This is a hack to allow plugins with <engine> tag to be installed with
        // engine with '-dev' or '-nightly' suffixes. It is required due to new semver range logic,
        // introduced in semver@3.x. For more details see https://github.com/npm/node-semver#prerelease-tags.
        //
        // This may lead to false-positive checks, when engine version with dropped
        // suffix is equal to one of range bounds, for example: 5.1.0-dev >= 5.1.0.
        // However this shouldn't be a problem, because this only should happen in dev workflow.
        engine.currentVersion = engine.currentVersion && engine.currentVersion.replace(/-dev|-nightly.*$/, '');
        if (semver.satisfies(engine.currentVersion, engine.minVersion, /* loose= */true) || engine.currentVersion === null) {
            continue; // engine ok!
        } else {
            const msg = 'Plugin doesn\'t support this project\'s ' + engine.name + ' version. ' +
                      engine.name + ': ' + engine.currentVersion +
                      ', failed version requirement: ' + engine.minVersion;
            events.emit('warn', msg);
            return Promise.reject(Object.assign(new Error(), { skip: true }));
        }
    }

    return Promise.resolve(true);
}

function cleanVersionOutput (version, name) {
    let out = version.trim();
    const rc_index = out.indexOf('rc');
    const dev_index = out.indexOf('dev');
    if (rc_index > -1) {
        out = out.substr(0, rc_index) + '-' + out.substr(rc_index);
    }

    // put a warning about using the dev branch
    if (dev_index > -1) {
        // some platform still lists dev branches as just dev, set to null and continue
        if (out === 'dev') {
            out = null;
        }
        events.emit('verbose', name + ' has been detected as using a development branch. Attemping to install anyways.');
    }

    // add extra period/digits to conform to semver - some version scripts will output
    // just a major or major minor version number
    const majorReg = /\d+/;
    const minorReg = /\d+\.\d+/;
    const patchReg = /\d+\.\d+\.\d+/;

    if (!patchReg.test(out)) {
        if (minorReg.test(out)) {
            out = out.match(minorReg)[0] + '.0';
        } else if (majorReg.test(out)) {
            out = out.match(majorReg)[0] + '.0.0';
        }
    }

    return out;
}

// exec engine scripts in order to get the current engine version
// Returns a promise for the array of engines.
function callEngineScripts (engines, project_dir) {
    return Promise.all(
        engines.map(function (engine) {
            // CB-5192; on Windows scriptSrc doesn't have file extension so we shouldn't check whether the script exists
            const scriptPath = engine.scriptSrc || null;
            if (scriptPath && (isWindows || fs.existsSync(engine.scriptSrc))) {
                if (!isWindows) { // not required on Windows
                    fs.chmodSync(engine.scriptSrc, '755');
                }
                return execa(scriptPath)
                    .then(({ stdout }) => {
                        engine.currentVersion = cleanVersionOutput(stdout, engine.name);
                        if (engine.currentVersion === '') {
                            events.emit('warn', engine.name + ' version check returned nothing (' + scriptPath + '), continuing anyways.');
                            engine.currentVersion = null;
                        }
                    }, () => {
                        events.emit('warn', engine.name + ' version check failed (' + scriptPath + '), continuing anyways.');
                        engine.currentVersion = null;
                    })
                    .then(_ => engine);
            } else {
                if (engine.currentVersion) {
                    engine.currentVersion = cleanVersionOutput(engine.currentVersion, engine.name);
                } else {
                    events.emit('warn', engine.name + ' version not detected (lacks script ' + scriptPath + ' ), continuing.');
                }

                return Promise.resolve(engine);
            }
        })
    );
}

// return only the engines we care about/need
function getEngines (pluginInfo, platform, project_dir, plugin_dir) {
    const engines = pluginInfo.getEngines();
    const defaultEngines = require('./util/default-engines')(project_dir);
    const uncheckedEngines = [];
    let cordovaEngineIndex, cordovaPlatformEngineIndex, theName, platformIndex, defaultPlatformIndex;
    // load in known defaults and update when necessary

    engines.forEach(function (engine) {
        theName = engine.name;

        // check to see if the engine is listed as a default engine
        if (defaultEngines[theName]) {
            // make sure engine is for platform we are installing on
            defaultPlatformIndex = defaultEngines[theName].platform.indexOf(platform);
            if (defaultPlatformIndex > -1 || defaultEngines[theName].platform === '*') {
                defaultEngines[theName].minVersion = defaultEngines[theName].minVersion ? defaultEngines[theName].minVersion : engine.version;
                defaultEngines[theName].currentVersion = defaultEngines[theName].currentVersion ? defaultEngines[theName].currentVersion : null;
                defaultEngines[theName].scriptSrc = defaultEngines[theName].scriptSrc ? defaultEngines[theName].scriptSrc : null;
                defaultEngines[theName].name = theName;

                // set the indices so we can pop the cordova engine when needed
                if (theName === 'cordova') cordovaEngineIndex = uncheckedEngines.length;
                if (theName === 'cordova-' + platform) cordovaPlatformEngineIndex = uncheckedEngines.length;

                uncheckedEngines.push(defaultEngines[theName]);
            }
        // check for other engines
        } else {
            if (typeof engine.platform === 'undefined' || typeof engine.scriptSrc === 'undefined') {
                throw new CordovaError('engine.platform or engine.scriptSrc is not defined in custom engine "' +
                    theName + '" from plugin "' + pluginInfo.id + '" for ' + platform);
            }

            platformIndex = engine.platform.indexOf(platform);
            // CB-7183: security check for scriptSrc path escaping outside the plugin
            const scriptSrcPath = path.resolve(plugin_dir, engine.scriptSrc);
            if (scriptSrcPath.indexOf(plugin_dir) !== 0) {
                throw new Error('Security violation: scriptSrc ' + scriptSrcPath + ' is out of plugin dir ' + plugin_dir);
            }
            if (platformIndex > -1 || engine.platform === '*') {
                uncheckedEngines.push({ name: theName, platform: engine.platform, scriptSrc: scriptSrcPath, minVersion: engine.version });
            }
        }
    });

    // make sure we check for platform req's and not just cordova reqs
    if (cordovaEngineIndex && cordovaPlatformEngineIndex) uncheckedEngines.pop(cordovaEngineIndex);
    return uncheckedEngines;
}

// possible options: cli_variables, www_dir, is_top_level
// Returns a promise.
module.exports.runInstall = runInstall;
function runInstall (actions, platform, project_dir, plugin_dir, plugins_dir, options) {
    project_dir = cordovaUtil.convertToRealPathSafe(project_dir);
    plugin_dir = cordovaUtil.convertToRealPathSafe(plugin_dir);
    plugins_dir = cordovaUtil.convertToRealPathSafe(plugins_dir);
    options = options || {};
    options.graph = options.graph || new DepGraph();
    options.pluginInfoProvider = options.pluginInfoProvider || new PluginInfoProvider();

    const pluginInfoProvider = options.pluginInfoProvider;
    const pluginInfo = pluginInfoProvider.get(plugin_dir);
    let filtered_variables = {};
    const platformJson = PlatformJson.load(plugins_dir, platform);

    if (platformJson.isPluginInstalled(pluginInfo.id)) {
        if (options.is_top_level) {
            let msg = 'Plugin "' + pluginInfo.id + '" already installed on ' + platform + '.';
            if (platformJson.isPluginDependent(pluginInfo.id)) {
                msg += ' Making it top-level.';
                platformJson.makeTopLevel(pluginInfo.id).save();
            }
            events.emit('log', msg);
        } else {
            events.emit('log', 'Dependent plugin "' + pluginInfo.id + '" already installed on ' + platform + '.');
        }

        // CB-11022 return true always in this case since if the plugin is installed
        // we don't need to call prepare in any way
        return Promise.resolve(true);
    }
    events.emit('log', 'Installing "' + pluginInfo.id + '" for ' + platform);

    const theEngines = getEngines(pluginInfo, platform, project_dir, plugin_dir);

    const install = {
        actions: actions,
        platform: platform,
        project_dir: project_dir,
        plugins_dir: plugins_dir,
        top_plugin_id: pluginInfo.id,
        top_plugin_dir: plugin_dir
    };

    return Promise.resolve().then(function () {
        if (options.platformVersion) {
            return Promise.resolve(options.platformVersion);
        }
        return Promise.resolve(cordovaUtil.getPlatformVersion(project_dir));
    }).then(function (platformVersion) {
        options.platformVersion = platformVersion;
        return callEngineScripts(theEngines, path.resolve(plugins_dir, '..'));
    }).then(function (engines) {
        return checkEngines(engines);
    }).then(function () {
        filtered_variables = variableMerge.mergeVariables(plugin_dir, platform, options);
        install.filtered_variables = filtered_variables;

        // Check for dependencies
        const dependencies = pluginInfo.getDependencies(platform);
        if (dependencies.length) {
            return installDependencies(install, dependencies, options);
        }
        return Promise.resolve(true);
    }
    ).then(
        function () {
            const install_plugin_dir = path.join(plugins_dir, pluginInfo.id);

            // may need to copy to destination...
            if (!fs.existsSync(install_plugin_dir)) {
                copyPlugin(plugin_dir, plugins_dir, options.link, pluginInfoProvider);
            }

            const projectRoot = cordovaUtil.isCordova();

            if (projectRoot) {
                // using unified hooksRunner
                const hookOptions = {
                    cordova: { platforms: [platform] },
                    plugin: {
                        id: pluginInfo.id,
                        pluginInfo: pluginInfo,
                        platform: install.platform,
                        dir: install.top_plugin_dir
                    },
                    nohooks: options.nohooks
                };

                // CB-10708 This is the case when we're trying to install plugin using plugman to specific
                // platform inside of the existing CLI project. In this case we need to put plugin's files
                // into platform_www but plugman CLI doesn't allow us to do that, so we set it here
                options.usePlatformWww = true;

                const hooksRunner = new HooksRunner(projectRoot);

                return hooksRunner.fire('before_plugin_install', hookOptions).then(function () {
                    return handleInstall(actions, pluginInfo, platform, project_dir, plugins_dir, install_plugin_dir, filtered_variables, options);
                }).then(function (installResult) {
                    return hooksRunner.fire('after_plugin_install', hookOptions)
                        // CB-11022 Propagate install result to caller to be able to avoid unnecessary prepare
                        .then(_ => installResult);
                });
            } else {
                return handleInstall(actions, pluginInfo, platform, project_dir, plugins_dir, install_plugin_dir, filtered_variables, options);
            }
        }
    ).catch(
        function (error) {
            if (error.skip) {
                events.emit('warn', 'Skipping \'' + pluginInfo.id + '\' for ' + platform);
            } else {
                events.emit('warn', 'Failed to install \'' + pluginInfo.id + '\': ' + error.stack);
                throw error;
            }
        }
    );
}

function installDependencies (install, dependencies, options) {
    events.emit('verbose', 'Dependencies detected, iterating through them...');

    options.searchpath = options.searchpath || [];

    // Search for dependency by Id is:
    // a) Look for {$top_plugins}/{$depId} directory
    // b) Scan the top level plugin directory {$top_plugins} for matching id (searchpath)
    // c) Fetch from registry

    return dependencies.reduce(function (soFar, dep) {
        return soFar.then(
            function () {
                dep.git_ref = dep.commit;

                if (dep.subdir) {
                    dep.subdir = path.normalize(dep.subdir);
                }

                // We build the dependency graph only to be able to detect cycles, getChain will throw an error if it detects one
                options.graph.add(install.top_plugin_id, dep.id);
                options.graph.getChain(install.top_plugin_id);

                return tryFetchDependency(dep, install, options)
                    .then(
                        function (url) {
                            dep.url = url;
                            return installDependency(dep, install, options);
                        }
                    );
            }
        );
    }, Promise.resolve(true));
}

function tryFetchDependency (dep, install, options) {
    // Handle relative dependency paths by expanding and resolving them.
    // The easy case of relative paths is to have a URL of '.' and a different subdir.
    // TODO: Implement the hard case of different repo URLs, rather than the special case of
    // same-repo-different-subdir.
    let relativePath;
    if (dep.url === '.') {
        // Look up the parent plugin's fetch metadata and determine the correct URL.
        const fetchdata = require('./util/metadata').get_fetch_metadata(install.plugins_dir, install.top_plugin_id);
        if (!fetchdata || !(fetchdata.source && fetchdata.source.type)) {
            relativePath = dep.subdir || dep.id;

            events.emit('warn', 'No fetch metadata found for plugin ' + install.top_plugin_id + '. checking for ' + relativePath + ' in ' + options.searchpath.join(','));

            return Promise.resolve(relativePath);
        }

        // Now there are two cases here: local directory, and git URL.
        if (fetchdata.source.type === 'local') {
            dep.url = fetchdata.source.path;

            return execa.command('git rev-parse --show-toplevel', { cwd: dep.url })
                .catch(err => {
                    if (err.exitCode === 128) {
                        throw new Error('Plugin ' + dep.id + ' is not in git repository. All plugins must be in a git repository.');
                    } else {
                        throw new Error('Failed to locate git repository for ' + dep.id + ' plugin.');
                    }
                })
                .then(({ stdout: git_repo }) => {
                    // Clear out the subdir since the url now contains it
                    const url = path.join(git_repo, dep.subdir);
                    dep.subdir = '';
                    return Promise.resolve(url);
                }).catch(function () {
                    return Promise.resolve(dep.url);
                });
        } else if (fetchdata.source.type === 'git') {
            return Promise.resolve(fetchdata.source.url);
        } else if (fetchdata.source.type === 'dir') {
            // Note: With fetch() independant from install()
            // $md5 = md5(uri)
            // Need a Hash(uri) --> $tmpDir/cordova-fetch/git-hostname.com-$md5/
            // plugin[id].install.source --> searchpath that matches fetch uri

            // mapping to a directory of OS containing fetched plugins
            let tmpDir = fetchdata.source.url;
            tmpDir = tmpDir.replace('$tmpDir', os.tmpdir());

            let pluginSrc = '';
            if (dep.subdir.length) {
                // Plugin is relative to directory
                pluginSrc = path.join(tmpDir, dep.subdir);
            }

            // Try searchpath in dir, if that fails re-fetch
            if (!pluginSrc.length || !fs.existsSync(pluginSrc)) {
                pluginSrc = dep.id;

                // Add search path
                if (options.searchpath.indexOf(tmpDir) === -1) { options.searchpath.unshift(tmpDir); } // place at top of search
            }

            return Promise.resolve(pluginSrc);
        }
    }

    // Test relative to parent folder
    if (dep.url && !isAbsolutePath(dep.url)) {
        relativePath = path.resolve(install.top_plugin_dir, '../' + dep.url);

        if (fs.existsSync(relativePath)) {
            dep.url = relativePath;
        }
    }

    // CB-4770: registry fetching
    if (dep.url === undefined) {
        dep.url = dep.id;
    }

    return Promise.resolve(dep.url);
}

function installDependency (dep, install, options) {
    let opts;
    dep.install_dir = path.join(install.plugins_dir, dep.id);

    events.emit('verbose', 'Requesting plugin "' + (dep.version ? dep.id + '@' + dep.version : dep.id) + '".');

    if (fs.existsSync(dep.install_dir)) {
        const pluginInfo = new PluginInfo(dep.install_dir);
        const version_installed = pluginInfo.version;
        let version_required = dep.version;

        if (dep.version) {
            if (Number(dep.version.replace('.', ''))) {
                version_required = '^' + dep.version;
            }
        }
        // strip -dev from the installed plugin version so it properly passes
        // semver.satisfies
        let stripped_version;
        if (version_installed.includes('-dev')) {
            stripped_version = semver.inc(version_installed, 'patch');
        }
        if (options.force ||
            semver.satisfies(version_installed, version_required, /* loose= */true) ||
            semver.satisfies(stripped_version, version_required, /* loose= */true) ||
            version_required === null ||
            version_required === undefined ||
            version_required === '') {
            events.emit('log', 'Plugin dependency "' + (version_installed ? dep.id + '@' + version_installed : dep.id) + '" already fetched, using that version.');
        } else {
            const msg = 'Version of installed plugin: "' +
                dep.id + '@' + version_installed +
                '" does not satisfy dependency plugin requirement "' +
                dep.id + '@' + version_required +
                 '". Try --force to use installed plugin as dependency.';
            return Promise.resolve()
                .then(function () {
                    // Remove plugin
                    return fs.removeSync(path.join(install.plugins_dir, install.top_plugin_id));
                }).then(function () {
                    // Return promise chain and finally reject
                    return Promise.reject(new CordovaError(msg));
                });
        }
        opts = Object.assign({}, options, {
            cli_variables: install.filtered_variables,
            is_top_level: false
        });
        return module.exports.runInstall(install.actions, install.platform, install.project_dir, dep.install_dir, install.plugins_dir, opts);
    } else {
        events.emit('verbose', 'Plugin dependency "' + dep.id + '" not fetched, retrieving then installing.');

        opts = Object.assign({}, options, {
            cli_variables: install.filtered_variables,
            is_top_level: false,
            subdir: dep.subdir,
            git_ref: dep.git_ref,
            expected_id: dep.id
        });

        const dep_src = dep.url.length ? dep.url : (dep.version ? dep.id + '@' + dep.version : dep.id);
        return possiblyFetch(dep_src, install.plugins_dir, opts)
            .then(
                function (plugin_dir) {
                    return module.exports.runInstall(install.actions, install.platform, install.project_dir, plugin_dir, install.plugins_dir, opts);
                }
            );
    }
}

function handleInstall (actions, pluginInfo, platform, project_dir, plugins_dir, plugin_dir, filtered_variables, options) {
    // @tests - important this event is checked spec/install.spec.js
    events.emit('verbose', 'Install start for "' + pluginInfo.id + '" on ' + platform + '.');

    options.variables = filtered_variables;
    return platform_modules.getPlatformApi(platform, project_dir)
        .addPlugin(pluginInfo, options)
        .then(function (result) {
            events.emit('verbose', 'Install complete for ' + pluginInfo.id + ' on ' + platform + '.');
            // Add plugin to installed list. This already done in platform,
            // but need to be duplicated here to manage dependencies properly.
            PlatformJson.load(plugins_dir, platform)
                .addPlugin(pluginInfo.id, filtered_variables, options.is_top_level)
                .save();

            // WIN!
            // Log out plugin INFO element contents in case additional install steps are necessary
            const info_strings = pluginInfo.getInfo(platform) || [];
            info_strings.forEach(function (info) {
                events.emit('results', interp_vars(filtered_variables, info));
            });

            // Propagate value, returned by platform's addPlugin method to caller
            return Promise.resolve(result);
        });
}

function interp_vars (vars, text) {
    vars && Object.keys(vars).forEach(function (key) {
        const regExp = new RegExp('\\$' + key, 'g');
        text = text.replace(regExp, vars[key]);
    });
    return text;
}

function isAbsolutePath (_path) {
    // some valid abs paths: 'c:' '/' '\' and possibly ? 'file:' 'http:'
    return _path && (_path.charAt(0) === path.sep || _path.indexOf(':') > 0);
}

// Copy or link a plugin from plugin_dir to plugins_dir/plugin_id.
function copyPlugin (plugin_src_dir, plugins_dir, link, pluginInfoProvider) {
    const pluginInfo = new PluginInfo(plugin_src_dir);
    const dest = path.join(plugins_dir, pluginInfo.id);

    if (link) {
        events.emit('verbose', 'Symlinking from location "' + plugin_src_dir + '" to location "' + dest + '"');
        fs.removeSync(dest);
        fs.ensureSymlinkSync(plugin_src_dir, dest, 'junction');
    } else {
        events.emit('verbose', 'Copying from location "' + plugin_src_dir + '" to location "' + dest + '"');
        fs.copySync(plugin_src_dir, dest);
    }
    pluginInfo.dir = dest;
    pluginInfoProvider.put(pluginInfo);

    return dest;
}
