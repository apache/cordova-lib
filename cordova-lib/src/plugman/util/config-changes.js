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

/* jshint node:true, bitwise:true, undef:true, trailing:true, quotmark:true,
          indent:4, unused:vars, latedef:nofunc,
          sub:true
*/

var fs   = require('fs'),
    path = require('path'),
    et   = require('elementtree'),
    semver = require('semver'),
    _ = require('underscore'),
    xml_helpers = require('../../util/xml-helpers'),
    platforms = require('./../platforms'),
    events = require('../../events'),
    ConfigKeeper = require('./ConfigKeeper');

var shelljs = require('shelljs');


// These frameworks are required by cordova-ios by default. We should never add/remove them.
var keep_these_frameworks = [
    'MobileCoreServices.framework',
    'CoreGraphics.framework',
    'AssetsLibrary.framework'
];


exports.PlatformMunger = PlatformMunger;

/******************************************************************************
Adapters to keep the current refactoring effort to within this file
******************************************************************************/
exports.add_plugin_changes = function(platform, project_dir, plugins_dir, plugin_id, plugin_vars, is_top_level, should_increment, cache) {
    var munger = new PlatformMunger(platform, project_dir, plugins_dir);
    munger.add_plugin_changes(plugin_id, plugin_vars, is_top_level, should_increment, cache);
    munger.save_all();
};

exports.remove_plugin_changes = function(platform, project_dir, plugins_dir, plugin_name, plugin_id, is_top_level, should_decrement) {
    // TODO: should_decrement parameter is never used, remove it here and wherever called
    var munger = new PlatformMunger(platform, project_dir, plugins_dir);
    munger.remove_plugin_changes(plugin_name, plugin_id, is_top_level);
    munger.save_all();
};

exports.process = function(plugins_dir, project_dir, platform) {
    var munger = new PlatformMunger(platform, project_dir, plugins_dir);
    munger.process();
    munger.save_all();
};

exports.get_munge_change = function(munge, keys) {
    return deep_find.apply(null, arguments);
};

/******************************************************************************/


exports.add_installed_plugin_to_prepare_queue = add_installed_plugin_to_prepare_queue;
function add_installed_plugin_to_prepare_queue(plugins_dir, plugin, platform, vars, is_top_level) {
    checkPlatform(platform);
    var config = exports.get_platform_json(plugins_dir, platform);
    config.prepare_queue.installed.push({'plugin':plugin, 'vars':vars, 'topLevel':is_top_level});
    exports.save_platform_json(config, plugins_dir, platform);
}

exports.add_uninstalled_plugin_to_prepare_queue = add_uninstalled_plugin_to_prepare_queue;
function add_uninstalled_plugin_to_prepare_queue(plugins_dir, plugin, platform, is_top_level) {
    checkPlatform(platform);

    var plugin_xml = xml_helpers.parseElementtreeSync(path.join(plugins_dir, plugin, 'plugin.xml'));
    var config = exports.get_platform_json(plugins_dir, platform);
    config.prepare_queue.uninstalled.push({'plugin':plugin, 'id':plugin_xml.getroot().attrib['id'], 'topLevel':is_top_level});
    exports.save_platform_json(config, plugins_dir, platform);
}


/******************************************************************************
* PlatformMunger class
*
* Can deal with config file of a single project.
* Parsed config files are cached in a ConfigKeeper object.
******************************************************************************/
function PlatformMunger(platform, project_dir, plugins_dir) {
    checkPlatform(platform);
    this.platform = platform;
    this.project_dir = project_dir;
    this.plugins_dir = plugins_dir;
    this.platform_handler = platforms[platform];
    this.config_keeper = new ConfigKeeper(project_dir);
}

