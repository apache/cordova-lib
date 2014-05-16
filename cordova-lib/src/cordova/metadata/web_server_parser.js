// src/cordova/metadata/web_server_parser.js
/**
    All parsers seem to implement the following methods:
        config_xml
        cordovajs_path
        update_from_config
        update_project
        update_www
        www_dir
    As well as the constructor and check_requirements methods.

    These methods use lowercase and underscores. Methods special
    to this parser seem to have a camel case convention.
*/
var fs              = require('fs'),
    path            = require('path'),
    shell           = require('shelljs'),
    events          = require('../events'),
    util            = require('../util'),
    events          = require('../events'),
    Q               = require('q'),
    ConfigParser    = require('../ConfigParser');
    CordovaError 	= require('../../CordovaError');

/**
    Gets run when creating a new platform.

    @param the project directory?
*/
module.exports = function web_server_parser(project) {
    events.emit('verbose', "Project: " + project);
    this.path = path.join(project);
};

/**
    Always gets run when adding a new platform. However some other
    script will do the actual checking of requirements.
    
    @return a promise.
*/
module.exports.check_requirements = function(project_root) {
    // Rely on platform's bin/create script to check requirements.
    return Q();
};

/**
    Since each platform has it's own structure and resources each needs
    it's own parser to ensure that certain configs and folders are found.
*/
module.exports.prototype = {
    /**
        Just points to the project's config.xml
        No special handling required for this platform.
    */
    config_xml: function () {
        events.emit('verbose', 'Entered config_xml');
        return path.join(this.path, 'config.xml');
    },
    /**
        Used for creating platform_www in projects created by older versions.
    */
    cordovajs_path: function (libDir) {
        events.emit('verbose', 'Entered cordovajs_path');
        var jsPath = path.join(libDir, 'cordova-lib', 'cordova.js');
        return path.resolve(jsPath);
    },
    /**
        The config.xml comes from the cordova project structure. So this will always come
        and contains basic project information that can be used to configure the platform
        target. This method should take any actions necessary to set up the app based on
        the cordova project config.xml.

        @param the config parser object
        @return a promise
    */
    update_from_config: function (config) {
        events.emit('verbose', 'Entered update_from_config');
        if (config instanceof ConfigParser) {
        } else {
            return Q.reject(new Error("update_from_config requires a ConfigParser object."));
        }
        // find config and read it in.
        var file = path.join(this.path, 'package.json');
        var data = fs.readFileSync(file);
        var obj = JSON.parse(data);
        
        obj.name = config.name();
        obj.description = config.description();

        // write it out.
        fs.writeFileSync(file, JSON.stringify(obj), 'utf8');
    },
    update_project: function () {
        events.emit('verbose', 'Entered update_project');
        return 1;
    },
    update_www: function () {
        events.emit('verbose', 'Entered update_www');
        return 1;
    },
    www_dir: function () {
        events.emit('verbose', 'Entered www_dir');
        return path.join(this.path, "..", "www");
    },
};