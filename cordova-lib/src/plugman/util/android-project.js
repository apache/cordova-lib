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
/*
    Helper for Android projects configuration
*/

/* jshint node:true, bitwise:true, undef:true, trailing:true, quotmark:true,
          indent:4, unused:vars, latedef:nofunc,
          boss:true
*/

var fs = require('fs'),
    path = require('path'),
    properties_parser = require('properties-parser'),
    shell = require('shelljs');
var semver = require('semver');


function addLibraryReference(projectProperties, libraryPath) {
    var i = 1;
    while (projectProperties.get('android.library.reference.' + i))
        i++;

    projectProperties.set('android.library.reference.' + i, libraryPath);
}

function removeLibraryReference(projectProperties, libraryPath) {
    var i = 1;
    var currentLib;
    while (currentLib = projectProperties.get('android.library.reference.' + i)) {
        if (currentLib === libraryPath) {
            while (currentLib = projectProperties.get('android.library.reference.' + (i + 1))) {
                projectProperties.set('android.library.reference.' + i, currentLib);
                i++;
            }
            projectProperties.set('android.library.reference.' + i);
            break;
        }
        i++;
    }
}

function updateGradleSettingsFile(settingsFile, updateFn) {
    try {
        var settings = fs.readFileSync(settingsFile, {encoding: 'utf8'});
        var lines = settings.split('\n');
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i].trim();
            if (line.substr(0,8) == 'include ') {
                var libs = line.substr(8).split(/,\s*/);
                updateFn(libs);
                lines[i] = 'include ' + libs.join(', ');
                break;
            }
        }
        fs.writeFileSync(settingsFile, lines.join('\n'), {encoding: 'utf8'});
    } catch (e) {
        if (e.code != 'ENOENT') {
            throw e;
        }
    }
}

function addGradleLibraryToSettings(settingsFile, gradleLibraryPath) {
    updateGradleSettingsFile(settingsFile, function(libs) {
        var exists = false;
        var index;
        for (index = 0; index < libs.length; ++index) {
            if (libs[index] == gradleLibraryPath) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            libs.splice(1, 0, gradleLibraryPath);
        }
    });
}

function removeGradleLibraryFromSettings(settingsFile, gradleLibraryPath) {
    updateGradleSettingsFile(settingsFile, function(libs) {
        var exists = false;
        var index;
        for (index = 0; index < libs.length; ++index) {
            if (libs[index] == gradleLibraryPath) {
                exists = true;
                break;
            }
        }
        if (exists) {
            libs.splice(index, 1);
        }
    });
}

function updateGradleLibrariesFile(librariesFile, updateFn) {
    try {
        var libraries = fs.readFileSync(librariesFile, {encoding: 'utf8'});
        var lines = libraries.split('\n');
        var openLine, closeLine;
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i];
            if (line.indexOf('dependencies {') > -1) {
                openLine = i;
            }
            if ((typeof closeLine == 'undefined') && (typeof openLine !== 'undefined') && line.indexOf('}') > -1) {
                closeLine = i;
                break;
            }
        }
        if ((typeof closeLine !== 'undefined') && (typeof openLine !== 'undefined')) {
            updateFn(lines, openLine, closeLine);
            fs.writeFileSync(librariesFile, lines.join('\n'), {encoding: 'utf8'});
        } else {
            console.log('Cannot update libraries.gradle');
        }
    } catch (e) {
        if (e.code != 'ENOENT') {
            throw e;
        }
    }
}

function addGradleLibraryToLibraries(librariesFile, gradleLibraryPath) {
    updateGradleLibrariesFile(librariesFile, function(lines, openLine, closeLine) {
        var exists = false;
        for (var i = openLine; i < closeLine; ++i) {
            if (lines[i].indexOf('compile project(' + gradleLibraryPath + ')') > -1) {
                exists = true;
            }
        }
        if (!exists) {
            lines.splice(closeLine, 0, '    compile project(' + gradleLibraryPath + ')');
        }
    });
}

function removeGradleLibraryFromLibraries(librariesFile, gradleLibraryPath) {
    updateGradleLibrariesFile(librariesFile, function(lines, openLine, closeLine) {
        var foundLine;
        var exists = false;
        for (var i = 0; i < lines.length; ++i) {
            if (lines[i].indexOf('compile project(' + gradleLibraryPath + ')') > -1) {
                exists = true;
                foundLine = i;
            }
        }
        if (exists) {
            lines.splice(foundLine, 1);
        }
    });
}

function updateBuildGradleFile(librariesFile, updateFn) {
    try {
        var libraries = fs.readFileSync(librariesFile, {encoding: 'utf8'});
        var lines = libraries.split('\n');
        var openLine, closeLine;
        for (var i = 0; i < lines.length; ++i) {
            var line = lines[i];
            if (line.indexOf('// PLUGIN GRADLE EXTENSIONS START') > -1) {
                openLine = i;
            }
            if ((typeof openLine !== 'undefined') && line.indexOf('// PLUGIN GRADLE EXTENSIONS END') > -1) {
                closeLine = i;
                break;
            }
        }
        if ((typeof closeLine !== 'undefined') && (typeof openLine !== 'undefined')) {
            updateFn(lines, openLine, closeLine);
            fs.writeFileSync(librariesFile, lines.join('\n'), {encoding: 'utf8'});
        } else {
            console.log('Cannot update build.gradle');
        }
    } catch (e) {
        if (e.code != 'ENOENT') {
            throw e;
        }
    }
}

