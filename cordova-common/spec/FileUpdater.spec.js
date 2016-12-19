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

var path = require('path');
var rewire = require('rewire');
var FileUpdater = rewire('../src/FileUpdater');

// Normally these are internal to the module; these lines use rewire to expose them for testing.
FileUpdater.mapDirectory = FileUpdater.__get__('mapDirectory');
FileUpdater.mergePathMaps = FileUpdater.__get__('mergePathMaps');
FileUpdater.updatePathWithStats = FileUpdater.__get__('updatePathWithStats');

// Intercept calls to the internal updatePathWithStats function,
// so calling methods can be tested in isolation.
FileUpdater.updatePathWithStatsCalls = [];
FileUpdater.updatePathWithStatsResult = true;
FileUpdater.__set__('updatePathWithStats', function () {
    FileUpdater.updatePathWithStatsCalls.push(arguments);
    return FileUpdater.updatePathWithStatsResult;
});

// Create mock fs.Stats to simulate file or directory attributes.
function mockFileStats(modified) {
    return {
        isFile: function () { return true; },
        isDirectory: function () { return false; },
        ctime: modified,
        mtime: modified,
    };
}
function mockDirStats() {
    return {
        isFile: function () { return false; },
        isDirectory: function () { return true; },
        ctime: null,
        mtime: null,
    };
}

// Create a mock to replace the fs and shelljs modules used by the FileUpdater,
// so the tests don't have to actually touch the filesystem.
var mockFs = {
    mkdirPaths: [],
    cpPaths: [],
    rmPaths: [],
    dirMap: {},
    statMap: {},

    reset: function () {
        this.mkdirPaths = [];
        this.cpPaths = [];
        this.rmPaths = [];
        this.dirMap = {};
        this.statMap = {};
    },

    existsSync: function (fileOrDirPath) {
        return typeof(this.statMap[fileOrDirPath]) !== 'undefined';
    },

    readdirSync: function(dirPath) {
        var result = this.dirMap[dirPath];
        if (!result) throw new Error('Directory path not found: ' + dirPath);
        return result;
    },

    statSync: function (fileOrDirPath) {
        var result = this.statMap[fileOrDirPath];
        if (!result) throw new Error('File or directory path not found: ' + fileOrDirPath);
        return result;
    },

    mkdir: function (flags, path) {
        this.mkdirPaths.push(path);
    },

    cp: function (flags, sourcePath, targetPath) {
        this.cpPaths.push([sourcePath, targetPath]);
    },

    rm: function(flags, path) {
        this.rmPaths.push(path);
    },
};
FileUpdater.__set__('fs', mockFs);
FileUpdater.__set__('shell', mockFs);

// Define some constants used in the test cases.
var testRootDir = 'testRootDir';
var testSourceDir = 'testSourceDir';
var testSourceDir2 = 'testSourceDir2';
var testSourceDir3 = 'testSourceDir3';
var testTargetDir = 'testTargetDir';
var testSourceFile = 'testSourceFile';
var testSourceFile2 = 'testSourceFile2';
var testTargetFile = 'testTargetFile';
var testTargetFile2 = 'testTargetFile2';
var testSubDir = 'testSubDir';
var now = new Date();
var oneHourAgo = new Date(now.getTime() - 1*60*60*1000);
var testDirStats = mockDirStats();
var testFileStats = mockFileStats(now);
var testFileStats2 = mockFileStats(now);
var testFileStats3 = mockFileStats(now);
var nullLogger = function (message) {};

