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

/* jshint laxcomma:true, sub:true */

var path = require('path')
  , common = require('./common')
  , fs   = require('fs')
  , glob = require('glob')
  , xcode = require('xcode')
  , plist = require('plist')
  , shell = require('shelljs')
  , events = require('../../events')
  , _ = require('underscore')
  , CordovaError = require('../../CordovaError')
  , cachedProjectFiles = {}
  ;


function installHelper(type, obj, plugin_dir, project_dir, plugin_id, options, project) {
    var srcFile = path.resolve(plugin_dir, obj.src);
    var targetDir = path.resolve(project.plugins_dir, plugin_id, obj.targetDir || '');
    var destFile = path.join(targetDir, path.basename(obj.src));

    var project_ref;
    var link = !!(options && options.link);
    if (link) {
        var trueSrc = fs.realpathSync(srcFile);
        // Create a symlink in the expected place, so that uninstall can use it.
        common.copyNewFile(plugin_dir, trueSrc, project_dir, destFile, link);

        // Xcode won't save changes to a file if there is a symlink involved.
        // Make the Xcode reference the file directly.
        // Note: Can't use path.join() here since it collapses 'Plugins/..', and xcode
        // library special-cases Plugins/ prefix.
        project_ref = 'Plugins/' + fixPathSep(path.relative(project.plugins_dir, trueSrc));
    } else {
        common.copyNewFile(plugin_dir, srcFile, project_dir, destFile, link);
        project_ref = 'Plugins/' + fixPathSep(path.relative(project.plugins_dir, destFile));
    }

    if (type == 'header-file') {
        project.xcode.addHeaderFile(project_ref);
    } else if (obj.framework) {
        var opt = { weak: obj.weak };
        var project_relative = path.join(path.basename(project.xcode_path), project_ref);
        project.xcode.addFramework(project_relative, opt);
        project.xcode.addToLibrarySearchPaths({path:project_ref});
    } else {
        project.xcode.addSourceFile(project_ref, obj.compilerFlags ? {compilerFlags:obj.compilerFlags} : {});
    }
}

function uninstallHelper(type, obj, project_dir, plugin_id, options, project) {
    var targetDir = path.resolve(project.plugins_dir, plugin_id, obj.targetDir || '');
    var destFile = path.join(targetDir, path.basename(obj.src));

    var project_ref;
    var link = !!(options && options.link);
    if (link) {
        var trueSrc = fs.readlinkSync(destFile);
        project_ref = 'Plugins/' + fixPathSep(path.relative(project.plugins_dir, trueSrc));
    } else {
        project_ref = 'Plugins/' + fixPathSep(path.relative(project.plugins_dir, destFile));
    }

    shell.rm('-rf', targetDir);

    if (type == 'header-file') {
        project.xcode.removeHeaderFile(project_ref);
    } else if (obj.framework) {
        var project_relative = path.join(path.basename(project.xcode_path), project_ref);
        project.xcode.removeFramework(project_relative);
        project.xcode.removeFromLibrarySearchPaths({path:project_ref});
    } else {
        project.xcode.removeSourceFile(project_ref);
    }
}

