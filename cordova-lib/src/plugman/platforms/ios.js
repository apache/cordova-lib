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

/* jshint node:true, bitwise:true, undef:true, trailing:true, quotmark:true,
          indent:4, unused:vars, latedef:nofunc,
          laxcomma:true, sub:true
*/

var path = require('path')
  , fs   = require('fs')
  , glob = require('glob')
  , xcode = require('xcode')
  , plist = require('plist-with-patches')
  , shell = require('shelljs')
  , events = require('../../events')
  , xml = require('../../util/xml-helpers')
  , cachedProjectFiles = {}
  ;

module.exports = {
    www_dir:function(project_dir) {
        return path.join(project_dir, 'www');
    },
    package_name:function(project_dir) {
        var plist_file = glob.sync(path.join(project_dir, '**', '*-Info.plist'))[0];
        return plist.parseFileSync(plist_file).CFBundleIdentifier;
    },
    'source-file':{
        install:function(source_el, plugin_dir, project_dir, plugin_id, project) {
            project = project || createProject(project_dir, plugin_id);
            var src = source_el.attrib['src'];
            var srcFile = path.resolve(plugin_dir, src);
            var targetDir = path.resolve(project.plugins_dir, getRelativeDir(source_el));
            var destFile = path.resolve(targetDir, path.basename(src));
            var is_framework = source_el.attrib['framework'] && (source_el.attrib['framework'] == 'true' || source_el.attrib['framework'] === true);
            var has_flags = source_el.attrib['compiler-flags'] && source_el.attrib['compiler-flags'].length ? true : false ;

            if (!fs.existsSync(srcFile)) throw new Error('cannot find "' + srcFile + '" ios <source-file>');
            if (fs.existsSync(destFile)) throw new Error('target destination "' + destFile + '" already exists');
            var project_ref = path.relative(project.xcode_path, destFile);

            if (is_framework) {
                var weak = source_el.attrib['weak'];
                var opt = { weak: (weak === weak == 'true') };
                project.xcode.addFramework(project_ref, opt);
                project.xcode.addToLibrarySearchPaths({path:project_ref});
            } else {
                project.xcode.addSourceFile(project_ref, has_flags ? {compilerFlags:source_el.attrib['compiler-flags']} : {});
            }
            shell.mkdir('-p', targetDir);
            shell.cp(srcFile, destFile);
            project.write();
        },
        uninstall:function(source_el, project_dir, plugin_id, project) {
            project = project || createProject(project_dir, plugin_id);
            var src = source_el.attrib['src'];
            var targetDir = path.resolve(project.plugins_dir, getRelativeDir(source_el));
            var destFile = path.resolve(targetDir, path.basename(src));
            var is_framework = source_el.attrib['framework'] && (source_el.attrib['framework'] == 'true' || source_el.attrib['framework'] === true);

            var project_ref = path.relative(project.xcode_path, destFile);
            project.xcode.removeSourceFile(project_ref);
            if (is_framework) {
                project.xcode.removeFramework(project_ref);
                project.xcode.removeFromLibrarySearchPaths({path:project_ref});
            }
            shell.rm('-rf', destFile);

            if(fs.existsSync(targetDir) && fs.readdirSync(targetDir).length>0){
                shell.rm('-rf', targetDir);
            }
            
            project.write();
        }
    },
    'header-file':{
        install:function(header_el, plugin_dir, project_dir, plugin_id, project) {
            project = project || createProject(project_dir, plugin_id);
            var src = header_el.attrib['src'];
            var srcFile = path.resolve(plugin_dir, src);
            var targetDir = path.resolve(project.plugins_dir, getRelativeDir(header_el));
            var destFile = path.resolve(targetDir, path.basename(src));
            if (!fs.existsSync(srcFile)) throw new Error('cannot find "' + srcFile + '" ios <header-file>');
            if (fs.existsSync(destFile)) throw new Error('target destination "' + destFile + '" already exists');
            project.xcode.addHeaderFile(path.relative(project.xcode_path, destFile));
            shell.mkdir('-p', targetDir);
            shell.cp(srcFile, destFile);
            project.write();
        },
        uninstall:function(header_el, project_dir, plugin_id, project) {
            project = project || createProject(project_dir, plugin_id);
            var src = header_el.attrib['src'];
            var targetDir = path.resolve(project.plugins_dir, getRelativeDir(header_el));
            var destFile = path.resolve(targetDir, path.basename(src));
            project.xcode.removeHeaderFile(path.relative(project.xcode_path, destFile));
            shell.rm('-rf', destFile);
            if(fs.existsSync(targetDir) && fs.readdirSync(targetDir).length>0){
                shell.rm('-rf', targetDir);
            }
            project.write();
        }
    },
    'resource-file':{
        install:function(resource_el, plugin_dir, project_dir, plugin_id, project) {
            project = project || createProject(project_dir, plugin_id);
            var src = resource_el.attrib['src'],
                srcFile = path.resolve(plugin_dir, src),
                destFile = path.resolve(project.resources_dir, path.basename(src));
            if (!fs.existsSync(srcFile)) throw new Error('cannot find "' + srcFile + '" ios <resource-file>');
            if (fs.existsSync(destFile)) throw new Error('target destination "' + destFile + '" already exists');
            project.xcode.addResourceFile(path.join('Resources', path.basename(src)));
            shell.cp('-R', srcFile, project.resources_dir);
            project.write();
        },
        uninstall:function(resource_el, project_dir, plugin_id, project) {
            project = project || createProject(project_dir, plugin_id);
            var src = resource_el.attrib['src'],
                destFile = path.resolve(project.resources_dir, path.basename(src));
            project.xcode.removeResourceFile(path.join('Resources', path.basename(src)));
            shell.rm('-rf', destFile);
            project.write();
        }
    },
    'framework':{ // CB-5238 custom frameworks only
        install:function(framework_el, plugin_dir, project_dir, plugin_id, project) {
            project = project || createProject(project_dir, plugin_id);
            var src = framework_el.attrib['src'],
                custom = framework_el.attrib['custom'],
                srcFile = path.resolve(plugin_dir, src),
                targetDir = path.resolve(project.plugins_dir, path.basename(src));
            if (!custom) return; //non-custom frameworks are processed in config-changes.js
            if (!fs.existsSync(srcFile)) throw new Error('cannot find "' + srcFile + '" ios <framework>');
            if (fs.existsSync(targetDir)) throw new Error('target destination "' + targetDir + '" already exists');
            shell.mkdir('-p', path.dirname(targetDir));
            shell.cp('-R', srcFile, path.dirname(targetDir)); // frameworks are directories
            var project_relative = path.relative(project.xcode_path, targetDir);
            project.xcode.addFramework(project_relative, {customFramework: true});
            project.write();
        },
        uninstall:function(framework_el, project_dir, plugin_id, project) {
            project = project || createProject(project_dir, plugin_id);
            var src = framework_el.attrib['src'],
                targetDir = path.resolve(project.plugins_dir, path.basename(src));
            project.xcode.removeFramework(targetDir, {customFramework: true});
            shell.rm('-rf', targetDir);
            project.write();
        }
    },
    'lib-file': {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'lib-file.install is not supported for ios');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'lib-file.uninstall is not supported for ios');
        }
    },
    createProject: function(project_dir, plugin_id) {
        return createProject(project_dir, plugin_id);
    },
    purgeProjectFileCache:function(project_dir) {
        delete cachedProjectFiles[project_dir];
    }
};

