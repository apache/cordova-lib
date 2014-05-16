/*
 * Web server is meant to support standing up a simple web server as a native platform.
 * 
 * This was copied from android but was gutted and stubed every method. Need to now
 * build this up with the appropriate methods.
*/

var fs = require('fs'),
    path = require('path');

module.exports = {
    www_dir:function(project_dir) {
        events.emit('verbose', 'Returning www_dir');
        return path.join(project_dir, 'www');
    },
    // reads the package name out of the ? file
    // @param string project_dir the absolute path to the directory containing the project
    // @return string the name of the package
    package_name:function (project_dir) {
        events.emit('verbose', 'Entered package_name');
        // This needs to look at package.json to find info
        data = JSON.parse(fs.readFileSync(path.join(project_dir, 'www', 'package.json')));
        return data.name;
    },
    "source-file":{
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'source-file.install is not supported for web_server');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'source-file.uninstall is not supported for web_server');
        }
    },
    "header-file": {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'header-file.install is not supported for web_server');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'header-file.uninstall is not supported for web_server');
        }
    },
    "lib-file":{
        install:function(lib_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'lib-file.install is not supported for web_server');
        },
        uninstall:function(lib_el, project_dir, plugin_id) {
            events.emit('verbose', 'lib-file.uninstall is not supported for web_server');
        }
    },
    "resource-file":{
        install:function(el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'resource-file.install is not supported for web_server');
        },
        uninstall:function(el, project_dir, plugin_id) {
            events.emit('verbose', 'resource-file.uninstall is not supported for web_server');
        }
    },
    "framework": {
        install:function(source_el, plugin_dir, project_dir, plugin_id) {
            events.emit('verbose', 'framework.install is not supported for web_server');
        },
        uninstall:function(source_el, project_dir, plugin_id) {
            events.emit('verbose', 'framework.uninstall is not supported for web_server');
        }
    }
};
