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

/**
 * Updates a target file or directory with a source file or directory. (Directory updates are
 * not recursive.) Stats for target and source items must be passed in. This is an internal
 * helper function used by other methods in this module.
 *
 * @param {string|null} rootDir Root directory (such as a project) to which target and source
 *     path parameters are relative, or null if the paths are absolute. The rootDir is omitted
 *     from any logged paths, to make the logs easier to read.
 * @param {string} targetPath Destination file or directory to be updated. If it does not exist,
 *     it will be created.
 * @param {fs.Stats|null} targetStats An instance of fs.Stats for the target path, or null if
 *     the target does not exist.
 * @param {string|null} sourcePath Source file or directory to be used to update the
 *     destination. If the source is null, then the destination is deleted if it exists.
 * @param {fs.Stats|null} sourceStats An instance of fs.Stats for the source path, or null if
 *     the source does not exist.
 * @param {boolean} force If target and source are both files, and the force flag is not
 *     set, then the file will not be copied unless the source is newer than the target.
 * @param {function} [log] Optional logging callback that takes a string message describing any
 *     file operations that are performed.
 * @return {boolean} true if any changes were made, or false if the force flag is not set
 *     and everything was up to date
 */
function updatePathWithStats(
        rootDir, targetPath, targetStats, sourcePath, sourceStats, force, log) {
    log = log || function(message) { };
    var updated = false;

    var targetFullPath = path.join(rootDir || "", targetPath);

    if (sourceStats) {
        var sourceFullPath = path.join(rootDir || "", sourcePath);

        if (targetStats) {
            // The target exists. But if the directory status doesn't match the source, delete it.
            if (targetStats.isDirectory() && !sourceStats.isDirectory()) {
                log("rmdir " + targetPath + " (source is a file)");
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
                log("copy " + sourcePath + " " + targetPath +
                    (!force ? " (new file)" : ""));
                shell.cp("-f", sourceFullPath, targetFullPath);
                updated = true;
            }
        } else if (sourceStats.isFile() && targetStats.isFile() &&
                (force || sourceStats.mtime > targetStats.mtime)) {
            // When the source and target paths both exist and are files, update
            // the file if the source is newer or if doing a forced update.
            log("copy " + sourcePath + " " + targetPath +
                (!force ? " (updated file)" : ""));
            shell.cp("-f", sourceFullPath, targetFullPath);
            updated = true;
        }
    } else if (targetStats) {
        // The target exists but the source is null, so the target should be deleted.
        if (targetStats.isDirectory()) {
            log("rmdir " + targetPath + " (no source)");
            shell.rm("-rf", targetFullPath);
        } else {
            log("delete " + targetPath + " (no source)");
            shell.rm("-f", targetFullPath);
        }
        updated = true;
    }

    return updated;
}

/**
 * Updates a target file or directory with a source file or directory. (Directory updates are
 * not recursive.)
 *
 * @param {string|null} rootDir Root directory (such as a project) to which target and source
 *     path parameters are relative, or null if the paths are absolute. The rootDir is omitted
 *     from any logged paths, to make the logs easier to read.
 * @param {string} targetPath Destination file or directory to be updated. If it does not exist,
 *     it will be created.
 * @param {string|null} sourcePath Source file or directory to be used to update the
 *     destination. If the source is null, then the destination is deleted if it exists.
 * @param {boolean} force If target and source are both files, and the force flag is not
 *     set, then the file will not be copied unless the source is newer than the target.
 * @param {function} [log] Optional logging callback that takes a string message describing any
 *     file operations that are performed.
 * @return {boolean} true if any changes were made, or false if the force flag is not set
 *     and everything was up to date
 */
function updatePath(rootDir, targetPath, sourcePath, force, log) {
    rootDir = rootDir || "";
    if (typeof(rootDir) !== "string") {
        throw new Error("A root directory path is required.");
    }

    if (!targetPath || typeof(targetPath) !== "string") {
        throw new Error("A target path is required.");
    }

    if (sourcePath && typeof(sourcePath) !== "string") {
        throw new Error("A source path (or null) is required.");
    }

    log = log || function(message) { };

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
        rootDir, targetPath, targetStats, sourcePath, sourceStats, force, log);
}

/**
 * Updates files and directories based on a mapping from target paths to source paths. Targets
 * with null sources in the map are deleted.
 *
 * @param {string|null} rootDir Root directory (such as a project) to which target and source
 *     path parameters are relative, or null if the paths are absolute. The rootDir is omitted
 *     from any logged paths, to make the logs easier to read.
 * @param {object} pathMap A dictionary mapping from target paths to source paths.
 * @param {boolean} force If target and source are both files, and the force flag is not
 *     set, then the file will not be copied unless the source is newer than the target.
 * @param {function} [log] Optional logging callback that takes a string message describing any
 *     file operations that are performed.
 * @return {boolean} true if any changes were made, or false if the force flag is not set
 *     and everything was up to date
 */
