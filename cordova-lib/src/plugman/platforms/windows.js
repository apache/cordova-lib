/*
 *
 * Copyright 2013 Jesse MacFadyen
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

var common = require('./common'),
    path = require('path'),
    fs   = require('fs'),
    glob = require('glob'),
    jsproj = require('../../util/windows/jsproj'),
    events = require('../../events'),
    xml_helpers = require('../../util/xml-helpers');

module.exports = {
    platformName: 'windows',
    InvalidProjectPathError: 'does not appear to be a Windows 8 or Unified Windows Store project (no .projitems|jsproj file)',
    www_dir:function(project_dir) {
        return path.join(project_dir, 'www');
    },
    package_name:function(project_dir) {
        // CB-6976 Windows Universal Apps. To make platform backward compatible
        // with old template we look for package.appxmanifest file as well.
        var manifestPath = fs.existsSync(path.join(project_dir, 'package.windows.appxmanifest')) ?
            path.join(project_dir, 'package.windows.appxmanifest') :
            path.join(project_dir, 'package.appxmanifest');

        var manifest = xml_helpers.parseElementtreeSync(manifestPath);
        return manifest.find('Properties/DisplayName').text;
    },
    parseProjectFile:function(project_dir) {
        var project_files = glob.sync('*.projitems', { cwd:project_dir });
        if (project_files.length === 0) {
            // Windows8.1: for smooth transition and to prevent
            // plugin handling failures we search for old *.jsproj also.
            project_files = glob.sync('*.jsproj', { cwd:project_dir });
            if (project_files.length === 0) {
                throw new Error(this.InvalidProjectPathError);
            }
        }
        return new jsproj(path.join(project_dir, project_files[0]));
    },
    'source-file': {
        install:function(source_el, plugin_dir, project_dir, plugin_id, project_file) {
            var targetDir = source_el.attrib['target-dir'] || '';
            var dest = path.join('plugins', plugin_id, targetDir, path.basename(source_el.attrib['src']));

            common.copyNewFile(plugin_dir, source_el.attrib['src'], project_dir, dest);
            // add reference to this file to jsproj.
            project_file.addSourceFile(dest);
        },
        uninstall:function(source_el, project_dir, plugin_id, project_file) {
            var dest = path.join('plugins', plugin_id,
                                 source_el.attrib['target-dir'] || '',
                                 path.basename(source_el.attrib['src']));
            common.removeFile(project_dir, dest);
            // remove reference to this file from csproj.
            project_file.removeSourceFile(dest);
        }
    },
    'header-file': {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'header-fileinstall is not supported for Windows 8');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'header-file.uninstall is not supported for Windows 8');
        }
    },
    'resource-file':{
        install:function(el, plugin_dir, project_dir, plugin_id, project_file) {
            events.emit('verbose', 'resource-file is not supported for Windows 8');
        },
        uninstall:function(el, project_dir, plugin_id, project_file) {
        }
    },
    'lib-file': {
        install:function(el, plugin_dir, project_dir, plugin_id, project_file) {
            var inc  = el.attrib['Include'];
            project_file.addSDKRef(inc);
        },
        uninstall:function(el, project_dir, plugin_id, project_file) {
            events.emit('verbose', 'windows8 lib-file uninstall :: ' + plugin_id);
            var inc = el.attrib['Include'];
            project_file.removeSDKRef(inc);
        }
    },
    'framework': {
        install:function(el, plugin_dir, project_dir, plugin_id, project_file) {
            events.emit('verbose', 'windows8 framework install :: ' + plugin_id);

            var src = el.attrib['src'];
            var dest = src; // if !isCustom, we will just add a reference to the file in place
            // technically it is not possible to get here without isCustom == true -jm
            // var isCustom = el.attrib.custom == 'true';
            var type = el.attrib['type'];

            if(type == 'projectReference') {
                project_file.addProjectReference(path.join(plugin_dir,src));
            }
            else {
                // if(isCustom) {}
                dest = path.join('plugins', plugin_id, path.basename(src));
                common.copyFile(plugin_dir, src, project_dir, dest);
                project_file.addReference(dest, src);
            }

        },
        uninstall:function(el, project_dir, plugin_id, project_file) {
            events.emit('verbose', 'windows8 framework uninstall :: ' + plugin_id  );

            var src = el.attrib['src'];
            // technically it is not possible to get here without isCustom == true -jm
            // var isCustom = el.attrib.custom == 'true';
            var type = el.attrib['type'];

            if(type == 'projectReference') {
                // unfortunately we have to generate the plugin_dir path because it is not passed to uninstall. Note
                // that project_dir is the windows project directory ([project]\platforms\windows) - we need to get to
                // [project]\plugins\[plugin_id]
                var plugin_dir = path.join(project_dir, '..', '..', 'plugins', plugin_id, src);
                project_file.removeProjectReference(plugin_dir);
            }
            else {
                // if(isCustom) {  }
                var targetPath = path.join('plugins', plugin_id);
                common.removeFile(project_dir, targetPath);
                project_file.removeReference(src);
            }
        }
    }
};