module.exports = {
    www_dir:function(project_dir) {
        return path.join(project_dir, 'www');
    },
    package_name:function(project_dir) {
        var plist_file = glob.sync(path.join(project_dir, '**', '*-Info.plist'))[0];
        return plist.parse(fs.readFileSync(plist_file, 'utf8')).CFBundleIdentifier;
    },
    'source-file':{
        install:function(obj, plugin_dir, project_dir, plugin_id, options, project) {
            installHelper('source-file', obj, plugin_dir, project_dir, plugin_id, options, project);
        },
        uninstall:function(obj, project_dir, plugin_id, options, project) {
            uninstallHelper('source-file', obj, project_dir, plugin_id, options, project);
        }
    },
    'header-file':{
        install:function(obj, plugin_dir, project_dir, plugin_id, options, project) {
            installHelper('header-file', obj, plugin_dir, project_dir, plugin_id, options, project);
        },
        uninstall:function(obj, project_dir, plugin_id, options, project) {
            uninstallHelper('header-file', obj, project_dir, plugin_id, options, project);
        }
    },
    'resource-file':{
        install:function(reobj, plugin_dir, project_dir, plugin_id, options, project) {
            var src = reobj.src,
                srcFile = path.resolve(plugin_dir, src),
                destFile = path.resolve(project.resources_dir, path.basename(src));
            if (!fs.existsSync(srcFile)) throw new Error('cannot find "' + srcFile + '" ios <resource-file>');
            if (fs.existsSync(destFile)) throw new Error('target destination "' + destFile + '" already exists');
            project.xcode.addResourceFile(path.join('Resources', path.basename(src)));
            shell.cp('-R', srcFile, project.resources_dir);
        },
        uninstall:function(reobj, project_dir, plugin_id, options, project) {
            var src = reobj.src,
                destFile = path.resolve(project.resources_dir, path.basename(src));
            project.xcode.removeResourceFile(path.join('Resources', path.basename(src)));
            shell.rm('-rf', destFile);
        }
    },
    'framework':{ // CB-5238 custom frameworks only
        install:function(obj, plugin_dir, project_dir, plugin_id, options, project) {
            var src = obj.src,
                custom = obj.custom,
                srcFile = path.resolve(plugin_dir, src),
                targetDir = path.resolve(project.plugins_dir, plugin_id, path.basename(src));
            if (!custom) return; //non-custom frameworks are processed in config-changes.js
            if (!fs.existsSync(srcFile)) throw new Error('cannot find "' + srcFile + '" ios <framework>');
            if (fs.existsSync(targetDir)) throw new Error('target destination "' + targetDir + '" already exists');
            shell.mkdir('-p', path.dirname(targetDir));
            shell.cp('-R', srcFile, path.dirname(targetDir)); // frameworks are directories
            var project_relative = path.relative(project_dir, targetDir);
            project.xcode.addFramework(project_relative, {customFramework: true});
        },
        uninstall:function(obj, project_dir, plugin_id, options, project) {
            var src = obj.src,
                targetDir = path.resolve(project.plugins_dir, plugin_id, path.basename(src));
            project.xcode.removeFramework(targetDir, {customFramework: true});
            shell.rm('-rf', targetDir);
        }
    },
    'lib-file': {
        install:function(obj, plugin_dir, project_dir, plugin_id, options) {
            events.emit('verbose', 'lib-file.install is not supported for ios');
        },
        uninstall:function(obj, project_dir, plugin_id, options) {
            events.emit('verbose', 'lib-file.uninstall is not supported for ios');
        }
    },
    parseProjectFile:function(project_dir) {
        // TODO: With ConfigKeeper introduced in config-changes.js
        // there is now double caching of iOS project files.
        // Remove the cache here when install can handle
        // a list of plugins at once.
        if (cachedProjectFiles[project_dir]) {
            return cachedProjectFiles[project_dir];
        }
        // grab and parse pbxproj
        // we don't want CordovaLib's xcode project
        var project_files = glob.sync(path.join(project_dir, '*.xcodeproj', 'project.pbxproj'));

        if (project_files.length === 0) {
            throw new Error('does not appear to be an xcode project (no xcode project file)');
        }
        var pbxPath = project_files[0];
        var xcodeproj = xcode.project(pbxPath);
        xcodeproj.parseSync();


        var xcBuildConfiguration = xcodeproj.pbxXCBuildConfigurationSection();
        var plist_file_entry = _.find(xcBuildConfiguration, function (entry) { return entry.buildSettings && entry.buildSettings.INFOPLIST_FILE; });
        var plist_file = path.join(project_dir, plist_file_entry.buildSettings.INFOPLIST_FILE.replace(/^"(.*)"$/g, '$1'));
        var config_file = path.join(path.dirname(plist_file), 'config.xml');

        if (!fs.existsSync(plist_file) || !fs.existsSync(config_file)) {
            throw new CordovaError('could not find -Info.plist file, or config.xml file.');
        }

        var xcode_dir = path.dirname(plist_file);
        var pluginsDir = path.resolve(xcode_dir, 'Plugins');
        var resourcesDir = path.resolve(xcode_dir, 'Resources');
        var cordovaVersion = fs.readFileSync(path.join(project_dir, 'CordovaLib', 'VERSION'), 'utf8').trim();

        cachedProjectFiles[project_dir] = {
            plugins_dir:pluginsDir,
            resources_dir:resourcesDir,
            xcode:xcodeproj,
            xcode_path:xcode_dir,
            pbx: pbxPath,
            write: function () {
                fs.writeFileSync(pbxPath, xcodeproj.writeSync());
            },
            cordovaVersion: cordovaVersion
        };

        return cachedProjectFiles[project_dir];
    },
    purgeProjectFileCache:function(project_dir) {
        delete cachedProjectFiles[project_dir];
    }
};

var pathSepFix = new RegExp(path.sep.replace(/\\/,'\\\\'),'g');
function fixPathSep(file) {
    return file.replace(pathSepFix, '/');
}