function updatePaths(rootDir, pathMap, force, log) {
    if (!pathMap || typeof(pathMap) !== "object") {
        throw new Error("An object mapping from target paths to source paths is required.");
    }

    var updated = false;

    for (var targetPath in pathMap) {
        var sourcePath = pathMap[targetPath];
        updated = updatePath(rootDir, targetPath, sourcePath, force, log) || updated;
    }

    return updated;
}

/**
 * Updates a target directory with merged files and subdirectories from source directories.
 *
 * @param {string|null} rootDir Root directory (such as a project) to which target and source
 *     path parameters are relative, or null if the paths are absolute. The rootDir is omitted
 *     from any logged paths, to make the logs easier to read.
 * @param {string} targetDir Destination directory to be updated. If it does not exist, it will be
 *     created. If it exists, newer files from source directories will be copied over, and files
 *     missing in the source directories will be deleted.
 * @param {string|string[]} sourceDirs Source directory or array of source directories to be
 *     merged into the target. The directories are listed in order of precedence; files in
 *     directories later in the array supersede files in directories earlier in the array
 *     (regardless of timestamps).
 * @param {string|string[]|null} include Optional glob string or array of glob strings that are
 *     tested against both target and source relative paths to determine if they are include in
 *     the merge-and-update. If null, all items are included.
 * @param {string|string[]|null} exclude Optional glob string or array of glob strings that are
 *     tested against both target and source relative paths to determine if they are excluded
 *     from the merge-and-update. Exclusions override inclusions. If null, no items are excluded.
 * @param {boolean} force If target and source are both files, and the force flag is not
 *     set, then the file will not be copied unless the source is newer than the target.
 * @param {function} [log] Optional logging callback that takes a string message describing any
 *     file operations that are performed.
 * @return {boolean} true if any changes were made, or false if the force flag is not set
 *     and everything was up to date
 */
function mergeAndUpdateDir(rootDir, targetDir, sourceDirs, include, exclude, force, log) {
    rootDir = rootDir || "";
    if (typeof(rootDir) !== "string") {
        throw new Error("A root directory path (or null) is required.");
    }

    if (!targetDir || typeof(targetDir) !== "string") {
        throw new Error("A target directory path is required.");
    }

    if (typeof(sourceDirs) === "string") {
        sourceDirs = [ sourceDirs ];
    } else if (!Array.isArray(sourceDirs) || sourceDirs.length === 0) {
        throw new Error("A source directory path or array of paths is required.");
    }

    if (!include) {
        include = [ "**" ];
    } else if (typeof (include) === "string") {
        include = [ include ];
    } else if (!Array.isArray(include)) {
        throw new Error("Include parameter must be a glob string or array of glob strings.");
    }

    if (!exclude) {
        exclude = [];
    } else if (typeof (exclude) === "string") {
        exclude = [ exclude ];
    } else if (!Array.isArray(exclude)) {
        throw new Error("Exclude parameter must be a glob string or array of glob strings.");
    }

    // Scan the files in the target directory, if it exists.
    var targetMap = {};
    var targetFullPath = path.join(rootDir, targetDir);
    if (fs.existsSync(targetFullPath)) {
        targetMap = mapDirectory(rootDir, targetDir, include, exclude);
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

    var pathMap = mergePathMaps(targetDir, targetMap, sourceMaps);

    var updated = false;

    // Iterate in sorted order to ensure directories are created before files under them.
    Object.keys(pathMap).sort().forEach(function (subPath) {
        var entry = pathMap[subPath];
        updated = updatePathWithStats(
            rootDir,
            entry.targetPath,
            entry.targetStats,
            entry.sourcePath,
            entry.sourceStats,
            force,
            log) || updated;
    });

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

            // Directories are included if either something under them is included or they
            // match an include glob. Files are included only if they match an include glob.
            if (stats.isDirectory() ?
                    (mapSubdirectory(rootDir, subDir, relativePath, include, exclude, dirMap) ||
                        matchGlobArray(relativePath, include)) :
                    (stats.isFile() && matchGlobArray(relativePath, include))) {
                dirMap[relativePath] = { subDir: subDir, stats: stats };
                itemMapped = true;
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
function mergePathMaps(targetDir, targetMap, sourceMaps) {
    // Merge multiple source maps together, along with target path info.
    // Entries in later source maps override those in earlier source maps.
    // Target stats will be filled in below for targets that exist.
    var pathMap = {};
    for (var i in sourceMaps) {
        var sourceMap = sourceMaps[i];
        for (var sourceSubPath in sourceMap) {
            var sourceEntry = sourceMap[sourceSubPath];
            pathMap[sourceSubPath] = {
                targetPath: path.join(targetDir, sourceSubPath),
                targetStats: null,
                sourcePath: path.join(sourceEntry.subDir, sourceSubPath),
                sourceStats: sourceEntry.stats
            };
        }
    }

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

module.exports = {
    updatePath: updatePath,
    updatePaths: updatePaths,
    mergeAndUpdateDir: mergeAndUpdateDir
};

