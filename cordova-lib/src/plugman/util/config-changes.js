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

/*
 * This module deals with shared configuration / dependency "stuff". That is:
 * - XML configuration files such as config.xml, AndroidManifest.xml or WMAppManifest.xml.
 * - plist files in iOS
 * - pbxproj files in iOS
 * Essentially, any type of shared resources that we need to handle with awareness
 * of how potentially multiple plugins depend on a single shared resource, should be
 * handled in this module.
 *
 * The implementation uses an object as a hash table, with "leaves" of the table tracking
 * reference counts.
 */

/* jshint sub:true */

var fs   = require('fs'),
    path = require('path'),
    et   = require('elementtree'),
    semver = require('semver'),
    platforms = require('./../platforms'),
    events = require('../../events'),
    ConfigKeeper = require('./ConfigKeeper');

var mungeutil = require('./munge-util');


// These frameworks are required by cordova-ios by default. We should never add/remove them.
var keep_these_frameworks = [
    'MobileCoreServices.framework',
    'CoreGraphics.framework',
    'AssetsLibrary.framework'
];


exports.PlatformMunger = PlatformMunger;

exports.process = function(plugins_dir, project_dir, platform, platformJson, pluginInfoProvider) {
    var munger = new PlatformMunger(platform, project_dir, plugins_dir, platformJson, pluginInfoProvider);
    munger.process();
    munger.save_all();
};

/******************************************************************************
* PlatformMunger class
*
* Can deal with config file of a single project.
* Parsed config files are cached in a ConfigKeeper object.
******************************************************************************/
function PlatformMunger(platform, project_dir, plugins_dir, platformJson, pluginInfoProvider) {
    checkPlatform(platform);
    this.platform = platform;
    this.project_dir = project_dir;
    this.plugins_dir = plugins_dir;
    this.platform_handler = platforms[platform];
    this.config_keeper = new ConfigKeeper(project_dir);
    this.platformJson = platformJson;
    this.pluginInfoProvider = pluginInfoProvider;
}

// Write out all unsaved files.
PlatformMunger.prototype.save_all = PlatformMunger_save_all;
function PlatformMunger_save_all() {
    this.config_keeper.save_all();
    this.platformJson.save();
}

// Apply a munge object to a single config file.
// The remove parameter tells whether to add the change or remove it.
PlatformMunger.prototype.apply_file_munge = PlatformMunger_apply_file_munge;
function PlatformMunger_apply_file_munge(file, munge, remove) {
    var self = this;
    var xml_child;

    if ( file === 'framework' && self.platform === 'ios' ) {
        // ios pbxproj file
        var pbxproj = self.config_keeper.get(self.project_dir, self.platform, 'framework');
        // CoreLocation dependency removed in cordova-ios@3.6.0.
        var keepFrameworks = keep_these_frameworks;
        if (semver.lt(pbxproj.cordovaVersion, '3.6.0-dev')) {
            keepFrameworks = keepFrameworks.concat(['CoreLocation.framework']);
        }
        for (var src in munge.parents) {
            for (xml_child in munge.parents[src]) {
                var weak = munge.parents[src][xml_child].xml;
                // Only add the framework if it's not a cordova-ios core framework
                if (keep_these_frameworks.indexOf(src) == -1) {
                    // xml_child in this case is whether the framework should use weak or not
                    if (remove) {
                        pbxproj.data.removeFramework(src);
                    } else {
                        pbxproj.data.addFramework(src, {weak: weak});
                    }
                    pbxproj.is_changed = true;
                }
            }
        }
    } else {
        // all other types of files
        for (var selector in munge.parents) {
            for (xml_child in munge.parents[selector]) {
                // this xml child is new, graft it (only if config file exists)
                var config_file = self.config_keeper.get(self.project_dir, self.platform, file);
                if (config_file.exists) {
                    if (remove) config_file.prune_child(selector, munge.parents[selector][xml_child]);
                    else config_file.graft_child(selector, munge.parents[selector][xml_child]);
                }
            }
        }
    }
}


