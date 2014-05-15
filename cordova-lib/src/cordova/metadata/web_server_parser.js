// src/cordova/metadata/web_server_parser.js
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
    this.path = project;
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