function createProject(project_dir, plugin_id) {
    events.emit('verbose', 'Creating plugin project');
    var plugin_name = plugin_id.substring(plugin_id.lastIndexOf('.') + 1);
    var plugin_path = path.join(project_dir, plugin_name, plugin_name + '.xcodeproj');
    var pbxPath = path.join(plugin_path, 'project.pbxproj');

    var project_files = glob.sync(path.join(project_dir, '*.xcodeproj', 'project.pbxproj'));

    if (project_files.length === 0) {
        throw new Error('does not appear to be an xcode project (no xcode project file)');
    }
    
    if (!fs.existsSync(pbxPath)) {
        shell.mkdir('-p', plugin_path);
        shell.cp(path.join(project_dir, 'plugin.pbxproj'), pbxPath);
        shell.sed('-i', /_target_/g, plugin_name, pbxPath);
        
        var workspace = glob.sync(path.join(project_dir, '*.xcworkspace', 'contents.xcworkspacedata'))[0];
        var xmlDoc = xml.parseElementtreeSync(fs.readFileSync(workspace));
        xmlDoc.getroot().Element('FileRef', {location: 'group:' + plugin_name + '/' + plugin_name + '.xcodeproj'});
        fs.writeFileSync(workspace, xmlDoc.toString());
        
        var proj = xcode.project(project_files[0]).parseSync();
        proj.addFramework('lib' + plugin_name + '.a');
        fs.writeFileSync(project_files[0], proj.writeSync());
    }

    var xcodeproj = xcode.project(pbxPath);
    xcodeproj.parseSync();
    
    var xcode_dir = path.join(project_dir, plugin_name);
    var pluginsDir = path.resolve(xcode_dir, plugin_name);
    var resourcesDir = path.resolve(xcode_dir, 'Resources');
    var cordovaVersion = fs.readFileSync(path.join(project_dir, 'CordovaLib', 'VERSION'), 'utf8').trim();

    return {
        plugins_dir:pluginsDir,
        resources_dir:resourcesDir,
        xcode:xcodeproj,
        xcode_path: xcode_dir,
        write: function () {
            fs.writeFileSync(pbxPath, xcodeproj.writeSync());
        },
        cordovaVersion: cordovaVersion
    };    
}

function getRelativeDir(file) {
    var targetDir = file.attrib['target-dir'];
    if (targetDir) {
        return targetDir;
    } else {
        return '';
    }
}
