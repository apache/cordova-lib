/*
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
/* jshint sub:true */

var fs = require('fs');
var path = require('path');
var shelljs = require('shelljs');
var mungeutil = require('./munge-util');

function PlatformJson(filePath, platform, root) {
    this.filePath = filePath;
    this.platform = platform;
    this.root = fix_munge(root || {});
}

PlatformJson.load = function(plugins_dir, platform) {
    var filePath = path.join(plugins_dir, platform + '.json');
    var root = null;
    if (fs.existsSync(filePath)) {
        root = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return new PlatformJson(filePath, platform, root);
};

PlatformJson.prototype.save = function() {
    shelljs.mkdir('-p', path.dirname(this.filePath));
    fs.writeFileSync(this.filePath, JSON.stringify(this.root, null, 4), 'utf-8');
};

PlatformJson.prototype.isPluginInstalled = function(pluginId) {
    var installed_plugin_id;
    var json = this.root;
    for (installed_plugin_id in json.installed_plugins) {
        if (installed_plugin_id == pluginId) {
            return true;
        }
    }
    for (installed_plugin_id in json.dependent_plugins) {
        if (installed_plugin_id == pluginId) {
            return true;
        }
    }
    return false;
};

PlatformJson.prototype.addInstalledPluginToPrepareQueue = function(pluginDirName, vars, is_top_level) {
    this.root.prepare_queue.installed.push({'plugin':pluginDirName, 'vars':vars, 'topLevel':is_top_level});
};

PlatformJson.prototype.addUninstalledPluginToPrepareQueue = function(pluginId, is_top_level) {
    this.root.prepare_queue.uninstalled.push({'plugin':pluginId, 'id':pluginId, 'topLevel':is_top_level});
};


// convert a munge from the old format ([file][parent][xml] = count) to the current one
function fix_munge(root) {
    root.prepare_queue = root.prepare_queue || {installed:[], uninstalled:[]};
    root.config_munge = root.config_munge || {files: {}};
    root.installed_plugins = root.installed_plugins || {};
    root.dependent_plugins = root.dependent_plugins || {};

    var munge = root.config_munge;
    if (!munge.files) {
        var new_munge = { files: {} };
        for (var file in munge) {
            for (var selector in munge[file]) {
                for (var xml_child in munge[file][selector]) {
                    var val = parseInt(munge[file][selector][xml_child]);
                    for (var i = 0; i < val; i++) {
                        mungeutil.deep_add(new_munge, [file, selector, { xml: xml_child, count: val }]);
                    }
                }
            }
        }
        root.config_munge = new_munge;
    }

    return root;
}

module.exports = PlatformJson;

