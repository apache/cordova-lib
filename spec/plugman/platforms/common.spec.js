/*
 *
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/

var common = require('../../../src/plugman/platforms/common');
var path = require('path');
var fs = require('fs-extra');
var osenv = require('os');
var test_dir = path.join(osenv.tmpdir(), 'test_plugman');
var project_dir = path.join(test_dir, 'project');
var src = path.join(project_dir, 'src');
var dest = path.join(project_dir, 'dest');
var java_dir = path.join(src, 'one', 'two', 'three');
var java_file = path.join(java_dir, 'test.java');
var symlink_file = path.join(java_dir, 'symlink');
var symlink_dir = path.join(java_dir, 'symlink_dir');
var symlink_dir_relative_file = path.join('one', 'two', 'file');
var non_plugin_file = path.join(osenv.tmpdir(), 'non_plugin_file');

describe('common platform handler', function () {
    describe('resolveSrcPath', function () {
        it('Test 001 : should not throw if path exists', function () {
            fs.ensureDirSync(test_dir);
            var target = path.join(test_dir, 'somefile');
            fs.writeFileSync(target, '80085', 'utf-8');
            expect(function () { common.resolveSrcPath(test_dir, 'somefile'); }).not.toThrow();
            fs.removeSync(test_dir);
        });
    });

    describe('resolveTargetPath', function () {
        it('Test 002 : should throw if path exists', function () {
            fs.ensureDirSync(test_dir);
            expect(function () { common.resolveTargetPath(test_dir); }).toThrow();
            fs.removeSync(test_dir);
        });

        it('Test 003 : should not throw if path cannot be resolved', function () {
            expect(function () { common.resolveTargetPath(test_dir, 'somefile'); }).not.toThrow();
        });
    });

    describe('copyFile', function () {
        it('Test 004 : should throw if source path not found', function () {
            expect(function () { common.copyFile(test_dir, src, project_dir, dest); })
                .toThrow(new Error('"' + src + '" not found!'));
        });

        it('Test 005 : should throw if src not in plugin directory', function () {
            fs.ensureDirSync(project_dir);
            fs.writeFileSync(non_plugin_file, 'contents', 'utf-8');
            expect(function () { common.copyFile(test_dir, '../non_plugin_file', project_dir, dest); })
                .toThrow(new Error('"' + non_plugin_file + '" not located within plugin!'));
            fs.removeSync(test_dir);
        });

        it('Test 006 : should allow symlink src, if inside plugin', function () {
            fs.ensureDirSync(java_dir);
            fs.writeFileSync(java_file, 'contents', 'utf-8');

            // This will fail on windows if not admin - ignore the error in that case.
            if (ignoreEPERMonWin32(java_file, symlink_file)) {
                return;
            }

            common.copyFile(test_dir, symlink_file, project_dir, dest);
            fs.removeSync(project_dir);
        });

        it('Test 007 : should deeply symlink directory tree when src is a directory', function () {
            var symlink_dir_relative_subdir = path.dirname(symlink_dir_relative_file);

            fs.ensureDirSync(path.join(symlink_dir, symlink_dir_relative_subdir));
            fs.writeFileSync(path.join(symlink_dir, symlink_dir_relative_file), 'contents', 'utf-8');

            // This will fail on windows if not admin - ignore the error in that case.
            if (ignoreEPERMonWin32(java_file, symlink_file)) {
                return;
            }

            var create_symlink = true;
            common.copyFile(test_dir, symlink_dir, project_dir, dest, create_symlink);

            expect(path.resolve(dest, symlink_dir_relative_subdir, fs.readlinkSync(path.join(dest, symlink_dir_relative_file)))).toBe(path.resolve(symlink_dir, symlink_dir_relative_file));
            fs.removeSync(project_dir);
        });

        it('Test 008 : should throw if symlink is linked to a file outside the plugin', function () {
            fs.ensureDirSync(java_dir);
            fs.writeFileSync(non_plugin_file, 'contents', 'utf-8');

            // This will fail on windows if not admin - ignore the error in that case.
            if (ignoreEPERMonWin32(non_plugin_file, symlink_file)) {
                return;
            }

            expect(function () { common.copyFile(test_dir, symlink_file, project_dir, dest); })
                .toThrow(new Error('"' + symlink_file + '" not located within plugin!'));
            fs.removeSync(project_dir);
        });

        it('Test 009 : should throw if dest is outside the project directory', function () {
            fs.ensureDirSync(java_dir);
            fs.writeFileSync(java_file, 'contents', 'utf-8');
            expect(function () { common.copyFile(test_dir, java_file, project_dir, non_plugin_file); })
                .toThrow(new Error('"' + non_plugin_file + '" not located within project!'));
            fs.removeSync(project_dir);
        });

        it('Test 010 : should call mkdir -p on target path', function () {
            fs.ensureDirSync(java_dir);
            fs.writeFileSync(java_file, 'contents', 'utf-8');

            var s = spyOn(fs, 'ensureDirSync').and.callThrough();
            var resolvedDest = common.resolveTargetPath(project_dir, dest);

            common.copyFile(test_dir, java_file, project_dir, dest);

            expect(s).toHaveBeenCalled();
            expect(s).toHaveBeenCalledWith(path.dirname(resolvedDest));
            fs.removeSync(project_dir);
        });

        it('Test 011 : should call cp source/dest paths', function () {
            fs.ensureDirSync(java_dir);
            fs.writeFileSync(java_file, 'contents', 'utf-8');

            var s = spyOn(fs, 'copySync').and.callThrough();
            var resolvedDest = common.resolveTargetPath(project_dir, dest);

            common.copyFile(test_dir, java_file, project_dir, dest);

            expect(s).toHaveBeenCalled();
            expect(s).toHaveBeenCalledWith(java_file, resolvedDest);

            fs.removeSync(project_dir);
        });

    });

    describe('copyNewFile', function () {
        it('Test 012 : should throw if target path exists', function () {
            fs.ensureDirSync(dest);
            expect(function () { common.copyNewFile(test_dir, src, project_dir, dest); })
                .toThrow(new Error('"' + dest + '" already exists!'));
            fs.removeSync(dest);
        });

    });

    describe('deleteJava', function () {
        it('Test 013 : should call fs.unlinkSync on the provided paths', function () {
            fs.ensureDirSync(java_dir);
            fs.writeFileSync(java_file, 'contents', 'utf-8');

            var s = spyOn(fs, 'removeSync').and.callThrough();
            common.deleteJava(project_dir, java_file);
            expect(s).toHaveBeenCalled();
            expect(s).toHaveBeenCalledWith(path.resolve(project_dir, java_file));

            fs.removeSync(java_dir);
        });

        it('Test 014 : should delete empty directories after removing source code in a java src path hierarchy', function () {
            fs.ensureDirSync(java_dir);
            fs.writeFileSync(java_file, 'contents', 'utf-8');

            common.deleteJava(project_dir, java_file);
            expect(fs.existsSync(java_file)).not.toBe(true);
            expect(fs.existsSync(java_dir)).not.toBe(true);
            expect(fs.existsSync(path.join(src, 'one'))).not.toBe(true);

            fs.removeSync(java_dir);
        });

        it('Test 015 : should never delete the top-level src directory, even if all plugins added were removed', function () {
            fs.ensureDirSync(java_dir);
            fs.writeFileSync(java_file, 'contents', 'utf-8');

            common.deleteJava(project_dir, java_file);
            expect(fs.existsSync(src)).toBe(true);

            fs.removeSync(java_dir);
        });
    });
});

function ignoreEPERMonWin32 (symlink_src, symlink_dest) {
    try {
        fs.symlinkSync(symlink_src, symlink_dest);
    } catch (e) {
        if (process.platform === 'win32' && e.message.indexOf('Error: EPERM, operation not permitted' > -1)) {
            return true;
        }
        throw e;
    }
    return false;
}