PlatformMunger.prototype.remove_plugin_changes = remove_plugin_changes;
function remove_plugin_changes(plugin_name, plugin_id, is_top_level) {
    var self = this;
    var platform_config = self.platformJson.root;
    var plugin_dir = path.join(self.plugins_dir, plugin_name);
    var plugin_vars = (is_top_level ? platform_config.installed_plugins[plugin_id] : platform_config.dependent_plugins[plugin_id]);

    // get config munge, aka how did this plugin change various config files
    var config_munge = self.generate_plugin_config_munge(plugin_dir, plugin_vars);
    // global munge looks at all plugins' changes to config files
    var global_munge = platform_config.config_munge;
    var munge = mungeutil.decrement_munge(global_munge, config_munge);

    for (var file in munge.files) {
        if (file == 'plugins-plist' && self.platform == 'ios') {
            // TODO: remove this check and <plugins-plist> sections in spec/plugins/../plugin.xml files.
            events.emit(
                'warn',
                'WARNING: Plugin "' + plugin_id + '" uses <plugins-plist> element(s), ' +
                'which are no longer supported. Support has been removed as of Cordova 3.4.'
            );
            continue;
        }
        // CB-6976 Windows Universal Apps. Compatibility fix for existing plugins.
        if (self.platform == 'windows' && file == 'package.appxmanifest' &&
            !fs.existsSync(path.join(self.project_dir, 'package.appxmanifest'))) {
            // New windows template separate manifest files for Windows8, Windows8.1 and WP8.1
            var substs = ['package.phone.appxmanifest', 'package.windows.appxmanifest', 'package.windows80.appxmanifest'];
            for (var subst in substs) {
                events.emit('verbose', 'Applying munge to ' + substs[subst]);
                self.apply_file_munge(substs[subst], munge.files[file], true);
            }
        }
        self.apply_file_munge(file, munge.files[file], /* remove = */ true);
    }

    // Remove from installed_plugins
    if (is_top_level) {
        delete platform_config.installed_plugins[plugin_id];
    } else {
        delete platform_config.dependent_plugins[plugin_id];
    }
}


PlatformMunger.prototype.add_plugin_changes = add_plugin_changes;
function add_plugin_changes(plugin_id, plugin_vars, is_top_level, should_increment) {
    var self = this;
    var platform_config = self.platformJson.root;
    var plugin_dir = path.join(self.plugins_dir, plugin_id);

    // get config munge, aka how should this plugin change various config files
    var config_munge = self.generate_plugin_config_munge(plugin_dir, plugin_vars);
    // global munge looks at all plugins' changes to config files

    // TODO: The should_increment param is only used by cordova-cli and is going away soon.
    // If should_increment is set to false, avoid modifying the global_munge (use clone)
    // and apply the entire config_munge because it's already a proper subset of the global_munge.
    var munge, global_munge;
    if (should_increment) {
        global_munge = platform_config.config_munge;
        munge = mungeutil.increment_munge(global_munge, config_munge);
    } else {
        global_munge = mungeutil.clone_munge(platform_config.config_munge);
        munge = config_munge;
    }

    for (var file in munge.files) {
        // TODO: remove this warning some time after 3.4 is out.
        if (file == 'plugins-plist' && self.platform == 'ios') {
            events.emit(
                'warn',
                'WARNING: Plugin "' + plugin_id + '" uses <plugins-plist> element(s), ' +
                'which are no longer supported. Support has been removed as of Cordova 3.4.'
            );
            continue;
        }
        // CB-6976 Windows Universal Apps. Compatibility fix for existing plugins.
        if (self.platform == 'windows' && file == 'package.appxmanifest' &&
            !fs.existsSync(path.join(self.project_dir, 'package.appxmanifest'))) {
            var substs = ['package.phone.appxmanifest', 'package.windows.appxmanifest', 'package.windows80.appxmanifest'];
            for (var subst in substs) {
                events.emit('verbose', 'Applying munge to ' + substs[subst]);
                self.apply_file_munge(substs[subst], munge.files[file]);
            }
        }
        self.apply_file_munge(file, munge.files[file]);
    }

    // Move to installed_plugins if it is a top-level plugin
    if (is_top_level) {
        platform_config.installed_plugins[plugin_id] = plugin_vars || {};
    } else {
        platform_config.dependent_plugins[plugin_id] = plugin_vars || {};
    }
}


