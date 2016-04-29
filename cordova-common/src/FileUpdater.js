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

"use strict";

var fs = require("fs");
var path = require("path");
var shell = require("shelljs");
var minimatch = require("minimatch");

var isWindows = (process.platform === "win32");
var child_process = (isWindows ? require("child_process") : null);

/**
 * Logging callback used in the FileUpdater methods.
 * @callback loggingCallback
 * @param {string} message A message describing a single file update operation.
 */

/**
 * Updates a target file or directory with a source file or directory. (Directory updates are
 * not recursive.) Stats for target and source items must be passed in. This is an internal
 * helper function used by other methods in this module.
 *
 * @param {?string} sourcePath Source file or directory to be used to update the
 *     destination. If the source is null, then the destination is deleted if it exists.
 * @param {?fs.Stats} sourceStats An instance of fs.Stats for the source path, or null if
 *     the source does not exist.
 * @param {string} targetPath Required destination file or directory to be updated. If it does
 *     not exist, it will be created.
 * @param {?fs.Stats} targetStats An instance of fs.Stats for the target path, or null if
 *     the target does not exist.
 * @param {Object} [options] Optional additional parameters for the update.
 * @param {string} [options.rootDir] Optional root directory (such as a project) to which target
 *     and source path parameters are relative; may be omitted if the paths are absolute. The
 *     rootDir is always omitted from any logged paths, to make the logs easier to read.
 * @param {boolean} [options.all] If true, all files are copied regardless of last-modified times.
 * @param {boolean} [options.newer] If true (and all is not specified), only files with newer
 *     last-modified times are copied. By default, only files with different times are copied.
 * @param {loggingCallback} [log] Optional logging callback that takes a string message
 *     describing any file operations that are performed.
 * @param {Object} context Context object for tracking file operations.
 * @return {boolean} true if any changes were made, or false if the force flag is not set
 *     and everything was up to date
 */
function updatePathWithStats(
        sourcePath, sourceStats, targetPath, targetStats, options, log, context) {
    var updated = false;

    var rootDir = (options && options.rootDir) || "";
    var copyAll = (options && options.all) || false;
    var copyNewer = (options && options.newer) || false;

    var targetFullPath = path.join(rootDir || "", targetPath);

    if (sourceStats) {
        var sourceFullPath = path.join(rootDir || "", sourcePath);

        if (targetStats) {
            // The target exists. But if the directory status doesn't match the source, delete it.
            if (targetStats.isDirectory() && !sourceStats.isDirectory()) {
                log("rmdir  " + targetPath + " (source is a file)");
                shell.rm("-rf", targetFullPath);
                targetStats = null;
                updated = true;
            } else if (!targetStats.isDirectory() && sourceStats.isDirectory()) {
                log("delete " + targetPath + " (source is a directory)");
                shell.rm("-f", targetFullPath);
                targetStats = null;
                updated = true;
            }
        }

        if (!targetStats) {
            if (sourceStats.isDirectory()) {
                // The target directory does not exist, so it should be created.
                log("mkdir " + targetPath);
                shell.mkdir("-p", targetFullPath);
                updated = true;
            } else if (sourceStats.isFile()) {
                // The target file does not exist, so it should be copied from the source.
                log("copy  " + sourcePath + " " + targetPath + (copyAll ? "" : " (new file)"));
                copyFileWithTime(context, sourceFullPath, sourceStats, targetFullPath);
                updated = true;
            }
        } else if (sourceStats.isFile() && targetStats.isFile()) {
            // The source and target paths both exist and are files.
            if (copyAll) {
                // The caller specified all files should be copied.
                log("copy  " + sourcePath + " " + targetPath);
                copyFileWithTime(context, sourceFullPath, sourceStats, targetFullPath);
                updated = true;
            } else {
                // Copying should depend on comparison of the files' last-modified times.
                var sourceTime = sourceStats.mtime.getTime();
                var targetTime = targetStats.mtime.getTime();

                if (copyNewer && sourceTime > targetTime) {
                    // The caller specified only newer files should be copied, and the file is newer.
                    log("copy  " + sourcePath + " " + targetPath + " (newer file)");
                    copyFileWithTime(context, sourceFullPath, sourceStats, targetFullPath);
                    updated = true;
                } else if (!copyNewer && sourceTime !== targetTime) {
                    // The caller specified only different files should be copied, and
                    // the file has a different time; report either newer or older.
                    log("copy  " + sourcePath + " " + targetPath +
                        (sourceTime > targetTime ? " (newer file)" : " (older file)"));
                    copyFileWithTime(context, sourceFullPath, sourceStats, targetFullPath);
                    updated = true;
                }
            }
        }
    } else if (targetStats) {
        // The target exists but the source is null, so the target should be deleted.
        if (targetStats.isDirectory()) {
            log("rmdir  " + targetPath + (copyAll ? "" : " (no source)"));
            shell.rm("-rf", targetFullPath);
        } else {
            log("delete " + targetPath + (copyAll ? "" : " (no source)"));
            shell.rm("-f", targetFullPath);
        }
        updated = true;
    }

    return updated;
}

