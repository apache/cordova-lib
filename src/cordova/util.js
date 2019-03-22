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
var events = require('cordova-common').events;
var CordovaError = require('cordova-common').CordovaError;
var url = require('url');
var platforms = require('../platforms/platforms');

// Global configuration paths
var global_config_path = process.env['CORDOVA_HOME'];
if (!global_config_path) {
    var HOME = process.env[(process.platform.slice(0, 3) === 'win') ? 'USERPROFILE' : 'HOME'];
    global_config_path = path.join(HOME, '.cordova');
}

var origCwd = null;

var lib_path = path.join(global_config_path, 'lib');

exports.binname = 'cordova';
exports.globalConfig = global_config_path;

// defer defining libDirectory on exports so we don't create it if
// someone simply requires this module
Object.defineProperty(exports, 'libDirectory', {
    configurable: true,
    get: function () {
        fs.ensureDirSync(lib_path);
        exports.libDirectory = lib_path;
        return lib_path;
    }
});

exports.isCordova = isCordova;
exports.getProjectRoot = getProjectRoot;
exports.cdProjectRoot = cdProjectRoot;
exports.deleteSvnFolders = deleteSvnFolders;
exports.listPlatforms = listPlatforms;
exports.findPlugins = findPlugins;
exports.appDir = appDir;
exports.projectWww = projectWww;
exports.projectConfig = projectConfig;
exports.preProcessOptions = preProcessOptions;
exports.getOrigWorkingDirectory = getOrigWorkingDirectory;
exports._resetOrigCwd = _resetOrigCwd;
exports.fixRelativePath = fixRelativePath;
exports.convertToRealPathSafe = convertToRealPathSafe;
exports.isDirectory = isDirectory;
exports.isUrl = isUrl;
exports.getInstalledPlatformsWithVersions = getInstalledPlatformsWithVersions;
exports.requireNoCache = requireNoCache;
exports.getPlatformApiFunction = getPlatformApiFunction;
exports.hostSupports = hostSupports;
exports.removePlatformPluginsJson = removePlatformPluginsJson;

// Remove <platform>.json file from plugins directory.
function removePlatformPluginsJson (projectRoot, target) {
    var plugins_json = path.join(projectRoot, 'plugins', target + '.json');
    fs.removeSync(plugins_json);
}

// Used to prevent attempts of installing platforms that are not supported on
// the host OS. E.g. ios on linux.
function hostSupports (platform) {
    var p = platforms[platform] || {};
    var hostos = p.hostos || null;
    if (!hostos) { return true; }
    if (hostos.indexOf('*') >= 0) { return true; }
    if (hostos.indexOf(process.platform) >= 0) { return true; }
    return false;
}

function requireNoCache (pkgJsonPath) {
    delete require.cache[require.resolve(pkgJsonPath)];
    var returnVal = require(pkgJsonPath);
    delete require.cache[require.resolve(pkgJsonPath)];
    return returnVal;
}

function isUrl (value) {
    // @todo Use 'url.URL' constructor instead since 'url.parse' was deprecated since v11.0.0
    var u = value && url.parse(value); // eslint-disable-line
    return !!(u && u.protocol && u.protocol.length > 2); // Account for windows c:/ paths
}

function isRootDir (dir) {
    if (fs.existsSync(path.join(dir, 'www'))) {
        if (fs.existsSync(path.join(dir, 'config.xml'))) {
            // For sure is.
            if (fs.existsSync(path.join(dir, 'platforms'))) {
                return 2;
            } else {
                return 1;
            }
        }
        // Might be (or may be under platforms/).
        if (fs.existsSync(path.join(dir, 'www', 'config.xml'))) {
            return 1;
        }
    }
    return 0;
}

