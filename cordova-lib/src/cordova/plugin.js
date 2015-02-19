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

var cordova_util  = require('./util'),
    path          = require('path'),
    semver        = require('semver'),
    config        = require('./config'),
    Q             = require('q'),
    CordovaError  = require('../CordovaError'),
    ConfigParser  = require('../configparser/ConfigParser'),
    fs            = require('fs'),
    shell         = require('shelljs'),
    PluginInfoProvider = require('../PluginInfoProvider'),
    plugman       = require('../plugman/plugman'),
    events        = require('../events');

// Returns a promise.
module.exports = function plugin(command, targets, opts) {
    var projectRoot = cordova_util.cdProjectRoot();

    // Dance with all the possible call signatures we've come up over the time. They can be:
    // 1. plugin() -> list the plugins
    // 2. plugin(command, Array of targets, maybe opts object)
    // 3. plugin(command, target1, target2, target3 ... )
    // The targets are not really targets, they can be a mixture of plugins and options to be passed to plugman.

    command = command || 'ls';
    targets = targets || [];
    opts = opts || {};
    if ( opts.length ) {
        // This is the case with multiple targets as separate arguments and opts is not opts but another target.
        targets = Array.prototype.slice.call(arguments, 1);
        opts = {};
    }
    if ( !Array.isArray(targets) ) {
        // This means we had a single target given as string.
        targets = [targets];
    }
    opts.options = opts.options || [];
    opts.plugins = [];

    // TODO: Otherwise HooksRunner will be Object instead of function when run from tests - investigate why
    var HooksRunner = require('../hooks/HooksRunner');
    var hooksRunner = new HooksRunner(projectRoot);
    var config_json = config.read(projectRoot);
    var platformList = cordova_util.listPlatforms(projectRoot);
    
    // Massage plugin name(s) / path(s)
    var pluginPath, plugins;
    pluginPath = path.join(projectRoot, 'plugins');
    plugins = cordova_util.findPlugins(pluginPath);
    if (!targets || !targets.length) {
        if (command == 'add' || command == 'rm') {
            return Q.reject(new CordovaError('You need to qualify `'+cordova_util.binname+' plugin add` or `'+cordova_util.binname+' plugin remove` with one or more plugins!'));
        } else {
            targets = [];
        }
    }

    //Split targets between plugins and options
    //Assume everything after a token with a '-' is an option
    var i;
    for (i = 0; i < targets.length; i++) {
        if (targets[i].match(/^-/)) {
            opts.options = targets.slice(i);
            break;
        } else {
            opts.plugins.push(targets[i]);
        }
    }

    switch(command) {
        case 'add':
            if (!targets || !targets.length) {
                return Q.reject(new CordovaError('No plugin specified. Please specify a plugin to add. See `'+cordova_util.binname+' plugin search`.'));
            }

            var xml = cordova_util.projectConfig(projectRoot);
            var cfg = new ConfigParser(xml);
            var searchPath = config_json.plugin_search_path || [];
            if (typeof opts.searchpath == 'string') {
                searchPath = opts.searchpath.split(path.delimiter).concat(searchPath);
            } else if (opts.searchpath) {
                searchPath = opts.searchpath.concat(searchPath);
            }
            // Blank it out to appease unit tests.
            if (searchPath.length === 0) {
                searchPath = undefined;
            }

            opts.cordova = { plugins: cordova_util.findPlugins(path.join(projectRoot, 'plugins')) };
            return hooksRunner.fire('before_plugin_add', opts)
            .then(function() {
                var pluginInfoProvider = new PluginInfoProvider();
                return opts.plugins.reduce(function(soFar, target) {
                    var pluginsDir = path.join(projectRoot, 'plugins');
                    return soFar.then(function() {
                        if (target[target.length - 1] == path.sep) {
                            target = target.substring(0, target.length - 1);
                        }

                        var parts = target.split('@');
                        var id = parts[0];
                        var version = parts[1];

                        // If no version is specified, retrieve the version from config.xml
                        if(!saveToConfigXmlOn(config_json,opts) && !version && !cordova_util.isUrl(id) && !cordova_util.isDirectory(id)){
                            events.emit('verbose', 'no version specified, retrieving version from config.xml');
                            var ver = getVersionFromConfigFile(id, cfg);

                            if( cordova_util.isUrl(ver) || cordova_util.isDirectory(ver) ){
                                target = ver;
                            } else {
                                target = ver ? (id + '@' + ver) : target;
                            }
                        }

                        // Fetch the plugin first.
                        events.emit('verbose', 'Calling plugman.fetch on plugin "' + target + '"');
                        return plugman.raw.fetch(target, pluginsDir, { searchpath: searchPath, noregistry: opts.noregistry, link: opts.link, pluginInfoProvider: pluginInfoProvider});
                    })
                    .then(function(dir){
                        // save to config.xml 
                        if(saveToConfigXmlOn(config_json,opts)){
                            var pluginInfo =  pluginInfoProvider.get(dir);
                            var existingFeature = cfg.getFeature(pluginInfo.id);
                            if(!existingFeature){
                                var params = [{name:'id', value:pluginInfo.id}];
                                var pluginVersion = versionFromTargetString(target);
                                if(!pluginVersion && opts.shrinkwrap){
                                    pluginVersion = pluginInfo.version;
                                }
                                if(pluginVersion){
                                    params.push({ name: 'version', value: pluginVersion});
                                }
                                var url = require('url');

                                var uri = url.parse(target);
                                if ( uri.protocol && uri.protocol != 'file:' && uri.protocol[1] != ':' && !target.match(/^\w+:\\/)) {
                                    params.push({name:'url', value:target});
                                }else{
                                    var plugin_dir = cordova_util.fixRelativePath(path.join(target,  (opts.subdir || '.') ));
                                    if (fs.existsSync(plugin_dir)) {
                                        params.push({name:'installPath', value:target});
                                    }
                                }
                                if(opts.cli_variables){
                                    for(var varname in opts.cli_variables){
                                        if(opts.cli_variables.hasOwnProperty(varname)){
                                            params.push({name:varname, value:opts.cli_variables[varname]});
                                        }
                                    } 
                                }
                                cfg.addFeature(pluginInfo.name, params);
                                cfg.write();
                                events.emit('results', 'Saved plugin info for "'+pluginInfo.id+'" to config.xml');
                            }else{
                                events.emit('results', 'Plugin info for "'+pluginInfo.id+'" already exists in config.xml');
                            }
                        }
                        return dir;
                    })
                    .then(function(dir) {
                        // Validate top-level required variables
                        var pluginVariables = pluginInfoProvider.get(dir).getPreferences(),
                            missingVariables = pluginVariables.filter(function (v) {
                                return !(v in opts.cli_variables);
                            });
                        if (missingVariables.length) {
                            shell.rm('-rf', dir);
                            events.emit('results', 'Variable(s) missing (use: --variable ' + missingVariables.join('=value --variable ') + '=value).');
                            return;
                        }
                        // Iterate (in serial!) over all platforms in the project and install the plugin.
                        return platformList.reduce(function(soFar, platform) {
                            return soFar.then(function() {
                                var platformRoot = path.join(projectRoot, 'platforms', platform),
                                    options = {
                                        cli_variables: opts.cli_variables || {},
                                        browserify: opts.browserify || false,
                                        searchpath: searchPath,
                                        noregistry: opts.noregistry,
                                        link: opts.link,
                                        pluginInfoProvider: pluginInfoProvider
                                    },
                                    tokens,
                                    key,
                                    i;

                                // TODO: Remove this. CLI vars are passed as part of the opts object after "nopt" refactoring.
                                // Keeping for now for compatibility for API users.
                                //parse variables into cli_variables
                                for (i=0; i< opts.options.length; i++) {
                                    if (opts.options[i] === '--variable' && typeof opts.options[++i] === 'string') {
                                        tokens = opts.options[i].split('=');
                                        key = tokens.shift().toUpperCase();
                                        if (/^[\w-_]+$/.test(key)) {
                                            options.cli_variables[key] = tokens.join('=');
                                        }
                                    }
                                }

                                events.emit('verbose', 'Calling plugman.install on plugin "' + dir + '" for platform "' + platform + '" with options "' + JSON.stringify(options)  + '"');
                                return plugman.raw.install(platform, platformRoot, path.basename(dir), pluginsDir, options);
                            });
                        }, Q());
                    });
                }, Q()); // end Q.all
            }).then(function() {
                opts.cordova = { plugins: cordova_util.findPlugins(path.join(projectRoot, 'plugins')) };
                return hooksRunner.fire('after_plugin_add', opts);
            });
        case 'rm':
        case 'remove':
            if (!targets || !targets.length) {
                return Q.reject(new CordovaError('No plugin specified. Please specify a plugin to remove. See `'+cordova_util.binname+' plugin list`.'));
            }

            opts.cordova = { plugins: cordova_util.findPlugins(path.join(projectRoot, 'plugins')) };
            return hooksRunner.fire('before_plugin_rm', opts)
            .then(function() {
                return opts.plugins.reduce(function(soFar, target) {
                    // Check if we have the plugin.
                    if (plugins.indexOf(target) < 0) {
                        return Q.reject(new CordovaError('Plugin "' + target + '" is not present in the project. See `'+cordova_util.binname+' plugin list`.'));
                    }

                    // Iterate over all installed platforms and uninstall.
                    // If this is a web-only or dependency-only plugin, then
                    // there may be nothing to do here except remove the
                    // reference from the platform's plugin config JSON.
                    var plugman = require('../plugman/plugman');
                    return platformList.reduce(function(soFar, platform) {
                        return soFar.then(function() {
                            var platformRoot = path.join(projectRoot, 'platforms', platform);
                             events.emit('verbose', 'Calling plugman.uninstall on plugin "' + target + '" for platform "' + platform + '"');
                            return plugman.raw.uninstall.uninstallPlatform(platform, platformRoot, target, path.join(projectRoot, 'plugins'));
                        });
                    }, Q())
                    .then(function() {
                        // TODO: Should only uninstallPlugin when no platforms have it.
                        return plugman.raw.uninstall.uninstallPlugin(target, path.join(projectRoot, 'plugins'));
                    }).then(function(){
                        //remove plugin from config.xml
                        if(saveToConfigXmlOn(config_json, opts)){
                            var configPath = cordova_util.projectConfig(projectRoot);
                            if(fs.existsSync(configPath)){//should not happen with real life but needed for tests
                                var configXml = new ConfigParser(configPath);
                                var feature = configXml.doc.find('./feature/param[@name="id"][@value="' + target + '"]/..');
                                if(feature){
                                    var childs = configXml.doc.getroot().getchildren();
                                    var idx = childs.indexOf(feature);
                                    if(idx > -1){
                                        childs.splice(idx,1);
                                    }
                                    configXml.write();
                                    events.emit('results', 'config.xml entry for ' +target+ ' is removed');
                                }
                            }
                        }
                    });
                }, Q());
            }).then(function() {
                opts.cordova = { plugins: cordova_util.findPlugins(path.join(projectRoot, 'plugins')) };
                return hooksRunner.fire('after_plugin_rm', opts);
            });
        case 'search':
            return hooksRunner.fire('before_plugin_search')
            .then(function() {
                var plugman = require('../plugman/plugman');
                return plugman.raw.search(opts.plugins);
            }).then(function(plugins) {
                for(var plugin in plugins) {
                    events.emit('results', plugins[plugin].name, '-', plugins[plugin].description || 'no description provided');
                }
            }).then(function() {
                return hooksRunner.fire('after_plugin_search');
            });
        default:
            return list(projectRoot, hooksRunner);
    }
};

