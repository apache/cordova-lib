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

var path             = require('path'),
    Q                = require('q'),
    cordova_util     = require('./util'),
    ConfigParser     = require('../configparser/ConfigParser'),
    events           = require('../events'),
    superspawn       = require('./superspawn'),
    PluginInfoProvider = require('../PluginInfoProvider'),
    CordovaError     = require('../CordovaError'),
    plugman_metadata = require('../plugman/util/metadata'),
    PlatformJson     = require('../plugman/util/PlatformJson');

module.exports = save;
function save(target, opts){
    opts = opts || {};
    cordova_util.cdProjectRoot();//checks if this is a cordova project
    var pluginInfoProvider = opts.pluginInfoProvider || new PluginInfoProvider();
    if( 'plugins' === target ){
        return savePlugins(opts.shrinkwrap, pluginInfoProvider);
    }
    if( 'platforms' === target ){
        return savePlatforms(opts.shrinkwrap);
    }
    throw new CordovaError('Unknown target only "plugins" and "platforms" are supported');
}

function savePlatforms(shrinkwrap){
    var projectHome = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectHome);
    var configXml = new ConfigParser(configPath);
    var platforms_on_fs = cordova_util.listPlatforms(projectHome);
    return Q.all( platforms_on_fs.map(function(p){
        var promise = new Q({'id':p});
        if(shrinkwrap){//retrieve and save platform version
            var script = path.join(projectHome, 'platforms', p, 'cordova', 'version');
            promise= superspawn.spawn(script).then(function(v){
                return {'id':p ,'version':v};
            });
        }
        //Clear the engines first
        var engines = configXml.getEngines();
        engines.forEach(function(e){
            configXml.removeEngine(e.id);
        });

        return Q.when(promise,
            function(theEngine){
                configXml.addEngine(theEngine.id,theEngine.version);
                configXml.write();
                events.emit('results', 'Saved platform info for "'+p+'" to config.xml');
            }
        );
    }));
}

function savePlugins(shrinkwrap, pluginInfoProvider){
    var projectHome = cordova_util.cdProjectRoot();
    var configPath = cordova_util.projectConfig(projectHome);
    var configXml = new ConfigParser(configPath);
    var pluginsPath = path.join(projectHome, 'plugins');
    var plugins = cordova_util.findPlugins(pluginsPath);
    var features = configXml.doc.findall('./feature/param[@name="id"]/..');
    //clear obsolete features with id params.
    for(var i=0; i<features.length; i++){
        //somehow elementtree remove fails on me
        var childs = configXml.doc.getroot().getchildren();
        var idx = childs.indexOf(features[i]);
        if(idx > -1){
            childs.splice(idx,1);
        }
    }
    // persist the removed features here if there are no plugins
    // to be added to config.xml otherwise we can delay the
    // persist to add feature
    if((!plugins || plugins.length<1) &&
          (features && features.length)){
        configXml.write();
    }

    return Q.all(plugins.map(function(plugin){
        var currentPluginPath = path.join(pluginsPath,plugin);
        var pluginInfo = pluginInfoProvider.get(currentPluginPath);
        var id = plugin;
        // filter out the dependency plugins. Top-level plugins list is not always accurate. 
        if(isDependencyPlugin(id)){
            events.emit('log', 'Skipping ' + plugin+ ', not a top-level plugin');
            return Q();
        }
        //save id
        var params = [{name:'id', value:id}];
        var fetchData = plugman_metadata.get_fetch_metadata(currentPluginPath);
        if(fetchData.source){
            var fetchSource = fetchData.source;
            if(fetchSource.type === 'git'){
                //restore the git url
                var restoredUrl = fetchSource.url;
                if(fetchSource.ref || fetchSource.subdir){
                    restoredUrl += '#';
                    if(fetchSource.ref){
                        restoredUrl += fetchSource.ref;
                    }
                    if(fetchSource.subdir){
                        restoredUrl += ':'+fetchSource.subdir;
                    }
                }
                params.push({name:'url', value:restoredUrl});
            }else
            if(fetchSource.type === 'local'){
                params.push({name:'installPath', value:fetchSource.path});
            }
        }
        //save version if shrinkwrapped
        if(shrinkwrap){
            params.push({ name: 'version', value: pluginInfo.version});
        }
        configXml.addFeature(pluginInfo.name, params);
        configXml.write();
        events.emit('results', 'Saved plugin info for "'+plugin+'" to config.xml');
        return Q();
    }));
}

function isDependencyPlugin(pluginId){
    var projectHome = cordova_util.cdProjectRoot();
    var pluginsPath = path.join(projectHome, 'plugins');
    var platforms = cordova_util.listPlatforms(projectHome);
    //If platforms do not exists it is best (but not necessarily accurate) to 
    //assume that this is a top level plugin. Because installed_plugins (top-level)
    //info is kept with the platform. Removing platform(s) causes the top-level info 
    //to be lost.
    if(platforms.length === 0 ){
        return false;
    }
    for(var i= 0; i< platforms.length; i++){
        var platformJson = PlatformJson.load(pluginsPath, platforms[i]);
        if (platformJson.root.dependent_plugins[pluginId])
        {
            return true;
        }
    }
    return false;
}

