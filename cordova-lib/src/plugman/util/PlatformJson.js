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
/* jshint node:true, sub:true, indent:4  */
/* global jasmine, describe, beforeEach, afterEach, it, spyOn, expect */


var fs = require('fs');
var path = require('path');
var shelljs = require('shelljs');
var mungeutil = require('./munge-util');

function PlatformJson(filePath, platform, configJson) {
    this.filePath = filePath;
    this.platform = platform;
    this.configJson = configJson;
}

PlatformJson.load = function(plugins_dir, platform) {
    var filePath = path.join(plugins_dir, platform + '.json');
    var configJson;
    if (fs.existsSync(filePath)) {
        configJson = fix_munge(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
    } else {
        configJson = {
            prepare_queue:{installed:[], uninstalled:[]},
            config_munge:{},
            installed_plugins:{},
            dependent_plugins:{}
        };
    }
    return new PlatformJson(filePath, platform, configJson);
};

PlatformJson.prototype.save = function() {
    shelljs.mkdir('-p', path.dirname(this.filePath));
    fs.writeFileSync(this.filePath, JSON.stringify(this.configJson, null, 4), 'utf-8');
};


// convert a munge from the old format ([file][parent][xml] = count) to the current one
function fix_munge(platform_config) {
    var munge = platform_config.config_munge;
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
        platform_config.config_munge = new_munge;
    }

    return platform_config;
}

module.exports = PlatformJson;