// Load the global munge from platform json and apply all of it.
// Used by cordova prepare to re-generate some config file from platform
// defaults and the global munge.
PlatformMunger.prototype.reapply_global_munge = reapply_global_munge ;
function reapply_global_munge () {
    var self = this;

    var platform_config = self.platformJson.root;
    var global_munge = platform_config.config_munge;
    for (var file in global_munge.files) {
        // TODO: remove this warning some time after 3.4 is out.
        if (file == 'plugins-plist' && self.platform == 'ios') {
            events.emit(
                'warn',
                'WARNING: One of your plugins uses <plugins-plist> element(s), ' +
                'which are no longer supported. Support has been removed as of Cordova 3.4.'
            );
            continue;
        }

        self.apply_file_munge(file, global_munge.files[file]);
    }
}


// generate_plugin_config_munge
// Generate the munge object from plugin.xml + vars
PlatformMunger.prototype.generate_plugin_config_munge = generate_plugin_config_munge;
function generate_plugin_config_munge(plugin_dir, vars) {
    var self = this;

    vars = vars || {};
    // Add PACKAGE_NAME variable into vars
    if (!vars['PACKAGE_NAME']) {
        vars['PACKAGE_NAME'] = self.platform_handler.package_name(self.project_dir);
    }

    var munge = { files: {} };
    var pluginInfo = self.pluginInfoProvider.get(plugin_dir);

    var changes = pluginInfo.getConfigFiles(self.platform);

    // note down pbxproj framework munges in special section of munge obj
    // CB-5238 this is only for systems frameworks
    if (self.platform === 'ios') {
        var frameworks = pluginInfo.getFrameworks(self.platform);
        frameworks.forEach(function (f) {
            if (!f.custom) {
                mungeutil.deep_add(munge, 'framework', f.src, { xml: f.weak, count: 1 });
            }
        });
    }

    changes.forEach(function(change) {
        change.xmls.forEach(function(xml) {
            // 1. stringify each xml
            var stringified = (new et.ElementTree(xml)).write({xml_declaration:false});
            // interp vars
            if (vars) {
                Object.keys(vars).forEach(function(key) {
                    var regExp = new RegExp('\\$' + key, 'g');
                    stringified = stringified.replace(regExp, vars[key]);
                });
            }
            // 2. add into munge
            mungeutil.deep_add(munge, change.target, change.parent, { xml: stringified, count: 1, after: change.after });
        });
    });
    return munge;
}

// Go over the prepare queue and apply the config munges for each plugin
// that has been (un)installed.
PlatformMunger.prototype.process = PlatformMunger_process;
function PlatformMunger_process() {
    var self = this;
    var platform_config = self.platformJson.root;

    // Uninstallation first
    platform_config.prepare_queue.uninstalled.forEach(function(u) {
        self.remove_plugin_changes(u.plugin, u.id, u.topLevel);
    });

    // Now handle installation
    platform_config.prepare_queue.installed.forEach(function(u) {
        self.add_plugin_changes(u.plugin, u.vars, u.topLevel, true);
    });

    // Empty out installed/ uninstalled queues.
    platform_config.prepare_queue.uninstalled = [];
    platform_config.prepare_queue.installed = [];
}
/**** END of PlatformMunger ****/

/******************************************************************************
* Utility functions
******************************************************************************/

// Check if we know such platform
function checkPlatform(platform) {
    if (!(platform in platforms)) throw new Error('platform "' + platform + '" not recognized.');
}

