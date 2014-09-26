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

var path = require('path'),
           ConfigParser  = require('../../configparser/ConfigParser');

module.exports = {
    www_dir:function(project_dir) {
	//console.log("project_dir:"+project_dir);
        return path.join(project_dir,'www');
    },
    package_name:function (project_dir) {
        //console.log("project_dir:"+project_dir);
        xml = path.join(project_dir,'..','..','config.xml');
        cfg = new ConfigParser(xml);
        return ConfigParser.packageName();
    },
    'source-file':{
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'header-fileinstall is not supported for sugar');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'header-fileinstall is not supported for sugar');
        }
    },
    'header-file': {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'header-fileinstall is not supported for sugar');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'header-file.uninstall is not supported for sugar');
        }
    },
    'resource-file':{
        install:function(el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'resource-file.install is not supported for sugar');
        },
        uninstall:function(el, project_dir, plugin_id) {
            events.emit('verbose', 'resource-file.uninstall is not supported for sugar');
        }
    },
    'framework': {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'framework.install is not supported for sugar');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'framework.uninstall is not supported for sugar');
        }
    },
    'lib-file': {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'lib-file.install is not supported for sugar');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'lib-file.uninstall is not supported for sugar');
        }
    }
};