// Write out all unsaved files.
PlatformMunger.prototype.save_all = PlatformMunger_save_all;
function PlatformMunger_save_all() {
    this.config_keeper.save_all();
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
                var xml = munge.parents[src][xml_child].xml;
                // Only add the framework if it's not a cordova-ios core framework
                if (keep_these_frameworks.indexOf(src) == -1) {
                    // xml_child in this case is whether the framework should use weak or not
                    if (remove) {
                        pbxproj.data.removeFramework(src);
                    } else {
                        pbxproj.data.addFramework(src, {weak: (xml === 'true')});
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
    var platform_config = exports.get_platform_json(self.plugins_dir, self.platform);
    var plugin_dir = path.join(self.plugins_dir, plugin_name);
    var plugin_vars = (is_top_level ? platform_config.installed_plugins[plugin_id] : platform_config.dependent_plugins[plugin_id]);

    // get config munge, aka how did this plugin change various config files
    var config_munge = self.generate_plugin_config_munge(plugin_dir, plugin_vars);
    // global munge looks at all plugins' changes to config files
    var global_munge = platform_config.config_munge;
    var munge = decrement_munge(global_munge, config_munge);

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

    // save
    exports.save_platform_json(platform_config, self.plugins_dir, self.platform);
}


PlatformMunger.prototype.add_plugin_changes = add_plugin_changes;
function add_plugin_changes(plugin_id, plugin_vars, is_top_level, should_increment) {
    var self = this;
    var platform_config = exports.get_platform_json(self.plugins_dir, self.platform);
    var plugin_dir = path.join(self.plugins_dir, plugin_id);

    var plugin_config = self.config_keeper.get(plugin_dir, '', 'plugin.xml');
    plugin_id = plugin_config.data.getroot().attrib.id;

    // get config munge, aka how should this plugin change various config files
    var config_munge = self.generate_plugin_config_munge(plugin_dir, plugin_vars);
    // global munge looks at all plugins' changes to config files

    // TODO: The should_increment param is only used by cordova-cli and is going away soon.
    // If should_increment is set to false, avoid modifying the global_munge (use clone)
    // and apply the entire config_munge because it's already a proper subset of the global_munge.
    var munge, global_munge;
    if (should_increment) {
        global_munge = platform_config.config_munge;
        munge = increment_munge(global_munge, config_munge);
    } else {
        global_munge = clone_munge(platform_config.config_munge);
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

    // save
    exports.save_platform_json(platform_config, self.plugins_dir, self.platform);
}


// Load the global munge from platform json and apply all of it.
// Used by cordova prepare to re-generate some config file from platform
// defaults and the global munge.
PlatformMunger.prototype.reapply_global_munge = reapply_global_munge ;
function reapply_global_munge () {
    var self = this;

    var platform_config = exports.get_platform_json(self.plugins_dir, self.platform);
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
    var plugin_config = self.config_keeper.get(plugin_dir, '', 'plugin.xml');
    var plugin_xml = plugin_config.data;

    var platformTag = plugin_xml.find('platform[@name="' + self.platform + '"]');
    // CB-6976 Windows Universal Apps. For smooth transition and to prevent mass api failures
    // we allow using windows8 tag for new windows platform
    if (self.platform == 'windows' && !platformTag) {
        platformTag = plugin_xml.find('platform[@name="' + 'windows8' + '"]');
    }

    var changes = [];
    // add platform-agnostic config changes
    changes = changes.concat(plugin_xml.findall('config-file'));
    if (platformTag) {
        // add platform-specific config changes if they exist
        changes = changes.concat(platformTag.findall('config-file'));

        // note down pbxproj framework munges in special section of munge obj
        // CB-5238 this is only for systems frameworks
        if (self.platform === 'ios') {
            var frameworks = platformTag.findall('framework');
            frameworks.forEach(function (f) {
                var custom = f.attrib['custom'];
                if (!custom) {
                    var file = f.attrib['src'];
                    var weak = ('true' == f.attrib['weak']).toString();

                    deep_add(munge, 'framework', file, { xml: weak, count: 1 });
                }
            });
        }
    }

    changes.forEach(function(change) {
        var target = change.attrib['target'];
        var parent = change.attrib['parent'];
        var after = change.attrib['after'];
        var xmls = change.getchildren();
        xmls.forEach(function(xml) {
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
            deep_add(munge, target, parent, { xml: stringified, count: 1, after: after });
        });
    });
    return munge;
}

// Go over the prepare queue an apply the config munges for each plugin
// that has been (un)installed.
PlatformMunger.prototype.process = PlatformMunger_process;
function PlatformMunger_process() {
    var self = this;

    var platform_config = exports.get_platform_json(self.plugins_dir, self.platform);

    // Uninstallation first
    platform_config.prepare_queue.uninstalled.forEach(function(u) {
        self.remove_plugin_changes(u.plugin, u.id, u.topLevel);
    });

    // Now handle installation
    platform_config.prepare_queue.installed.forEach(function(u) {
        self.add_plugin_changes(u.plugin, u.vars, u.topLevel, true);
    });

    platform_config = exports.get_platform_json(self.plugins_dir, self.platform);

    // Empty out installed/ uninstalled queues.
    platform_config.prepare_queue.uninstalled = [];
    platform_config.prepare_queue.installed = [];
    // save platform json
    exports.save_platform_json(platform_config, self.plugins_dir, self.platform);
}
/**** END of PlatformMunger ****/

// TODO: move save/get_platform_json to be part of ConfigKeeper or ConfigFile
// For now they are used in many places in plugman and cordova-cli and can
// save the file bypassing the ConfigKeeper's cache.
exports.get_platform_json = get_platform_json;
function get_platform_json(plugins_dir, platform) {
    checkPlatform(platform);

    var filepath = path.join(plugins_dir, platform + '.json');
    if (fs.existsSync(filepath)) {
        return fix_munge(JSON.parse(fs.readFileSync(filepath, 'utf-8')));
    } else {
        var config = {
            prepare_queue:{installed:[], uninstalled:[]},
            config_munge:{},
            installed_plugins:{},
            dependent_plugins:{}
        };
        return config;
    }
}

exports.save_platform_json = save_platform_json;
function save_platform_json(config, plugins_dir, platform) {
    checkPlatform(platform);
    var filepath = path.join(plugins_dir, platform + '.json');
    shelljs.mkdir('-p', plugins_dir);
    fs.writeFileSync(filepath, JSON.stringify(config, null, 4), 'utf-8');
}


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
                        deep_add(new_munge, [file, selector, { xml: xml_child, count: val }]);
                    }
                }
            }
        }
        platform_config.config_munge = new_munge;
    }

    return platform_config;
}