/**
 * Helper for updatePath and updatePaths functions. Queries stats for source and target
 * and ensures target directory exists before copying a file.
 */
function updatePathInternal(sourcePath, targetPath, options, log, context) {
    var rootDir = (options && options.rootDir) || "";
    var targetFullPath = path.join(rootDir, targetPath);
    var targetStats = fs.existsSync(targetFullPath) ? fs.statSync(targetFullPath) : null;
    var sourceStats = null;

    if (sourcePath) {
        // A non-null source path was specified. It should exist.
        var sourceFullPath = path.join(rootDir, sourcePath);
        if (!fs.existsSync(sourceFullPath)) {
            throw new Error("Source path does not exist: " + sourcePath);
        }

        sourceStats = fs.statSync(sourceFullPath);

        // Create the target's parent directory if it doesn't exist.
        var parentDir = path.dirname(targetFullPath);
        if (!fs.existsSync(parentDir)) {
            shell.mkdir("-p", parentDir);
        }
    }

    return updatePathWithStats(
        sourcePath, sourceStats, targetPath, targetStats, options, log, context);
}

/**
 * Updates a target file or directory with a source file or directory. (Directory updates are
 * not recursive.)
 *
 * @param {?string} sourcePath Source file or directory to be used to update the
 *     destination. If the source is null, then the destination is deleted if it exists.
 * @param {string} targetPath Required destination file or directory to be updated. If it does
 *     not exist, it will be created.
 * @param {Object} [options] Optional additional parameters for the update.
 * @param {string} [options.rootDir] Optional root directory (such as a project) to which target
 *     and source path parameters are relative; may be omitted if the paths are absolute. The
 *     rootDir is always omitted from any logged paths, to make the logs easier to read.
 * @param {boolean} [options.all] If true, all files are copied regardless of last-modified times.
 * @param {boolean} [options.newer] If true (and all is not specified), only files with newer
 *     last-modified times are copied. By default, only files with different times are copied.
 * @param {loggingCallback} [log] Optional logging callback that takes a string message
 *     describing any file operations that are performed.
 * @return {boolean} true if any changes were made, or false if the force flag is not set
 *     and everything was up to date
 */
function updatePath(sourcePath, targetPath, options, log) {
    if (sourcePath !== null && typeof sourcePath !== "string") {
        throw new Error("A source path (or null) is required.");
    }

    if (!targetPath || typeof targetPath !== "string") {
        throw new Error("A target path is required.");
    }

    log = log || function(message) { };

    var context = beginFileOperations();
    var updated = updatePathInternal(sourcePath, targetPath, options, log, context);
    endFileOperations(context, log);
    return updated;
}

/**
 * Updates files and directories based on a mapping from target paths to source paths. Targets
 * with null sources in the map are deleted.
 *
 * @param {Object} pathMap A dictionary mapping from target paths to source paths.
 * @param {Object} [options] Optional additional parameters for the update.
 * @param {string} [options.rootDir] Optional root directory (such as a project) to which target
 *     and source path parameters are relative; may be omitted if the paths are absolute. The
 *     rootDir is always omitted from any logged paths, to make the logs easier to read.
 * @param {boolean} [options.all] If true, all files are copied regardless of last-modified times.
 * @param {boolean} [options.newer] If true (and all is not specified), only files with newer
 *     last-modified times are copied. By default, only files with different times are copied.
 * @param {loggingCallback} [log] Optional logging callback that takes a string message
 *     describing any file operations that are performed.
 * @return {boolean} true if any changes were made, or false if the force flag is not set
 *     and everything was up to date
 */
function updatePaths(pathMap, options, log) {
    if (!pathMap || typeof pathMap !== "object" || Array.isArray(pathMap)) {
        throw new Error("An object mapping from target paths to source paths is required.");
    }

    log = log || function(message) { };

    var updated = false;
    var context = beginFileOperations();

    // Iterate in sorted order to ensure directories are created before files under them.
    Object.keys(pathMap).sort().forEach(function (targetPath) {
        var sourcePath = pathMap[targetPath];
        updated = updatePathInternal(sourcePath, targetPath, options, log, context) || updated;
    });

    endFileOperations(context, log);
    return updated;
}