// Runs up the directory chain looking for a .cordova directory.
// IF it is found we are in a Cordova project.
// Omit argument to use CWD.
function isCordova (dir) {
    if (!dir) {
        // Prefer PWD over cwd so that symlinked dirs within your PWD work correctly (CB-5687).
        var pwd = process.env.PWD;
        var cwd = process.cwd();
        if (pwd && pwd !== cwd && pwd !== 'undefined') {
            return this.isCordova(pwd) || this.isCordova(cwd);
        }
        return this.isCordova(cwd);
    }
    var bestReturnValueSoFar = false;
    for (var i = 0; i < 1000; ++i) {
        var result = isRootDir(dir);
        if (result === 2) {
            return dir;
        }
        if (result === 1) {
            bestReturnValueSoFar = dir;
        }
        var parentDir = path.normalize(path.join(dir, '..'));
        // Detect fs root.
        if (parentDir === dir) {
            return bestReturnValueSoFar;
        }
        dir = parentDir;
    }
    console.error('Hit an unhandled case in util.isCordova');
    return false;
}

/**
 * Returns the project root directory path.
 *
 * Throws a CordovaError if not in a Cordova project.
 */
function getProjectRoot () {
    const projectRoot = convertToRealPathSafe(this.isCordova());

    if (!projectRoot) {
        throw new CordovaError('Current working directory is not a Cordova-based project.');
    }

    return projectRoot;
}

// Cd to project root dir and return its path. Throw CordovaError if not in a Corodva project.
function cdProjectRoot () {
    const projectRoot = this.getProjectRoot();
    if (!origCwd) {
        origCwd = process.env.PWD || process.cwd();
    }
    process.env.PWD = projectRoot;
    process.chdir(projectRoot);
    return projectRoot;
}

function getOrigWorkingDirectory () {
    return origCwd || process.env.PWD || process.cwd();
}

function _resetOrigCwd () {
    origCwd = null;
}

// Fixes up relative paths that are no longer valid due to chdir() within cdProjectRoot().
function fixRelativePath (value, /* optional */ cwd) {
    // Don't touch absolute paths.
    if (value[1] === ':' || value[0] === path.sep) {
        return value;
    }
    var newDir = cwd || process.env.PWD || process.cwd();
    var origDir = getOrigWorkingDirectory();
    var pathDiff = path.relative(newDir, origDir);
    var ret = path.normalize(path.join(pathDiff, value));
    return ret;
}

// Resolve any symlinks in order to avoid relative path issues. See https://issues.apache.org/jira/browse/CB-8757
function convertToRealPathSafe (path) {
    if (path && fs.existsSync(path)) {
        return fs.realpathSync(path);
    }

    return path;
}

// Recursively deletes .svn folders from a target path
function deleteSvnFolders (dir) {
    var contents = fs.readdirSync(dir);
    contents.forEach(function (entry) {
        var fullpath = path.join(dir, entry);
        if (isDirectory(fullpath)) {
            if (entry === '.svn') {
                fs.removeSync(fullpath);
            } else module.exports.deleteSvnFolders(fullpath);
        }
    });
}

function listPlatforms (project_dir) {
    var platforms_dir = path.join(project_dir, 'platforms');
    if (!fs.existsSync(platforms_dir)) {
        return [];
    }
    // get subdirs (that are actually dirs, and not files)
    var subdirs = fs.readdirSync(platforms_dir)
        .filter(function (file) {
            return isDirectory(path.join(platforms_dir, file));
        });
    return subdirs;
}

function getInstalledPlatformsWithVersions (project_dir) {
    var result = {};
    var platforms_on_fs = listPlatforms(project_dir);

    return Promise.all(platforms_on_fs.map(function (p) {
        var superspawn = require('cordova-common').superspawn;
        return superspawn.maybeSpawn(path.join(project_dir, 'platforms', p, 'cordova', 'version'), [], { chmod: true })
            .then(function (v) {
                result[p] = v || null;
            }, function (v) {
                result[p] = 'broken';
            });
    })).then(function () {
        return result;
    });
}

// list the directories in the path, ignoring any files
function findPlugins (pluginDir) {
    var plugins = [];

    if (fs.existsSync(pluginDir)) {
        plugins = fs.readdirSync(pluginDir).filter(function (fileName) {
            var pluginPath = path.join(pluginDir, fileName);
            var isPlugin = isDirectory(pluginPath) || isSymbolicLink(pluginPath);
            return fileName !== '.svn' && fileName !== 'CVS' && isPlugin;
        });
    }

    return plugins;
}