function getVersionFromConfigFile(plugin, cfg){
    var feature = cfg.getFeature(plugin);
    return feature && feature.params.version; 
}

function list(projectRoot, hooksRunner) {
    var pluginsList = [];
    return hooksRunner.fire('before_plugin_ls')
    .then(function() {
        var pluginsDir = path.join(projectRoot, 'plugins');
        // TODO: This should list based off of platform.json, not directories within plugins/
        var pluginInfoProvider = new PluginInfoProvider();
        return pluginInfoProvider.getAllWithinSearchPath(pluginsDir);
    })
    .then(function(plugins) {
        if (plugins.length === 0) {
            events.emit('results', 'No plugins added. Use `'+cordova_util.binname+' plugin add <plugin>`.');
            return;
        }
        var pluginsDict = {};
        var lines = [];
        var txt, p;
        for (var i=0; i<plugins.length; i++) {
            p = plugins[i];
            pluginsDict[p.id] = p;
            pluginsList.push(p.id);
            txt = p.id + ' ' + p.version + ' "' + (p.name || p.description) + '"';
            lines.push(txt);
        }
        // Add warnings for deps with wrong versions.
        for (var id in pluginsDict) {
            p = pluginsDict[id];
            for (var depId in p.deps) {
                var dep = pluginsDict[depId];
                //events.emit('results', p.deps[depId].version);
                //events.emit('results', dep != null);
                if (!dep) {
                    txt = 'WARNING, missing dependency: plugin ' + id +
                          ' depends on ' + depId +
                          ' but it is not installed';
                    lines.push(txt);
                } else if (!semver.satisfies(dep.version, p.deps[depId].version)) {
                    txt = 'WARNING, broken dependency: plugin ' + id +
                          ' depends on ' + depId + ' ' + p.deps[depId].version +
                          ' but installed version is ' + dep.version;
                    lines.push(txt);
                }
            }
        }
        events.emit('results', lines.join('\n'));
    })
    .then(function() {
        return hooksRunner.fire('after_plugin_ls');
    })
    .then(function() {
        return pluginsList;
    });
}

function saveToConfigXmlOn(config_json, options){
    options = options || {};
    var autosave =  config_json.auto_save_plugins || false;
    return autosave || options.save;
}

function versionFromTargetString(target){
    if (target[target.length - 1] == path.sep) {
        target = target.substring(0, target.length - 1);
    }
    var parts = target.split('@');
    if(!cordova_util.isUrl(parts[0]) && !cordova_util.isDirectory(parts[0])){
        return parts[1];
    }
}