/**
 * Updates a target directory with merged files and subdirectories from source directories.
 *
 * @param {string|string[]} sourceDirs Required source directory or array of source directories
 *     to be merged into the target. The directories are listed in order of precedence; files in
 *     directories later in the array supersede files in directories earlier in the array
 *     (regardless of timestamps).
 * @param {string} targetDir Required destination directory to be updated. If it does not exist,
 *     it will be created. If it exists, newer files from source directories will be copied over,
 *     and files missing in the source directories will be deleted.
 * @param {Object} [options] Optional additional parameters for the update.
 * @param {string} [options.rootDir] Optional root directory (such as a project) to which target
 *     and source path parameters are relative; may be omitted if the paths are absolute. The
 *     rootDir is always omitted from any logged paths, to make the logs easier to read.
 * @param {boolean} [options.all] If true, all files are copied regardless of last-modified times.
 * @param {boolean} [options.newer] If true (and all is not specified), only files with newer
 *     last-modified times are copied. By default, only files with different times are copied.
 * @param {string|string[]} [options.include] Optional glob string or array of glob strings that
 *     are tested against both target and source relative paths to determine if they are included
 *     in the merge-and-update. If unspecified, all items are included.
 * @param {string|string[]} [options.exclude] Optional glob string or array of glob strings that
 *     are tested against both target and source relative paths to determine if they are excluded
 *     from the merge-and-update. Exclusions override inclusions. If unspecified, no items are
 *     excluded.
 * @param {loggingCallback} [log] Optional logging callback that takes a string message
 *     describing any file operations that are performed.
 * @return {boolean} true if any changes were made, or false if the force flag is not set
 *     and everything was up to date
 */
function mergeAndUpdateDir(sourceDirs, targetDir, options, log) {
    if (sourceDirs && typeof sourceDirs === "string") {
        sourceDirs = [ sourceDirs ];
    } else if (!Array.isArray(sourceDirs)) {
        throw new Error("A source directory path or array of paths is required.");
    }

    if (!targetDir || typeof targetDir !== "string") {
        throw new Error("A target directory path is required.");
    }

    log = log || function(message) { };

    var rootDir = (options && options.rootDir) || "";

    var include = (options && options.include) || [ "**" ];
    if (typeof include === "string") {
        include = [ include ];
    } else if (!Array.isArray(include)) {
        throw new Error("Include parameter must be a glob string or array of glob strings.");
    }

    var exclude = (options && options.exclude) || [];
    if (typeof exclude === "string") {
        exclude = [ exclude ];
    } else if (!Array.isArray(exclude)) {
        throw new Error("Exclude parameter must be a glob string or array of glob strings.");
    }

    // Scan the files in each of the source directories.
    var sourceMaps = [];
    for (var i in sourceDirs) {
        var sourceFullPath = path.join(rootDir, sourceDirs[i]);
        if (!fs.existsSync(sourceFullPath)) {
            throw new Error("Source directory does not exist: " + sourceDirs[i]);
        }
        sourceMaps[i] = mapDirectory(rootDir, sourceDirs[i], include, exclude);
    }

    // Scan the files in the target directory, if it exists.
    var targetMap = {};
    var targetFullPath = path.join(rootDir, targetDir);
    if (fs.existsSync(targetFullPath)) {
        targetMap = mapDirectory(rootDir, targetDir, include, exclude);
    }

    var pathMap = mergePathMaps(sourceMaps, targetMap, targetDir);

    var updated = false;
    var context = beginFileOperations();

    // Iterate in sorted order to ensure directories are created before files under them.
    Object.keys(pathMap).sort().forEach(function (subPath) {
        var entry = pathMap[subPath];
        updated = updatePathWithStats(
            entry.sourcePath,
            entry.sourceStats,
            entry.targetPath,
            entry.targetStats,
            options,
            log,
            context) || updated;
    });

    endFileOperations(context, log);
    return updated;
}

/**
 * Creates a dictionary map of all files and directories under a path.
 */
