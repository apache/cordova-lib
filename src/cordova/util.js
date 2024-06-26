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

const fs = require('node:fs');
const path = require('node:path');
const events = require('cordova-common').events;
const CordovaError = require('cordova-common').CordovaError;
const globby = require('globby');

let origCwd = null;

exports.binname = 'cordova';

exports.isCordova = isCordova;
exports.getProjectRoot = getProjectRoot;
exports.cdProjectRoot = cdProjectRoot;
exports.listPlatforms = listPlatforms;
exports.findPlugins = findPlugins;
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
exports.removePlatformPluginsJson = removePlatformPluginsJson;
exports.getPlatformVersion = getPlatformVersionOrNull;

// Remove <platform>.json file from plugins directory.
function removePlatformPluginsJson (projectRoot, target) {
    const plugins_json = path.join(projectRoot, 'plugins', target + '.json');
    fs.rmSync(plugins_json, { recursive: true, force: true });
}

function requireNoCache (pkgJsonPath) {
    delete require.cache[require.resolve(pkgJsonPath)];
    const returnVal = require(pkgJsonPath);
    delete require.cache[require.resolve(pkgJsonPath)];
    return returnVal;
}

function isUrl (value) {
    try {
        const u = value && new URL(value);
        return !!(u && u.protocol && u.protocol.length > 2); // Account for windows c:/ paths
    } catch (e) {
        return false;
    }
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
        const pwd = process.env.PWD;
        const cwd = process.cwd();
        if (pwd && pwd !== cwd && pwd !== 'undefined') {
            return this.isCordova(pwd) || this.isCordova(cwd);
        }
        return this.isCordova(cwd);
    }
    let bestReturnValueSoFar = false;
    for (let i = 0; i < 1000; ++i) {
        const result = isRootDir(dir);
        if (result === 2) {
            return dir;
        }
        if (result === 1) {
            bestReturnValueSoFar = dir;
        }
        const parentDir = path.normalize(path.join(dir, '..'));
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
    const newDir = cwd || process.env.PWD || process.cwd();
    const origDir = getOrigWorkingDirectory();
    const pathDiff = path.relative(newDir, origDir);
    const ret = path.normalize(path.join(pathDiff, value));
    return ret;
}

// Resolve any symlinks in order to avoid relative path issues. See https://issues.apache.org/jira/browse/CB-8757
function convertToRealPathSafe (path) {
    if (path && fs.existsSync(path)) {
        return fs.realpathSync(path);
    }

    return path;
}

function listPlatforms (project_dir) {
    const platforms_dir = path.join(project_dir, 'platforms');
    if (!fs.existsSync(platforms_dir)) {
        return [];
    }
    // get subdirs (that are actually dirs, and not files)
    const subdirs = fs.readdirSync(platforms_dir)
        .filter(function (file) {
            return isDirectory(path.join(platforms_dir, file));
        });
    return subdirs;
}

function getInstalledPlatformsWithVersions (project_dir) {
    return Promise.resolve(listPlatforms(project_dir).reduce((result, p) => {
        try {
            const platformPath = path.join(project_dir, 'platforms', p);
            result[p] = getPlatformVersion(platformPath) || null;
        } catch (e) {
            result[p] = 'broken';
        }
        return result;
    }, {}));
}

function getPlatformVersion (platformPath) {
    try {
        // Major Platforms for Cordova 10+
        return requireNoCache(
            path.join(platformPath, 'cordova/Api')
        ).version();
    } catch (e) {
        // Platforms pre-Cordova 10
        return require('execa').sync(
            process.argv0, // node
            [path.join(platformPath, 'cordova/version')]
        ).stdout;
    }
}

function getPlatformVersionOrNull (platformPath) {
    try {
        return getPlatformVersion(platformPath);
    } catch (e) {
        return null;
    }
}

// list the directories in the path, ignoring any files
function findPlugins (pluginDir) {
    if (!fs.existsSync(pluginDir)) return [];

    return globby.sync(['*', '!@*', '@*/*', '!CVS'], {
        cwd: pluginDir,
        onlyDirectories: true
    });
}

function projectWww (projectDir) {
    return path.join(projectDir, 'www');
}

function projectConfig (projectDir) {
    const rootPath = path.join(projectDir, 'config.xml');
    const wwwPath = path.join(projectDir, 'www', 'config.xml');
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
    let result = inputOptions || {};
    if (Array.isArray(inputOptions)) {
        result = { platforms: inputOptions };
    } else if (typeof inputOptions === 'string') {
        result = { platforms: [inputOptions] };
    }
    result.verbose = result.verbose || false;
    result.platforms = result.platforms || [];
    result.options = result.options || {};

    const projectRoot = this.isCordova();

    if (!projectRoot) {
        throw new CordovaError('Current working directory is not a Cordova-based project.');
    }
    const projectPlatforms = this.listPlatforms(projectRoot);
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

// Returns the API of the platform contained in `dir`.
// Potential errors : module isn't found, can't load or doesn't implement the expected interface.
function getPlatformApiFunction (dir, platform) {
    let PlatformApi;
    try {
        // First try to load the platform API from the platform project
        // This is necessary to support older platform API versions
        PlatformApi = exports.requireNoCache(dir);
    } catch (loadFromDirError) {
        events.emit('verbose', `Unable to load Platform API from ${dir}:`);
        events.emit('verbose', CordovaError.fullStack(loadFromDirError));

        const cdvPlatform = platform.replace(/^(?:cordova-)?/, 'cordova-');
        try {
            // Load the platform API directly from node_modules
            PlatformApi = require(cdvPlatform);
        } catch (loadByNameError) {
            events.emit('verbose', `Unable to load module ${cdvPlatform} by name:`);
            events.emit('verbose', CordovaError.fullStack(loadByNameError));

            throw new CordovaError(`Could not load API for ${platform} project ${dir}`);
        }
    }

    // Module doesn't implement the expected interface
    if (!PlatformApi || !PlatformApi.createPlatform) {
        throw new Error(`The package at "${dir}" does not appear to implement the Cordova Platform API.`);
    }

    events.emit('verbose', `Loaded API for ${platform} project ${dir}`);
    return PlatformApi;
}
