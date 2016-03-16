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

var path          = require('path'),
    fs            = require('fs'),
    shell         = require('shelljs'),
    events        = require('cordova-common').events,
    config        = require('./config'),
    remoteLoad = require('./remote_load'),
    Q             = require('q'),
    CordovaError  = require('cordova-common').CordovaError,
    ConfigParser  = require('cordova-common').ConfigParser,
    cordova_util  = require('./util'),
    validateIdentifier = require('valid-identifier');

/**
 * Usage:
 * @dir - directory where the project will be created. Required.
 * @optionalId - app id. Optional.
 * @optionalName - app name. Optional.
 * @cfg - extra config to be saved in .cordova/config.json
 **/
// Returns a promise.
module.exports = create;
function create(dir, optionalId, optionalName, cfg) {
    var argumentCount = arguments.length;

    return Q.fcall(function() {
        // Lets check prerequisites first

        if (argumentCount == 3) {
          cfg = optionalName;
          optionalName = undefined;
        } else if (argumentCount == 2) {
          cfg = optionalId;
          optionalId = undefined;
          optionalName = undefined;
        }

        if (!dir) {
            throw new CordovaError('At least the dir must be provided to create new project. See `' + cordova_util.binname + ' help`.');
        }

        //read projects .cordova/config.json file for project settings
        var configFile = config.read(dir);

        //if data exists in the configFile, lets combine it with cfg
        //cfg values take priority over config file
        if(configFile) {
            var finalConfig = {};
            for(var key1 in configFile) {
                finalConfig[key1] = configFile[key1];
            }

            for(var key2 in cfg) {
                finalConfig[key2] = cfg[key2];
            }

            cfg = finalConfig;
        }

        if (!cfg) {
            throw new CordovaError('Must provide a project configuration.');
        } else if (typeof cfg == 'string') {
            cfg = JSON.parse(cfg);
        }

        if (optionalId) cfg.id = optionalId;
        if (optionalName) cfg.name = optionalName;

        // Make absolute.
        dir = path.resolve(dir);

        // dir must be either empty except for .cordova config file or not exist at all..
        var sanedircontents = function (d) {
            var contents = fs.readdirSync(d);
            if (contents.length === 0) {
                return true;
            } else if (contents.length == 1) {
                if (contents[0] == '.cordova') {
                    return true;
                }
            }
            return false;
        };

        if (fs.existsSync(dir) && !sanedircontents(dir)) {
            throw new CordovaError('Path already exists and is not empty: ' + dir);
        }

        if (cfg.id && !validateIdentifier(cfg.id)) {
            throw new CordovaError('App id contains a reserved word, or is not a valid identifier.');
        }


        // This was changed from "uri" to "url", but checking uri for backwards compatibility.
        cfg.lib = cfg.lib || {};
        cfg.lib.www = cfg.lib.www || {};
        cfg.lib.www.url = cfg.lib.www.url || cfg.lib.www.uri;

        if (!cfg.lib.www.url) {
            try {
                cfg.lib.www.url = require('cordova-app-hello-world').dirname;
            } catch (e) {
                // Falling back on npm@2 path hierarchy
                // TODO: Remove fallback after cordova-app-hello-world release
                cfg.lib.www.url = path.join(__dirname, '..', '..', 'node_modules', 'cordova-app-hello-world');
            }
        }

        // TODO (kamrik): extend lazy_load for retrieval without caching to allow net urls for --src.
        cfg.lib.www.version = cfg.lib.www.version || 'not_versioned';
        cfg.lib.www.id = cfg.lib.www.id || 'dummy_id';

        // Make sure that the source www/ is not a direct ancestor of the
        // target www/, or else we will recursively copy forever. To do this,
        // we make sure that the shortest relative path from source-to-target
        // must start by going up at least one directory or with a drive
        // letter for Windows.
        var rel_path = path.relative(cfg.lib.www.url, dir);
        var goes_up = rel_path.split(path.sep)[0] == '..';

        if (!(goes_up || rel_path[1] == ':')) {
            throw new CordovaError(
                'Project dir "' + dir +
                '" must not be created at/inside the template used to create the project "' +
                cfg.lib.www.url + '".'
            );
        }
    })
    .then(function() {
        // Finally, Ready to start!
        events.emit('log', 'Creating a new cordova project.');
    })
    .then(function() {
        // Strip link and url from cfg to avoid them being persisted to disk via .cordova/config.json.
        // TODO: apparently underscore has no deep clone.  Replace with lodash or something. For now, abuse JSON.
        var cfgToPersistToDisk = JSON.parse(JSON.stringify(cfg));

        delete cfgToPersistToDisk.lib.www;
        if (Object.keys(cfgToPersistToDisk.lib).length === 0) {
            delete cfgToPersistToDisk.lib;
        }

        // Update cached version of config.json
        var origAutoPersist = config.getAutoPersist();
        config.setAutoPersist(false);
        config(dir, cfgToPersistToDisk);
        config.setAutoPersist(origAutoPersist);
    })
    .then(function() {
        var gitURL;
        var branch;
        var parseArr;
        var packageName;
        var packageVersion;
        var isGit;
        var isNPM;

        if (!!cfg.lib.www.link) {
            events.emit('verbose', 'Symlinking assets."');
            return cfg.lib.www.url;
        } else {
            events.emit('verbose', 'Copying assets."');

            isGit = cfg.lib.www.template && cordova_util.isUrl(cfg.lib.www.url);
            isNPM = cfg.lib.www.template && (cfg.lib.www.url.indexOf('@') > -1 || !fs.existsSync(path.resolve(cfg.lib.www.url)));

            if (isGit) {
                parseArr = cfg.lib.www.url.split('#');
                gitURL = parseArr[0];
                branch = parseArr[1];

                events.emit('log', 'Retrieving ' + cfg.lib.www.url + ' using git...');

                return remoteLoad.gitClone(gitURL, branch).fail(
                    function(err) {
                        return Q.reject(new CordovaError('Failed to retrieve '+ cfg.lib.www.url + ' using git: ' + err.message));
                    }
                );
            } else if (isNPM) {
                events.emit('log', 'Retrieving ' + cfg.lib.www.url + ' using npm...');

                // Determine package name, and version
                if (cfg.lib.www.url.indexOf('@') !== -1) {
                    parseArr = cfg.lib.www.url.split('@');
                    packageName = parseArr[0];
                    packageVersion = parseArr[1];
                } else {
                    packageName = cfg.lib.www.url;
                    packageVersion = 'latest';
                }

                return remoteLoad.npmFetch(packageName, packageVersion).fail(
                    function(err) {
                        events.emit('warn', err.message);
                        return Q.reject(new CordovaError('Failed to retrieve '+ cfg.lib.www.url + ' using npm: ' + err.message));
                    }
                );
            } else {
                cfg.lib.www.url = path.resolve(cfg.lib.www.url);

                return Q(cfg.lib.www.url);
            }
        }
    })
    .then(function(input_directory) {
        var import_from_path = input_directory;
        
        //handle when input wants to specify sub-directory 
        try {
            var templatePkg = require(input_directory);
            if (templatePkg && templatePkg.dirname){
                import_from_path = templatePkg.dirname;
            }
        } catch (e) {
            events.emit('verbose', 'Can not load template package.json using directory ' + input_directory); 
        }
         
        if (!fs.existsSync(import_from_path)) {
            throw new CordovaError('Could not find directory: ' +
                import_from_path);
        }

        var paths = {
            root: import_from_path,
            www: import_from_path
        };

        // Keep going into child "www" folder if exists in stock app package.
        // why?
        while (fs.existsSync(path.join(paths.www, 'www'))) {
            paths.root = paths.www;
            paths.www = path.join(paths.root, 'www');
        }

        // find config.xml
        if (fs.existsSync(path.join(paths.root, 'config.xml'))) {
            paths.configXml = path.join(paths.root, 'config.xml');
            paths.configXmlLinkable = true;
        } else {
            try {
                paths.configXml =
                    path.join(require('cordova-app-hello-world').dirname,
                        'config.xml');
            } catch (e) {
                // Falling back on npm@2 path hierarchy
                // TODO: Remove fallback after cordova-app-hello-world release
                paths.configXml =
                    path.join(__dirname, '..', '..', 'node_modules',
                        'cordova-app-hello-world', 'config.xml');
            }
        }
        if (fs.existsSync(path.join(paths.root, 'merges'))) {
            paths.merges = path.join(paths.root, 'merges');
        } else {
            // No merges by default
        }
        if (fs.existsSync(path.join(paths.root, 'hooks'))) {
            paths.hooks = path.join(paths.root, 'hooks');
            paths.hooksLinkable = true;
        } else {
            try {
                paths.hooks =
                    path.join(require('cordova-app-hello-world').dirname,
                        'hooks');
            } catch (e) {
                // Falling back on npm@2 path hierarchy
                // TODO: Remove fallback after cordova-app-hello-world release
                paths.hooks =
                    path.join(__dirname, '..', '..', 'node_modules',
                        'cordova-app-hello-world', 'hooks');
            }
        }

        var dirAlreadyExisted = fs.existsSync(dir);
        if (!dirAlreadyExisted) {
            fs.mkdirSync(dir);
        }


        var tryToLink = !!cfg.lib.www.link;
        function copyOrLink(src, dst, linkable) {
            if (src) {
                if (tryToLink && linkable) {
                    fs.symlinkSync(src, dst, 'dir');
                } else {
                    shell.mkdir(dst);
                    shell.cp('-R', path.join(src, '*'), dst);
                }
            }
        }

        /*
        Copies template files, and directories into a Cordova project directory.
        Files, and directories not copied include: www, mergers,platforms,
        plugins, hooks, and config.xml. A template directory, and platform
        directory must be passed.

        templateDir - Template directory
        projectDir - Project directory
         */
        function copyTemplateFiles(templateDir, projectDir) {
            var templateFiles;		// Current file

            templateFiles = fs.readdirSync(templateDir);

            // Remove directories, and files that are automatically copied
            templateFiles = templateFiles.filter(
                function (value) {
                    return !(value === 'www' || value === 'mergers' ||
                    value === 'config.xml' || value === 'hooks');
                }
            );

            // Copy each template file
            for (var i = 0; i < templateFiles.length; i++)
                shell.cp('-R', path.resolve(templateDir, templateFiles[i]), projectDir);
        }

        try {
            copyOrLink(paths.www, path.join(dir, 'www'), true);
            copyOrLink(paths.merges, path.join(dir, 'merges'), true);
            copyOrLink(paths.hooks, path.join(dir, 'hooks'),
                paths.hooksLinkable);

            if (cfg.lib.www.template)
                copyTemplateFiles(import_from_path, dir);

            if (paths.configXml) {
                if (tryToLink && paths.configXmlLinkable) {
                    fs.symlinkSync(paths.configXml, path.join(dir, 'config.xml'));
                } else {
                    shell.cp(paths.configXml, path.join(dir, 'config.xml'));
                }
            }
        } catch (e) {
            if (!dirAlreadyExisted) {
                shell.rm('-rf', dir);
            }
            if (process.platform.slice(0, 3) == 'win' && e.code == 'EPERM')  {
                throw new CordovaError('Symlinks on Windows require Administrator privileges');
            }
            throw e;
        }
        // Create basic project structure.
        if (!fs.existsSync(path.join(dir, 'platforms')))
            shell.mkdir(path.join(dir, 'platforms'));

        if (!fs.existsSync(path.join(dir, 'plugins')))
            shell.mkdir(path.join(dir, 'plugins'));

        // Write out id and name to config.xml
        var configPath = cordova_util.projectConfig(dir);
        var conf = new ConfigParser(configPath);
        if (cfg.id) conf.setPackageName(cfg.id);
        if (cfg.name) conf.setName(cfg.name);
        conf.write();
    });
}