function mapDirectory(rootDir, subDir, include, exclude) {
    var dirMap = { "": { subDir: subDir, stats: fs.statSync(path.join(rootDir, subDir)) } };
    mapSubdirectory(rootDir, subDir, "", include, exclude, dirMap);
    return dirMap;

    function mapSubdirectory(rootDir, subDir, relativeDir, include, exclude, dirMap) {
        var itemMapped = false;
        var items = fs.readdirSync(path.join(rootDir, subDir, relativeDir));
        for (var i in items) {
            var relativePath = path.join(relativeDir, items[i]);

            // Skip any files or directories (and everything under) that match an exclude glob.
            if (matchGlobArray(relativePath, exclude)) {
                continue;
            }

            // Stats obtained here (required at least to know where to recurse in directories)
            // are saved for later, where the modified times may also be used. This minimizes
            // the number of file I/O operations performed.
            var fullPath = path.join(rootDir, subDir, relativePath);
            var stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                // Directories are included if either something under them is included or they
                // match an include glob.
                if (mapSubdirectory(rootDir, subDir, relativePath, include, exclude, dirMap) ||
                        matchGlobArray(relativePath, include)) {
                    dirMap[relativePath] = { subDir: subDir, stats: stats };
                    itemMapped = true;
                }
            } else if (stats.isFile()) {
                // Files are included only if they match an include glob.
                if (matchGlobArray(relativePath, include)) {
                    dirMap[relativePath] = { subDir: subDir, stats: stats };
                    itemMapped = true;
                }
            }
        }
        return itemMapped;
    }

    function matchGlobArray(path, globs) {
        for (var i in globs) {
            if (minimatch(path, globs[i])) {
                return true;
            }
        }
        return false;
    }
}

/**
 * Merges together multiple source maps and a target map into a single mapping from
 * relative paths to objects with target and source paths and stats.
 */
function mergePathMaps(sourceMaps, targetMap, targetDir) {
    // Merge multiple source maps together, along with target path info.
    // Entries in later source maps override those in earlier source maps.
    // Target stats will be filled in below for targets that exist.
    var pathMap = {};
    sourceMaps.forEach(function (sourceMap) {
        for (var sourceSubPath in sourceMap) {
            var sourceEntry = sourceMap[sourceSubPath];
            pathMap[sourceSubPath] = {
                targetPath: path.join(targetDir, sourceSubPath),
                targetStats: null,
                sourcePath: path.join(sourceEntry.subDir, sourceSubPath),
                sourceStats: sourceEntry.stats
            };
        }
    });

    // Fill in target stats for targets that exist, and create entries
    // for targets that don't have any corresponding sources.
    for (var subPath in targetMap) {
        var entry = pathMap[subPath];
        if (entry) {
            entry.targetStats = targetMap[subPath].stats;
        } else {
            pathMap[subPath] = {
                targetPath: path.join(targetDir, subPath),
                targetStats: targetMap[subPath].stats,
                sourcePath: null,
                sourceStats: null
            };
        }
    }

    return pathMap;
}

/**
 * Copy a file along with its last-access and last-modified times from source to target.
 */
function copyFileWithTime(context, sourceFilePath, sourceStats, targetFilePath) {
    if (isWindows) {
        // Windows requires a different approach to copying file times due to a nodejs bug.
        // The files will be copied later by a cmd script.
        context.fileCopies.push({ source: sourceFilePath, target: targetFilePath });
    } else {
        shell.cp("-f", sourceFilePath, targetFilePath);

        // The shelljs.cp() function doesn't copy the last-modified time.
        fs.utimesSync(targetFilePath, sourceStats.atime, sourceStats.mtime);
    }
}

/**
 * Called at the start of a batch of file operations.
 * @return {Object} A context object to be passed around to batch operations.
 */
function beginFileOperations() {
    if (isWindows) {
        return { fileCopies: [] };
    }

    return null;
}

/**
 * Called at the end of a batch of file operations.
 * @param {Object} context The object previously returned by beginFileOperations.
 * @param {loggingCallback} log Logging callback, used to report error details.
 */
function endFileOperations(context, log) {
    if (isWindows && context.fileCopies.length > 0) {
        // Nodejs (libuv) can only set file times on Windows with 1-second resolution,
        // even though it can read times with milllisecond resolution; see
        //  - https://github.com/nodejs/node/issues/2069
        //  - https://github.com/libuv/libuv/issues/800
        // The workaround here uses a cmd script to copy files on Windows.
        // When the fix becomes available this workaround should be removed.

        var cmdScript = "";
        context.fileCopies.forEach(function (fileCopy) {
            cmdScript += "copy /y \"" + fileCopy.source + "\" \"" + fileCopy.target + "\"\r\n";
        });

        var cmdResult = child_process.spawnSync("cmd.exe", ["/D", "/Q"], { input: cmdScript });
        if (cmdResult.status !== 0) {
            if (cmdResult.stderr) log(cmdResult.stderr);
            throw new Error("Failed to copy files.");
        }
    }
}

module.exports = {
    updatePath: updatePath,
    updatePaths: updatePaths,
    mergeAndUpdateDir: mergeAndUpdateDir
};

