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
          indent:4, unused:vars, latedef:nofunc
*/

var path = require('path'),
    shell = require('shelljs'),
    xml_helpers = require('../../util/xml-helpers'),
    events = require('../../events'),
    util   = require('../../cordova/util'),
    gitclone = require('../../gitclone'),
    tmp_dir;

module.exports = {
    searchAndReplace:require('./search-and-replace'),

    clonePluginGit:function(plugin_git_url, plugins_dir, options) {
        return module.exports.clonePluginGitRepo(plugin_git_url, plugins_dir, options.subdir, options.git_ref).then(
            function(dst){
                // Keep location where we checked out git repo
                options.plugin_src_dir = tmp_dir;
                return dst;
            }
        );
    },

    // Fetches plugin information from remote server.
    // Returns a promise.
    clonePluginGitRepo:function(plugin_git_url, plugins_dir, subdir, git_ref) {
	return gitclone.clone(plugin_git_url, git_ref).then(function(tmp_dir) {
            // Read the plugin.xml file and extract the plugin's ID.
	    tmp_dir = path.join(tmp_dir, subdir);
            // TODO: what if plugin.xml does not exist?
            var xml_file = path.join(tmp_dir, 'plugin.xml');
            var xml = xml_helpers.parseElementtreeSync(xml_file);
            var plugin_id = xml.getroot().attrib.id;

            // TODO: what if a plugin depended on different subdirectories of the same plugin? this would fail.
            // should probably copy over entire plugin git repo contents into plugins_dir and handle subdir separately during install.
            var plugin_dir = path.join(plugins_dir, plugin_id);
            events.emit('verbose', 'Copying fetched plugin over "' + plugin_dir + '"...');
            shell.cp('-R', path.join(tmp_dir, '*'), plugin_dir);

            events.emit('verbose', 'Plugin "' + plugin_id + '" fetched.');
            process.env.CORDOVA_PLUGIN_ID = plugin_id;
            return plugin_dir;
        });
    }
};