describe('FileUpdater class', function() {

    beforeEach(function () {
        FileUpdater.updatePathWithStatsCalls = [];
        FileUpdater.updatePathWithStatsResult = true;
        mockFs.reset();
    });

    describe('updatePathWithStats method', function () {
        it('Test 001 : should do nothing when a directory exists at source and target', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceDir, mockDirStats(), testTargetDir, mockDirStats(),
                null, nullLogger);
            expect(updated).toBe(false);
            expect(mockFs.mkdirPaths.length).toBe(0);
            expect(mockFs.rmPaths.length).toBe(0);
        });
        it('Test 002 : should create a directory that exists at source and not at target', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceDir, mockDirStats(), testTargetDir, null,
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.mkdirPaths.length).toBe(1);
            expect(mockFs.rmPaths.length).toBe(0);
            expect(mockFs.mkdirPaths[0]).toBe(testTargetDir);
        });
        it('Test 003 : should remove a directory that exists at target and not at source', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceDir, null, testTargetDir, mockDirStats(),
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.mkdirPaths.length).toBe(0);
            expect(mockFs.rmPaths.length).toBe(1);
            expect(mockFs.rmPaths[0]).toBe(testTargetDir);
        });

        it('Test 004 : should copy when a file exists at source and target and times are the same',
                function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(now), testTargetFile, mockFileStats(now),
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.cpPaths.length).toBe(1);
            expect(mockFs.rmPaths.length).toBe(0);
            expect(mockFs.cpPaths[0]).toEqual([testSourceFile, testTargetFile]);
        });
        it('Test 005 : should copy when a file exists at source and target and target is older',
                function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(now), testTargetFile, mockFileStats(oneHourAgo),
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.cpPaths.length).toBe(1);
            expect(mockFs.rmPaths.length).toBe(0);
            expect(mockFs.cpPaths[0]).toEqual([testSourceFile, testTargetFile]);
        });
        it('Test 006 : should do nothing when a file exists at source and target and target is newer',
                function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(oneHourAgo), testTargetFile, mockFileStats(now),
                null, nullLogger);
            expect(updated).toBe(false);
            expect(mockFs.cpPaths.length).toBe(0);
            expect(mockFs.rmPaths.length).toBe(0);
        });
        it('Test 007 : should copy when a file exists at source and target and forcing update', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(now), testTargetFile, mockFileStats(now),
                { all: true }, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.cpPaths.length).toBe(1);
            expect(mockFs.rmPaths.length).toBe(0);
            expect(mockFs.cpPaths[0]).toEqual([testSourceFile, testTargetFile]);
        });
        it('Test 008 : should copy when a file exists at source and target and target is newer ' +
                'and forcing update', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(oneHourAgo), testTargetFile, mockFileStats(now),
                { all: true }, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.cpPaths.length).toBe(1);
            expect(mockFs.rmPaths.length).toBe(0);
            expect(mockFs.cpPaths[0]).toEqual([testSourceFile, testTargetFile]);
        });
        it('Test 009 : should copy when a file exists at source and target and source is newer', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(now), testTargetFile, mockFileStats(oneHourAgo),
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.cpPaths.length).toBe(1);
            expect(mockFs.rmPaths.length).toBe(0);
            expect(mockFs.cpPaths[0]).toEqual([testSourceFile, testTargetFile]);
        });
        it('Test 010 : should copy when a file exists at source and not at target', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(now), testTargetFile, null,
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.cpPaths.length).toBe(1);
            expect(mockFs.rmPaths.length).toBe(0);
            expect(mockFs.cpPaths[0]).toEqual([testSourceFile, testTargetFile]);
        });
        it('Test 011 : should remove when a file exists at target and not at source', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, null, testTargetFile, mockFileStats(now),
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.cpPaths.length).toBe(0);
            expect(mockFs.rmPaths.length).toBe(1);
            expect(mockFs.rmPaths[0]).toBe(testTargetFile);
        });

        it('Test 012 : should remove and mkdir when source is a directory and target is a file', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceDir, mockDirStats(), testTargetDir, mockFileStats(now),
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.cpPaths.length).toBe(0);
            expect(mockFs.rmPaths.length).toBe(1);
            expect(mockFs.mkdirPaths.length).toBe(1);
            expect(mockFs.rmPaths[0]).toBe(testTargetDir);
            expect(mockFs.mkdirPaths[0]).toBe(testTargetDir);
        });
        it('Test 013 : should remove and copy when source is a file and target is a directory', function () {
            var updated = FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(now), testTargetFile, mockDirStats(),
                null, nullLogger);
            expect(updated).toBe(true);
            expect(mockFs.rmPaths.length).toBe(1);
            expect(mockFs.cpPaths.length).toBe(1);
            expect(mockFs.mkdirPaths.length).toBe(0);
            expect(mockFs.rmPaths[0]).toBe(testTargetFile);
            expect(mockFs.cpPaths[0]).toEqual([testSourceFile, testTargetFile]);
        });

        it('Test 014 : should join the paths when a rootDir is specified', function () {
            FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(now), testTargetFile, null,
                { rootDir: testRootDir }, nullLogger);
            expect(mockFs.cpPaths.length).toBe(1);
            expect(mockFs.rmPaths.length).toBe(0);
            expect(mockFs.cpPaths[0]).toEqual(
                [path.join(testRootDir, testSourceFile), path.join(testRootDir, testTargetFile)]);
        });

        it('Test 015 : should log dir creation', function () {
            var loggedSource = 0;
            var loggedTarget = 0;
            var loggedRoot = 0;
            FileUpdater.updatePathWithStats(
                testSourceDir, mockDirStats(now), testTargetDir, null, { rootDir: testRootDir },
                function (message) {
                    loggedSource += new RegExp(testSourceDir).test(message) ? 1 : 0;
                    loggedTarget += new RegExp(testTargetDir).test(message) ? 1 : 0;
                    loggedRoot += new RegExp(testRootDir).test(message) ? 1 : 0;
                });
            expect(loggedSource).toBe(0);
            expect(loggedTarget).toBe(1);
            expect(loggedRoot).toBe(0);
        });
        it('Test 016 : should log dir removal', function () {
            var loggedSource = 0;
            var loggedTarget = 0;
            var loggedRoot = 0;
            FileUpdater.updatePathWithStats(
                testSourceDir, null, testTargetDir, mockDirStats(now), { rootDir: testRootDir },
                function (message) {
                    loggedSource += new RegExp(testSourceDir).test(message) ? 1 : 0;
                    loggedTarget += new RegExp(testTargetDir).test(message) ? 1 : 0;
                    loggedRoot += new RegExp(testRootDir).test(message) ? 1 : 0;
                });
            expect(loggedSource).toBe(0);
            expect(loggedTarget).toBe(1);
            expect(loggedRoot).toBe(0);
        });
        it('Test 017 : should log file copy', function () {
            var loggedSource = 0;
            var loggedTarget = 0;
            var loggedRoot = 0;
            FileUpdater.updatePathWithStats(
                testSourceFile, mockFileStats(now), testTargetFile, null, { rootDir: testRootDir },
                function (message) {
                    loggedSource += new RegExp(testSourceFile).test(message) ? 1 : 0;
                    loggedTarget += new RegExp(testTargetFile).test(message) ? 1 : 0;
                    loggedRoot += new RegExp(testRootDir).test(message) ? 1 : 0;
                });
            expect(loggedSource).toBe(1);
            expect(loggedTarget).toBe(1);
            expect(loggedRoot).toBe(0);
        });
        it('Test 018: should log file removal', function () {
            var loggedSource = 0;
            var loggedTarget = 0;
            var loggedRoot = 0;
            var messages = [];
            FileUpdater.updatePathWithStats(
                testSourceFile, null, testTargetFile, mockFileStats(now), { rootDir: testRootDir },
                function (message) {
                    loggedSource += new RegExp(testSourceFile).test(message) ? 1 : 0;
                    loggedTarget += new RegExp(testTargetFile).test(message) ? 1 : 0;
                    loggedRoot += new RegExp(testRootDir).test(message) ? 1 : 0;
                });
            expect(messages).toEqual([]);
            expect(loggedSource).toBe(0);
            expect(loggedTarget).toBe(1);
            expect(loggedRoot).toBe(0);
        });
    });

    describe('mapDirectory method', function () {
        it('Test 019 : should map an empty directory', function () {
            mockFs.statMap[path.join(testRootDir, testSourceDir)] = testDirStats;
            mockFs.dirMap[path.join(testRootDir, testSourceDir)] = [];
            var dirMap = FileUpdater.mapDirectory(testRootDir, testSourceDir, ['**'], []);
            expect(Object.keys(dirMap)).toEqual(['']);
            expect(dirMap[''].subDir).toBe(testSourceDir);
            expect(dirMap[''].stats).toBe(testDirStats);
        });
        it('Test 020 : should map a directory with a file', function () {
            mockFs.statMap[path.join(testRootDir, testSourceDir)] = testDirStats;
            mockFs.dirMap[path.join(testRootDir, testSourceDir)] = [testSourceFile];
            mockFs.statMap[path.join(testRootDir, testSourceDir, testSourceFile)] = testFileStats;
            var dirMap = FileUpdater.mapDirectory(testRootDir, testSourceDir, ['**'], []);
            expect(Object.keys(dirMap).sort()).toEqual(['', testSourceFile]);
            expect(dirMap[''].subDir).toBe(testSourceDir);
            expect(dirMap[''].stats).toBe(testDirStats);
            expect(dirMap[testSourceFile].subDir).toBe(testSourceDir);
            expect(dirMap[testSourceFile].stats).toBe(testFileStats);
        });
        it('Test 021 : should map a directory with a subdirectory', function () {
            mockFs.statMap[testSourceDir] = testDirStats;
            mockFs.dirMap[testSourceDir] = [testSubDir];
            mockFs.statMap[path.join(testSourceDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(testSourceDir, testSubDir)] = [];
            var dirMap = FileUpdater.mapDirectory('', testSourceDir, ['**'], []);
            expect(Object.keys(dirMap).sort()).toEqual(['', testSubDir]);
            expect(dirMap[''].subDir).toBe(testSourceDir);
            expect(dirMap[''].stats).toBe(testDirStats);
            expect(dirMap[testSubDir].subDir).toBe(testSourceDir);
            expect(dirMap[testSubDir].stats).toBe(testDirStats);
        });
        it('Test 022 : should map a directory with a file in a nested subdirectory', function () {
            mockFs.statMap[testSourceDir] = testDirStats;
            mockFs.dirMap[testSourceDir] = [testSubDir];
            mockFs.statMap[path.join(testSourceDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(testSourceDir, testSubDir)] = [testSubDir];
            mockFs.statMap[path.join(testSourceDir, testSubDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(testSourceDir, testSubDir, testSubDir)] = [testSourceFile];
            mockFs.statMap[path.join(testSourceDir, testSubDir, testSubDir, testSourceFile)] =
                testFileStats;
            var dirMap = FileUpdater.mapDirectory('', testSourceDir, ['**'], []);
            expect(Object.keys(dirMap).sort()).toEqual([
                '',
                testSubDir,
                path.join(testSubDir, testSubDir),
                path.join(testSubDir, testSubDir, testSourceFile)]);
            expect(dirMap[''].subDir).toBe(testSourceDir);
            expect(dirMap[''].stats).toBe(testDirStats);
            expect(dirMap[testSubDir].subDir).toBe(testSourceDir);
            expect(dirMap[testSubDir].stats).toBe(testDirStats);
            expect(dirMap[path.join(testSubDir, testSubDir)].subDir).toBe(testSourceDir);
            expect(dirMap[path.join(testSubDir, testSubDir)].stats).toBe(testDirStats);
            expect(dirMap[path.join(testSubDir, testSubDir, testSourceFile)].subDir).toBe(
                testSourceDir);
            expect(dirMap[path.join(testSubDir, testSubDir, testSourceFile)].stats).toBe(
                testFileStats);
        });

        it('Test 023 : should include files that match include globs', function () {
            mockFs.statMap[testSourceDir] = testDirStats;
            mockFs.dirMap[testSourceDir] = [testSourceFile, testSourceFile2];
            mockFs.statMap[path.join(testSourceDir, testSourceFile)] = testFileStats;
            mockFs.statMap[path.join(testSourceDir, testSourceFile2)] = testFileStats;
            var dirMap = FileUpdater.mapDirectory('', testSourceDir, [testSourceFile], []);
            expect(Object.keys(dirMap).sort()).toEqual(['', testSourceFile]);
            expect(dirMap[''].subDir).toBe(testSourceDir);
            expect(dirMap[''].stats).toBe(testDirStats);
            expect(dirMap[testSourceFile].subDir).toBe(testSourceDir);
            expect(dirMap[testSourceFile].stats).toBe(testFileStats);
        });
        it('Test 024 : should include files in a subdirectory that match include globs', function () {
            mockFs.statMap[testSourceDir] = testDirStats;
            mockFs.dirMap[testSourceDir] = [testSubDir];
            mockFs.statMap[path.join(testSourceDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(testSourceDir, testSubDir)] =
                [testSourceFile, testSourceFile2];
            mockFs.statMap[path.join(testSourceDir, testSubDir, testSourceFile)] = testFileStats;
            mockFs.statMap[path.join(testSourceDir, testSubDir, testSourceFile2)] = testFileStats;
            var dirMap = FileUpdater.mapDirectory('', testSourceDir, ['**/' + testSourceFile], []);
            expect(Object.keys(dirMap).sort()).toEqual([
                '',
                testSubDir,
                path.join(testSubDir, testSourceFile)]);
            expect(dirMap[''].subDir).toBe(testSourceDir);
            expect(dirMap[''].stats).toBe(testDirStats);
            expect(dirMap[path.join(testSubDir, testSourceFile)].subDir).toBe(testSourceDir);
            expect(dirMap[path.join(testSubDir, testSourceFile)].stats).toBe(testFileStats);
        });
        it('Test 025 : should exclude paths that match exclude globs', function () {
            mockFs.statMap[testSourceDir] = testDirStats;
            mockFs.dirMap[testSourceDir] = [testSourceFile, testSourceFile2];
            mockFs.statMap[path.join(testSourceDir, testSourceFile)] = testFileStats;
            mockFs.statMap[path.join(testSourceDir, testSourceFile2)] = testFileStats;
            var dirMap = FileUpdater.mapDirectory('', testSourceDir, ['**'], [testSourceFile2]);
            expect(Object.keys(dirMap).sort()).toEqual(['', testSourceFile]);
            expect(dirMap[''].subDir).toBe(testSourceDir);
            expect(dirMap[''].stats).toBe(testDirStats);
            expect(dirMap[testSourceFile].subDir).toBe(testSourceDir);
            expect(dirMap[testSourceFile].stats).toBe(testFileStats);
        });
        it('Test 026 : should exclude paths that match both exclude and include globs', function () {
            mockFs.statMap[testSourceDir] = testDirStats;
            mockFs.dirMap[testSourceDir] = [testSubDir];
            mockFs.statMap[path.join(testSourceDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(testSourceDir, testSubDir)] =
                [testSourceFile, testSourceFile2];
            mockFs.statMap[path.join(testSourceDir, testSubDir, testSourceFile)] = testFileStats;
            mockFs.statMap[path.join(testSourceDir, testSubDir, testSourceFile2)] = testFileStats;
            var dirMap = FileUpdater.mapDirectory(
                '', testSourceDir, ['**/' + testSourceFile], [testSubDir]);
            expect(Object.keys(dirMap).sort()).toEqual(['']);
            expect(dirMap[''].subDir).toBe(testSourceDir);
            expect(dirMap[''].stats).toBe(testDirStats);
        });
    });

    describe('mergePathMaps method', function () {
        var testTargetFileStats = mockFileStats(oneHourAgo);
        var testSourceFileStats = mockFileStats(now);
        var testSourceFileStats2 = mockFileStats(now);
        var testSourceFileStats3 = mockFileStats(now);
        it('Test 027 : should prepend the target directory on target paths', function () {
            var mergedPathMap = FileUpdater.mergePathMaps(
                [{
                    '': { subDir: testSourceDir, stats: testDirStats },
                    testTargetFile: { subDir: testSourceDir, stats: testSourceFileStats },
                }],
                {
                    '': { subDir: testTargetDir, stats: testDirStats },
                    testTargetFile: { subDir: testTargetDir, stats: testTargetFileStats },
                },
                testTargetDir);
            expect(Object.keys(mergedPathMap).sort()).toEqual(['', testTargetFile]);
            expect(mergedPathMap[''].targetPath).toBe(testTargetDir);
            expect(mergedPathMap[''].targetStats).toBe(testDirStats);
            expect(mergedPathMap[''].sourcePath).toBe(testSourceDir);
            expect(mergedPathMap[''].sourceStats).toBe(testDirStats);
            expect(mergedPathMap[testTargetFile].targetPath).toBe(
                path.join(testTargetDir, testTargetFile));
            expect(mergedPathMap[testTargetFile].targetStats).toBe(testTargetFileStats);
            expect(mergedPathMap[testTargetFile].sourcePath).toBe(
                path.join(testSourceDir, testTargetFile));
            expect(mergedPathMap[testTargetFile].sourceStats).toBe(testSourceFileStats);
        });
        it('Test 028 : should handle missing source files', function () {
            var mergedPathMap = FileUpdater.mergePathMaps(
                [{}],
                {
                    testTargetFile: { subDir: testTargetDir, stats: testTargetFileStats },
                },
                testTargetDir);
            expect(Object.keys(mergedPathMap).sort()).toEqual([testTargetFile]);
            expect(mergedPathMap[testTargetFile].targetPath).toBe(
                path.join(testTargetDir, testTargetFile));
            expect(mergedPathMap[testTargetFile].targetStats).toBe(testTargetFileStats);
            expect(mergedPathMap[testTargetFile].sourcePath).toBeNull();
            expect(mergedPathMap[testTargetFile].sourceStats).toBeNull();
        });
        it('Tets 029 : should handle missing target files', function () {
            var mergedPathMap = FileUpdater.mergePathMaps(
                [{
                    testTargetFile: { subDir: testSourceDir, stats: testSourceFileStats },
                }],
                {},
                testTargetDir);
            expect(Object.keys(mergedPathMap).sort()).toEqual([testTargetFile]);
            expect(mergedPathMap[testTargetFile].targetPath).toBe(
                path.join(testTargetDir, testTargetFile));
            expect(mergedPathMap[testTargetFile].targetStats).toBeNull();
            expect(mergedPathMap[testTargetFile].sourcePath).toBe(
                path.join(testSourceDir, testTargetFile));
            expect(mergedPathMap[testTargetFile].sourceStats).toBe(testSourceFileStats);
        });
        it('Test 030 : should merge three source maps', function () {
            var mergedPathMap = FileUpdater.mergePathMaps(
                [
                    {
                        '': { subDir: testSourceDir, stats: testDirStats },
                        testTargetFile: { subDir: testSourceDir, stats: testSourceFileStats },
                    },
                    {
                        '': { subDir: testSourceDir2, stats: testDirStats },
                        testTargetFile: { subDir: testSourceDir2, stats: testSourceFileStats2 },
                        testTargetFile2: { subDir: testSourceDir2, stats: testSourceFileStats2 },
                    },
                    {
                        '': { subDir: testSourceDir3, stats: testDirStats },
                        testTargetFile2: { subDir: testSourceDir3, stats: testSourceFileStats3 },
                    },
                ],
                {
                    '': { subDir: testTargetDir, stats: testDirStats },
                    testTargetFile: { subDir: testTargetDir, stats: testTargetFileStats },
                },
                testTargetDir);
            expect(Object.keys(mergedPathMap).sort()).toEqual(
                ['', testTargetFile, testTargetFile2]);
            expect(mergedPathMap[''].targetPath).toBe(testTargetDir);
            expect(mergedPathMap[''].targetStats).toBe(testDirStats);
            expect(mergedPathMap[''].sourcePath).toBe(testSourceDir3);
            expect(mergedPathMap[''].sourceStats).toBe(testDirStats);
            expect(mergedPathMap[testTargetFile].targetPath).toBe(
                path.join(testTargetDir, testTargetFile));
            expect(mergedPathMap[testTargetFile].targetStats).toBe(testTargetFileStats);
            expect(mergedPathMap[testTargetFile].sourcePath).toBe(
                path.join(testSourceDir2, testTargetFile));
            expect(mergedPathMap[testTargetFile].sourceStats).toBe(testSourceFileStats2);
            expect(mergedPathMap[testTargetFile2].targetPath).toBe(
                path.join(testTargetDir, testTargetFile2));
            expect(mergedPathMap[testTargetFile2].targetStats).toBeNull();
            expect(mergedPathMap[testTargetFile2].sourcePath).toBe(
                path.join(testSourceDir3, testTargetFile2));
            expect(mergedPathMap[testTargetFile2].sourceStats).toBe(testSourceFileStats3);
        });
    });

    describe('updatePath method', function () {
        it('Test 031 : should update a path', function () {
            mockFs.statMap[testRootDir] = testDirStats;
            mockFs.statMap[path.join(testRootDir, testTargetFile)] = testFileStats;
            mockFs.statMap[path.join(testRootDir, testSourceFile)] = testFileStats2;
            var updated = FileUpdater.updatePath(
                testSourceFile, testTargetFile, { rootDir: testRootDir, all: true });
            expect(updated).toBe(true);
            expect(FileUpdater.updatePathWithStatsCalls.length).toBe(1);
            expect(FileUpdater.updatePathWithStatsCalls[0][0]).toBe(testSourceFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][1]).toEqual(testFileStats2);
            expect(FileUpdater.updatePathWithStatsCalls[0][2]).toBe(testTargetFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][3]).toEqual(testFileStats);
            expect(FileUpdater.updatePathWithStatsCalls[0][4]).toEqual(
                {rootDir: testRootDir, all: true });
        });
        it('Test 032 : should update a path without a separate root directory', function () {
            mockFs.statMap[testTargetFile] = testFileStats;
            mockFs.statMap[testSourceFile] = testFileStats2;
            FileUpdater.updatePathWithStatsResult = false;
            var updated = FileUpdater.updatePath(testSourceFile, testTargetFile);
            expect(updated).toBe(false);
            expect(FileUpdater.updatePathWithStatsCalls.length).toBe(1);
            expect(FileUpdater.updatePathWithStatsCalls[0][0]).toBe(testSourceFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][1]).toEqual(testFileStats2);
            expect(FileUpdater.updatePathWithStatsCalls[0][2]).toBe(testTargetFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][3]).toEqual(testFileStats);
            expect(FileUpdater.updatePathWithStatsCalls[0][4]).toBeUndefined();
        });
        it('Test 033 : should update a path when the source doesn\'t exist', function () {
            mockFs.statMap[testTargetFile] = testFileStats;
            var updated = FileUpdater.updatePath(null, testTargetFile);
            expect(updated).toBe(true);
            expect(FileUpdater.updatePathWithStatsCalls.length).toBe(1);
            expect(FileUpdater.updatePathWithStatsCalls[0][0]).toBeNull();
            expect(FileUpdater.updatePathWithStatsCalls[0][1]).toBeNull();
            expect(FileUpdater.updatePathWithStatsCalls[0][2]).toBe(testTargetFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][3]).toEqual(testFileStats);
            expect(FileUpdater.updatePathWithStatsCalls[0][4]).toBeUndefined();
        });
        it('Test 034 : should update a path when the target doesn\'t exist', function () {
            mockFs.statMap[testSourceFile] = testFileStats2;
            var updated = FileUpdater.updatePath(testSourceFile, testTargetFile);
            expect(updated).toBe(true);
            expect(FileUpdater.updatePathWithStatsCalls.length).toBe(1);
            expect(FileUpdater.updatePathWithStatsCalls[0][0]).toBe(testSourceFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][1]).toEqual(testFileStats2);
            expect(FileUpdater.updatePathWithStatsCalls[0][2]).toBe(testTargetFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][3]).toBeNull();
            expect(FileUpdater.updatePathWithStatsCalls[0][4]).toBeUndefined();
        });
        it('Test 035 : should create the target\'s parent directory if it doesn\'t exist',
                function () {
            mockFs.statMap[path.join(testRootDir, testSourceFile)] = testFileStats2;
            var updated = FileUpdater.updatePath(
                testSourceFile, testTargetFile, { rootDir: testRootDir });
            expect(updated).toBe(true);
            expect(FileUpdater.updatePathWithStatsCalls.length).toBe(1);
            expect(FileUpdater.updatePathWithStatsCalls[0][0]).toBe(testSourceFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][1]).toEqual(testFileStats2);
            expect(FileUpdater.updatePathWithStatsCalls[0][2]).toBe(testTargetFile);
            expect(FileUpdater.updatePathWithStatsCalls[0][3]).toBeNull();
            expect(FileUpdater.updatePathWithStatsCalls[0][4]).toEqual({rootDir: testRootDir });
            expect(mockFs.mkdirPaths.length).toBe(1);
            expect(mockFs.mkdirPaths[0]).toBe(testRootDir);
        });
    });

    describe('mergeAndUpdateDir method', function () {
        it('Test 036 : should update files from merged source directories', function () {
            mockFs.statMap[testTargetDir] = testDirStats;
            mockFs.dirMap[testTargetDir] = [testSubDir];
            mockFs.statMap[path.join(testTargetDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(testTargetDir, testSubDir)] = [testSourceFile];
            mockFs.statMap[path.join(testTargetDir, testSubDir, testSourceFile)] =
                testFileStats;

            mockFs.statMap[testSourceDir] = testDirStats;
            mockFs.dirMap[testSourceDir] = [testSubDir];
            mockFs.statMap[path.join(testSourceDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(testSourceDir, testSubDir)] = [testSourceFile];
            mockFs.statMap[path.join(testSourceDir, testSubDir, testSourceFile)] =
                testFileStats2;

            mockFs.statMap[testSourceDir2] = testDirStats;
            mockFs.dirMap[testSourceDir2] = [testSubDir];
            mockFs.statMap[path.join(testSourceDir2, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(testSourceDir2, testSubDir)] = [testSourceFile2];
            mockFs.statMap[path.join(testSourceDir2, testSubDir, testSourceFile2)] =
                testFileStats3;

            var updated = FileUpdater.mergeAndUpdateDir(
                [testSourceDir, testSourceDir2], testTargetDir);
            expect(updated).toBe(true);
            expect(FileUpdater.updatePathWithStatsCalls.length).toBe(4);

            function validateUpdatePathWithStatsCall(
                    index, subPath, sourceDir, sourceStats, targetDir, targetStats) {
                var args = FileUpdater.updatePathWithStatsCalls[index];
                expect(args[0]).toBe(path.join(sourceDir, subPath));
                expect(args[1]).toEqual(sourceStats);
                expect(args[2]).toBe(path.join(targetDir, subPath));
                expect(args[3]).toEqual(targetStats);
                expect(args[4]).toBeUndefined();
            }

            // Update the root directory.
            validateUpdatePathWithStatsCall(
                0,
                '',
                testSourceDir2,
                testDirStats,
                testTargetDir,
                testDirStats);
            // Update the subdirectory.
           validateUpdatePathWithStatsCall(
                1,
                testSubDir,
                testSourceDir2,
                testDirStats,
                testTargetDir,
                testDirStats);
            // Update the first file, from the first source.
            validateUpdatePathWithStatsCall(
                2,
                path.join(testSubDir, testSourceFile),
                testSourceDir,
                testFileStats2,
                testTargetDir,
                testFileStats);
            // Update the second file, from the second source.
            validateUpdatePathWithStatsCall(
                3,
                path.join(testSubDir, testSourceFile2),
                testSourceDir2,
                testFileStats3,
                testTargetDir,
                null);
        });

        it('Test 037 : should update files from merged source directories - with a rootDir', function () {
            var rootDir = path.join('Users', 'me');
            mockFs.statMap[rootDir] = testDirStats;
            mockFs.dirMap[rootDir] = [testSourceDir, testSourceDir2, testTargetDir];

            mockFs.statMap[path.join(rootDir, testTargetDir)] = testDirStats;
            mockFs.dirMap[path.join(rootDir, testTargetDir)] = [testSubDir];
            mockFs.statMap[path.join(rootDir, testTargetDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(rootDir, testTargetDir, testSubDir)] = [testSourceFile];
            mockFs.statMap[path.join(rootDir, testTargetDir, testSubDir, testSourceFile)] =
                testFileStats;

            mockFs.statMap[path.join(rootDir, testSourceDir)] = testDirStats;
            mockFs.dirMap[path.join(rootDir, testSourceDir)] = [testSubDir];
            mockFs.statMap[path.join(rootDir, testSourceDir, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(rootDir, testSourceDir, testSubDir)] = [testSourceFile];
            mockFs.statMap[path.join(rootDir, testSourceDir, testSubDir, testSourceFile)] =
                testFileStats2;

            mockFs.statMap[path.join(rootDir, testSourceDir2)] = testDirStats;
            mockFs.dirMap[path.join(rootDir, testSourceDir2)] = [testSubDir];
            mockFs.statMap[path.join(rootDir, testSourceDir2, testSubDir)] = testDirStats;
            mockFs.dirMap[path.join(rootDir, testSourceDir2, testSubDir)] = [testSourceFile2];
            mockFs.statMap[path.join(rootDir, testSourceDir2, testSubDir, testSourceFile2)] =
                testFileStats3;

            var updated = FileUpdater.mergeAndUpdateDir(
                [testSourceDir, testSourceDir2], testTargetDir, { rootDir: rootDir });
            expect(updated).toBe(true);
            expect(FileUpdater.updatePathWithStatsCalls.length).toBe(4);

            function validateUpdatePathWithStatsCall(
                    index, subPath, sourceDir, sourceStats, targetDir, targetStats) {
                var args = FileUpdater.updatePathWithStatsCalls[index];
                expect(args[0]).toBe(path.join(sourceDir, subPath));
                expect(args[1]).toEqual(sourceStats);
                expect(args[2]).toBe(path.join(targetDir, subPath));
                expect(args[3]).toEqual(targetStats);
                expect(args[4]).toBeDefined(); // rootDir is defined
            }

            // Update the root directory.
            validateUpdatePathWithStatsCall(
                0,
                '',
                testSourceDir2,
                testDirStats,
                testTargetDir,
                testDirStats);
            // Update the subdirectory.
           validateUpdatePathWithStatsCall(
                1,
                testSubDir,
                testSourceDir2,
                testDirStats,
                testTargetDir,
                testDirStats);
            // Update the first file, from the first source.
            validateUpdatePathWithStatsCall(
                2,
                path.join(testSubDir, testSourceFile),
                testSourceDir,
                testFileStats2,
                testTargetDir,
                testFileStats);
            // Update the second file, from the second source.
            validateUpdatePathWithStatsCall(
                3,
                path.join(testSubDir, testSourceFile2),
                testSourceDir2,
                testFileStats3,
                testTargetDir,
                null);            
        });

    });
});
