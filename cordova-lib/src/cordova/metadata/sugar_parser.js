/**
    Licensed to the Apache Software Foundation (ASF) under one
    or more contributor license agreements.  See the NOTICE file
    distributed with this work for additional information
    regarding copyright ownership.  The ASF licenses this file
    to you under the Apache License, Version 2.0 (the
    "License"); you may not use this file except in compliance
    with the License.  You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing,
    software distributed under the License is distributed on an
    "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
    KIND, either express or implied.  See the License for the
    specific language governing permissions and limitations
    under the License.
*/
var fs            = require('fs'),
    path          = require('path'),
    util          = require('../util'),
    shell         = require('shelljs'),
    Q             = require('q'),
    ConfigParser  = require('../../configparser/ConfigParser'),
    CordovaError  = require('../../CordovaError');


module.exports = function sugar_parser(project) {
    if (!(fs.existsSync(path.join(project,'project_template', 'setup.py')))) {
        throw new CordovaError('The provided path "' + project + '" is not an Sugar project.');
    }
    this.path = project;
    this.activity_info = path.join(this.path,'project_template', 'activity', 'activity.info');
};


module.exports.check_requirements = function(project_root) {
    return Q(true);
};

module.exports.prototype = {


    update_project:function(config) {
        if (config instanceof ConfigParser) {
        } else throw new Error('update_from_config requires a ConfigParser object');

        var name = config.name();
	shell.echo(name).to(path.join(this.path,'cordova',"Project_Name.txt"));

	var activity_info_path=this.activity_info;

	fs.readFile(this.activity_info, 'utf8', function (err,data) {
	  if (err) {
	    return console.log(err);
	  }

	var name_replace = data.replace(/(name =)(.*)/g,'name = '+name);

	var pkg_replace = name_replace.replace(/(bundle_id =)(.*)/g,'bundle_id = '+config.packageName());

			fs.writeFile(activity_info_path, pkg_replace, function(err) {
			    if(err) {
				console.log(err);
			    } else {
				console.log("updated activity.info");
			    }
			}); 

	});
    },


    www_dir:function() {
        return path.join(this.path,'www');
    },

    config_xml:function(){
        return path.join(this.path, 'config.xml');
    },


    cordovajs_path:function(libDir) {
        var jsPath = path.join(libDir,'cordova.js');
        return path.resolve(jsPath);
    },


    update_www:function() {
        var projectRoot = util.isCordova(this.path);
        var app_www = util.projectWww(projectRoot);
        var platform_www = path.join(this.path, 'platform_www');

        shell.rm('-rf', this.www_dir());
        shell.mkdir(this.www_dir());
        shell.cp('-rf', path.join(app_www, '*'), this.www_dir());
        shell.cp('-rf', path.join(platform_www, '*'), this.www_dir());

    }

};