function appDir (projectDir) {
    return projectDir;
}

function projectWww (projectDir) {
    return path.join(projectDir, 'www');
}

function projectConfig (projectDir) {
    var rootPath = path.join(projectDir, 'config.xml');
    var wwwPath = path.join(projectDir, 'www', 'config.xml');
    if (fs.existsSync(rootPath)) {
        return rootPath;
    } else if (fs.existsSync(wwwPath)) {
        return wwwPath;
    }
    return false;
}

function preProcessOptions (inputOptions) {
    /**
     * Current Desired Arguments
     * options: {verbose: boolean, platforms: [String], options: [String]}
     * Accepted Arguments
     * platformList: [String] -- assume just a list of platforms
     * platform: String -- assume this is a platform
     */
    var result = inputOptions || {};
    if (Array.isArray(inputOptions)) {
        result = { platforms: inputOptions };
    } else if (typeof inputOptions === 'string') {
        result = { platforms: [inputOptions] };
    }
    result.verbose = result.verbose || false;
    result.platforms = result.platforms || [];
    result.options = result.options || {};

    var projectRoot = this.isCordova();

    if (!projectRoot) {
        throw new CordovaError('Current working directory is not a Cordova-based project.');
    }
    var projectPlatforms = this.listPlatforms(projectRoot);
    if (projectPlatforms.length === 0) {
        throw new CordovaError('No platforms added to this project. Please use `' + exports.binname + ' platform add <platform>`.');
    }
    if (result.platforms.length === 0) {
        result.platforms = projectPlatforms;
    }

    if (!result.options.buildConfig && fs.existsSync(path.join(projectRoot, 'build.json'))) {
        result.options.buildConfig = path.join(projectRoot, 'build.json');
    }

    return result;
}

/**
 * Checks to see if the argument is a directory
 *
 * @param {string} dir - string representing path of directory
 * @return {boolean}
 */
function isDirectory (dir) {
    try {
        return fs.lstatSync(dir).isDirectory();
    } catch (e) {
        return false;
    }
}

/**
 * Checks to see if the argument is a symbolic link
 *
 * @param {string} dir - string representing path of directory
 * @return {boolean}
 */
function isSymbolicLink (dir) {
    try {
        return fs.lstatSync(dir).isSymbolicLink();
    } catch (e) {
        return false;
    }
}

// Takes a libDir (root of platform where pkgJson is expected) & a platform name.
// Platform is used if things go wrong, so we can use polyfill.
// Potential errors : path doesn't exist, module isn't found or can't load.
// Message prints if file not named Api.js or falls back to pollyfill.
function getPlatformApiFunction (libDir, platform) {
    var PlatformApi;
    try {
        // First we need to find whether platform exposes its' API via js module
        // If it does, then we require and instantiate it.
        // This will throw if package.json does not exist, or specify 'main'.
        var apiEntryPoint = require.resolve(libDir);
        if (apiEntryPoint) {
            if (path.basename(apiEntryPoint) !== 'Api.js') {
                events.emit('verbose', 'File name should be called Api.js.');
                // Not an error, still load it ...
            }
            PlatformApi = exports.requireNoCache(apiEntryPoint);
            if (!PlatformApi.createPlatform) {
                PlatformApi = null;
                events.emit('error', 'Does not appear to implement platform Api.');
            } else {
                events.emit('verbose', 'PlatformApi successfully found for platform ' + platform);
            }
        } else {
            events.emit('verbose', 'No Api.js entry point found.');
        }
    } catch (err) {
        // Emit the err, someone might care ...
        events.emit('warn', 'Unable to load PlatformApi from platform. ' + err);
        if (!platforms[platform]) {
            events.emit('error', 'The platform "' + platform + '" does not appear to be a valid cordova platform. It is missing API.js. ' + platform + ' not supported.');
        }
    }

    if (!PlatformApi) {
        throw new Error('Your ' + platform + ' platform does not have Api.js');
    }

    return PlatformApi;
}