function addReferenceToGradle(librariesFile, gradlePath) {
    updateBuildGradleFile(librariesFile, function(lines, openLine, closeLine) {
        var exists = false;
        for (var i = openLine; i < closeLine; ++i) {
            if (lines[i].indexOf('apply from: \'' + gradlePath + '\'') > -1) {
                exists = true;
            }
        }
        if (!exists) {
            lines.splice(closeLine, 0, 'apply from: \'' + gradlePath + '\'');
        }
    });
}

function removeReferenceFromGradle(librariesFile, gradlePath) {
    updateBuildGradleFile(librariesFile, function(lines, openLine, closeLine) {
        var foundLine;
        var exists = false;
        for (var i = 0; i < lines.length; ++i) {
            if (lines[i].indexOf('apply from: \'' + gradlePath + '\'') > -1) {
                exists = true;
                foundLine = i;
            }
        }
        if (exists) {
            lines.splice(foundLine, 1);
        }
    });
}

function addGradleLibraryReference(settingsFile, librariesFile, libraryPathComponents) {
    var gradleLibraryPath = '\':' + libraryPathComponents.join(':') + '\'';
    addGradleLibraryToSettings(settingsFile, gradleLibraryPath);
    addGradleLibraryToLibraries(librariesFile, gradleLibraryPath);
}

function removeGradleLibraryReference(settingsFile, librariesFile, libraryPathComponents) {
    var gradleLibraryPath = '\':' + libraryPathComponents.join(':') + '\'';
    removeGradleLibraryFromSettings(settingsFile, gradleLibraryPath);
    removeGradleLibraryFromLibraries(librariesFile, gradleLibraryPath);
}

function AndroidProject() {
    this._propertiesEditors = {};
    this._subProjectDirs = {};
    this._dirty = false;

    return this;
}

AndroidProject.prototype = {
    addSubProject: function(parentDir, subDir) {
        var subProjectFile = path.resolve(subDir, 'project.properties');
        if (!fs.existsSync(subProjectFile)) throw new Error('cannot find "' + subProjectFile + '" referenced in <framework>');

        var parentProjectFile = path.resolve(parentDir, 'project.properties');
        var parentProperties = this._getPropertiesFile(parentProjectFile);
        addLibraryReference(parentProperties, module.exports.getRelativeLibraryPath(parentDir, subDir));

        var subProperties = this._getPropertiesFile(subProjectFile);
        subProperties.set('target', parentProperties.get('target'));

        var gradleSettingsFile = path.resolve(parentDir, 'settings.gradle');
        var gradleLibrariesFile = path.resolve(parentDir, 'libraries.gradle');
        if (fs.existsSync(gradleSettingsFile)) {
            addGradleLibraryReference(gradleSettingsFile, gradleLibrariesFile, module.exports.getRelativeLibraryPath(parentDir, subDir).split('/'));
        }

        this._subProjectDirs[subDir] = true;
        this._dirty = true;
    },
    removeSubProject: function(parentDir, subDir) {
        var parentProjectFile = path.resolve(parentDir, 'project.properties');
        var parentProperties = this._getPropertiesFile(parentProjectFile);
        removeLibraryReference(parentProperties, module.exports.getRelativeLibraryPath(parentDir, subDir));
        var gradleSettingsFile = path.resolve(parentDir, 'settings.gradle');
        var gradleLibrariesFile = path.resolve(parentDir, 'libraries.gradle');
        if (fs.existsSync(gradleSettingsFile)) {
            removeGradleLibraryReference(gradleSettingsFile, gradleLibrariesFile, module.exports.getRelativeLibraryPath(parentDir, subDir).split('/'));
        }
        delete this._subProjectDirs[subDir];
        this._dirty = true;
    },
    addGradleReference: function(parentDir, subDir) {
        var gradleExtrasFile = path.resolve(parentDir, 'build.gradle');
        var gradleReference = module.exports.getRelativeLibraryPath(parentDir, subDir);
        if (fs.existsSync(gradleExtrasFile)) {
            addReferenceToGradle(gradleExtrasFile, gradleReference);
        }
    },
    removeGradleReference: function(parentDir, subDir) {
        var gradleExtrasFile = path.resolve(parentDir, 'build.gradle');
        var gradleReference = module.exports.getRelativeLibraryPath(parentDir, subDir);
        if (fs.existsSync(gradleExtrasFile)) {
            removeReferenceFromGradle(gradleExtrasFile, gradleReference);
        }
    },
    write: function(platformVersion) {
        if (!this._dirty) return;

        for (var filename in this._propertiesEditors) {
            fs.writeFileSync(filename, this._propertiesEditors[filename].toString());
        }

        // Starting with 3.6.0, the build scripts set ANDROID_HOME, so there is
        // no reason to keep run this command. Plus - we really want to avoid
        // relying on the presense of native SDKs within plugman.
        var needsUpdateProject = !platformVersion || semver.lt(platformVersion, '3.6.0');
        if (needsUpdateProject) {
            for (var sub_dir in this._subProjectDirs)
            {
                shell.exec('android update lib-project --path "' + sub_dir + '"');
            }
        }
        this._dirty = false;
    },
    _getPropertiesFile: function (filename) {
        if (!this._propertiesEditors[filename])
            this._propertiesEditors[filename] = properties_parser.createEditor(filename);

        return this._propertiesEditors[filename];
    }
};


module.exports = {
    AndroidProject: AndroidProject,
    getRelativeLibraryPath: function (parentDir, subDir) {
        var libraryPath = path.relative(parentDir, subDir);
        return (path.sep == '\\') ? libraryPath.replace(/\\/g, '/') : libraryPath;
    }
};