/******************************************************************************
* Utility functions
******************************************************************************/

// Check if we know such platform
function checkPlatform(platform) {
    if (!(platform in platforms)) throw new Error('platform "' + platform + '" not recognized.');
}

/******************************************************************************
* Munge object manipulations functions
******************************************************************************/

// add the count of [key1][key2]...[keyN] to obj
// return true if it didn't exist before
function deep_add(obj, keys /* or key1, key2 .... */ ) {
    if ( !Array.isArray(keys) ) {
        keys = Array.prototype.slice.call(arguments, 1);
    }

    return process_munge(obj, true/*createParents*/, function (parentArray, k) {
        var found = _.find(parentArray, function(element) {
            return element.xml == k.xml;
        });
        if (found) {
            found.after = found.after || k.after;
            found.count += k.count;
        } else {
            parentArray.push(k);
        }
        return !found;
    }, keys);
}

// decrement the count of [key1][key2]...[keyN] from obj and remove if it reaches 0
// return true if it was removed or not found
function deep_remove(obj, keys /* or key1, key2 .... */ ) {
    if ( !Array.isArray(keys) ) {
        keys = Array.prototype.slice.call(arguments, 1);
    }

    var result = process_munge(obj, false/*createParents*/, function (parentArray, k) {
        var index = -1;
        var found = _.find(parentArray, function (element) {
            index++;
            return element.xml == k.xml;
        });
        if (found) {
            found.count -= k.count;
            if (found.count > 0) {
                return false;
            }
            else {
                parentArray.splice(index, 1);
            }
        }
        return undefined;
    }, keys);

    return typeof result === 'undefined' ? true : result;
}

// search for [key1][key2]...[keyN]
// return the object or undefined if not found
function deep_find(obj, keys /* or key1, key2 .... */ ) {
    if ( !Array.isArray(keys) ) {
        keys = Array.prototype.slice.call(arguments, 1);
    }

    return process_munge(obj, false/*createParents?*/, function (parentArray, k) {
        return _.find(parentArray, function (element) {
            return element.xml == (k.xml || k);
        });
    }, keys);
}

// Execute func passing it the parent array and the xmlChild key.
// When createParents is true, add the file and parent items  they are missing
// When createParents is false, stop and return undefined if the file and/or parent items are missing

function process_munge(obj, createParents, func, keys /* or key1, key2 .... */ ) {
    if ( !Array.isArray(keys) ) {
        keys = Array.prototype.slice.call(arguments, 1);
    }
    var k = keys[0];
    if (keys.length == 1) {
        return func(obj, k);
    } else if (keys.length == 2) {
        if (!obj.parents[k] && !createParents) {
            return undefined;
        }
        obj.parents[k] = obj.parents[k] || [];
        return process_munge(obj.parents[k], createParents, func, keys.slice(1));
    } else if (keys.length == 3){
        if (!obj.files[k] && !createParents) {
            return undefined;
        }
        obj.files[k] = obj.files[k] || { parents: {} };
        return process_munge(obj.files[k], createParents, func, keys.slice(1));
    } else {
        throw new Error('Invalid key format. Must contain at most 3 elements (file, parent, xmlChild).');
    }
}

// All values from munge are added to base as
// base[file][selector][child] += munge[file][selector][child]
// Returns a munge object containing values that exist in munge
// but not in base.
function increment_munge(base, munge) {
    var diff = { files: {} };

    for (var file in munge.files) {
        for (var selector in munge.files[file].parents) {
            for (var xml_child in munge.files[file].parents[selector]) {
                var val = munge.files[file].parents[selector][xml_child];
                // if node not in base, add it to diff and base
                // else increment it's value in base without adding to diff
                var newlyAdded = deep_add(base, [file, selector, val]);
                if (newlyAdded) {
                    deep_add(diff, file, selector, val);
                }
            }
        }
    }
    return diff;
}

// Update the base munge object as
// base[file][selector][child] -= munge[file][selector][child]
// nodes that reached zero value are removed from base and added to the returned munge
// object.
function decrement_munge(base, munge) {
    var zeroed = { files: {} };

    for (var file in munge.files) {
        for (var selector in munge.files[file].parents) {
            for (var xml_child in munge.files[file].parents[selector]) {
                var val = munge.files[file].parents[selector][xml_child];
                // if node not in base, add it to diff and base
                // else increment it's value in base without adding to diff
                var removed = deep_remove(base, [file, selector, val]);
                if (removed) {
                    deep_add(zeroed, file, selector, val);
                }
            }
        }
    }
    return zeroed;
}

// For better readability where used
function clone_munge(munge) {
    return increment_munge({}, munge);
}
