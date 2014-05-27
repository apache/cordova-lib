/*
 *
 * Copyright 2013 Anis Kadri
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

var fs = require('fs')  // use existsSync in 0.6.x
   , path = require('path')
   , common = require('./common')
   , events = require('../events')
   , xml_helpers = require(path.join(__dirname, '..', '..', 'util', 'xml-helpers'))
   , properties_parser = require('properties-parser')
   , shell = require('shelljs');

var projectFileCache = {};

module.exports = {
    www_dir:function(project_dir) {
        return path.join(project_dir, 'assets', 'www');
    },
    // reads the package name out of the Android Manifest file
    // @param string project_dir the absolute path to the directory containing the project
    // @return string the name of the package
    package_name:function (project_dir) {
        var mDoc = xml_helpers.parseElementtreeSync(path.join(project_dir, 'AndroidManifest.xml'));

        return mDoc._root.attrib['package'];
    },
    "source-file":{
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            var dest = path.join(source_el.attrib['target-dir'], path.basename(source_el.attrib['src']));

            common.copyNewFile(plugin_dir, source_el.attrib['src'], project_dir, dest);
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            var dest = path.join(source_el.attrib['target-dir'], path.basename(source_el.attrib['src']));
            common.deleteJava(project_dir, dest);
        }
    },
    "header-file": {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'header-file.install is not supported for android');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'header-file.uninstall is not supported for android');
        }
    },
    "lib-file":{
        install:function(lib_el, plugin_dir, project_dir, plugin_id) {
            var src = lib_el.attrib.src;
            var dest = path.join("libs", path.basename(src));
            common.copyFile(plugin_dir, src, project_dir, dest);
        },
        uninstall:function(lib_el, project_dir, plugin_id) {
            var src = lib_el.attrib.src;
            var dest = path.join("libs", path.basename(src));
            common.removeFile(project_dir, dest);
        }
    },
    "resource-file":{
        install:function(el, plugin_dir, project_dir, plugin_id) {
            var src = el.attrib.src;
            var target = el.attrib.target;
            events.emit('verbose', 'Copying resource file ' + src + ' to ' + target);
            common.copyFile(plugin_dir, src, project_dir, path.normalize(target));
        },
        uninstall:function(el, project_dir, plugin_id) {
            var target = el.attrib.target;
            common.removeFile(project_dir, path.normalize(target));
        }
    },
    "framework": {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            var src = source_el.attrib.src;
            var custom = source_el.attrib.custom;
            if (!src) throw new Error('src not specified in framework element');

            events.emit('verbose', "Installing Android library: " + src);
            var parent = source_el.attrib.parent;
            var parentDir = parent ? path.resolve(project_dir, parent) : project_dir;
            var subDir;
            if (custom) {
                subDir = path.resolve(project_dir, src);
            } else {
                var localProperties = properties_parser.createEditor(path.resolve(project_dir, "local.properties"));
                subDir = path.resolve(localProperties.get("sdk.dir"), src);
            }
            var projectConfig = module.exports.parseProjectFile(project_dir);
            projectConfig.addSubProject(parentDir, subDir);
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            var src = source_el.attrib.src;
            if (!src) throw new Error('src not specified in framework element');

            events.emit('verbose', "Uninstalling Android library: " + src);
            var parent = source_el.attrib.parent;
            var parentDir = parent ? path.resolve(project_dir, parent) : project_dir;
            var subDir = path.resolve(project_dir, src);
            var projectConfig = module.exports.parseProjectFile(project_dir);
            projectConfig.removeSubProject(parentDir, subDir);
        }
    },
    parseProjectFile: function(project_dir){
        if (!projectFileCache[project_dir]) {
            projectFileCache[project_dir] = {
                propertiesEditors: {},
                subProjectDirs : {},
                addSubProject: function(parentDir, subDir) {
                    var subProjectFile = path.resolve(subDir, "project.properties");
                    if (!fs.existsSync(subProjectFile)) throw new Error('cannot find "' + subProjectFile + '" referenced in <framework>');

                    var parentProjectFile = path.resolve(parentDir, "project.properties");
                    var parentProperties = this._getPropertiesFile(parentProjectFile);
                    addLibraryReference(parentProperties, module.exports.getRelativeLibraryPath(parentDir, subDir));

                    var subProperties = this._getPropertiesFile(subProjectFile);
                    subProperties.set("target", parentProperties.get("target"));

                    this.subProjectDirs[subDir] = true;
                    this._dirty = true;
                },
                removeSubProject: function(parentDir, subDir) {
                    var parentProjectFile = path.resolve(parentDir, "project.properties");
                    var parentProperties = this._getPropertiesFile(parentProjectFile);
                    removeLibraryReference(parentProperties, module.exports.getRelativeLibraryPath(parentDir, subDir));
                    delete this.subProjectDirs[subDir];
                    this._dirty = true;
                },
                write: function () {
                    if (!this._dirty) return;

                    for (var filename in this.propertiesEditors) {
                        fs.writeFileSync(filename, this.propertiesEditors[filename].toString());
                    }

                    for (var sub_dir in this.subProjectDirs)
                    {
                        shell.exec("android update lib-project --path " + sub_dir);
                    }
                    this._dirty = false;
                },
                _dirty : false,
                _getPropertiesFile: function (filename) {
                    if (!this.propertiesEditors[filename])
                        this.propertiesEditors[filename] = properties_parser.createEditor(filename);

                    return this.propertiesEditors[filename];
                }
            };
        }

        return projectFileCache[project_dir];
    },
    purgeProjectFileCache:function(project_dir) {
        delete projectFileCache[project_dir];
    },
    getRelativeLibraryPath: function (parentDir, subDir) {
        var libraryPath = path.relative(parentDir, subDir);
        return (path.sep == '\\') ? libraryPath.replace(/\\/g, '/') : libraryPath;
    }
};

function addLibraryReference(projectProperties, libraryPath) {
    var i = 1;
    while (projectProperties.get("android.library.reference." + i))
        i++;

    projectProperties.set("android.library.reference." + i, libraryPath);
}

function removeLibraryReference(projectProperties, libraryPath) {
    var i = 1;
    var currentLib;
    while (currentLib = projectProperties.get("android.library.reference." + i)) {
        if (currentLib === libraryPath) {
            while (currentLib = projectProperties.get("android.library.reference." + (i + 1))) {
                projectProperties.set("android.library.reference." + i, currentLib);
                i++;
            }
            projectProperties.set("android.library.reference." + i);
            break;
        }
        i++;
    }
}
