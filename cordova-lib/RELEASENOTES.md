<!--
#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
#
-->
# Cordova-lib Release Notes

### 4.3.0 (Feb 27, 2015)
* updated pinned versions of ios to 3.8.0 and android to 3.7.1
* CB-8524 Switched to the latest Windows release
* changed createpackage.json keyword to ecosystem:cordova
* CB-8448 add support for activities
* CB-8482 rename: platformId -> platformName
* CB-8482: Update engine syntax within config.xml
* Organize save logic some more
* --save flag for plugins
* fix for test after prepare changes
* restore plugins and platforms on prepare
* CB-8472 Can't find config.xml error installing browser platform after plugin.  (close #167)
* CB-8469 android: Call into platform's build.js after `plugin add` so that Android Studio will work without needing an explicit command-line build first
* CB-8123 Fix JSHINT issue.
* CB-8123 Fix path handling so tests work on any platform.
* CB-8123 Rename further windows platform related files.
* CB-8123 Rename windows platform related files.
* CB-8123 Plugin references can target specific windows platforms.
* CB-8420 Make `cordova plugin add FOO` use version from config.xml (close #162)
* CB-8239 Fix `cordova platform add PATH` when PATH is relative and CWD != project root
* CB-8227 CB8237 CB-8238 Add --save flag and autosave to 'cordova platform add', 'cordova platform remove' and 'cordova platform update'
* CB-8409 compile: bubble failures
* CB-8239 Fix "platform update" should ignore `<cdv:engine>` (close #159)
* CB-8390 android: Make `<framework custom=false>` work with Gradle
* CB-8416 updated plugman publish to temporarily rename existing package.json files
* CB-8416: added `plugman createpackagejson .` command to create a package.json from plugin.xml
* CB-6973 add spec-plugman to npm run jshint
* CB-6973 fix spec-plugman jshint failures
* CB-6973 have base rules in jshintrc for spec-plugman
* CB-8377 Fixed <runs> tag parsing (close #156)
* CB-5696 find ios project directory using the xcode project file (close #151)
* CB-8373 android: Add gradle references to project.properties rather than build.gradle
* CB-8370 Make "plugman publish" without args default to CWD
* Fix publish type-error introduced in recent commit 15adc1b9fcc069438f5
* CB-8366 android: Remove empty `<framework>` directory upon uninstall
* CB-6973 Enable JSHint for spec-cordova
* CB-8239 Add support for git urls to 'cordova platform add' (close #148)
* CB-8358 Add `--link` for `platform add` and `platform update`
* CB-6973 remove base rules from individual files in src
* CB-6973 have base rules in .jshintrc file
* Add shims to undo breaking change in a20b3ae3 (didn't realize PluginInfo was exported)
* CB-8354 Add --link support for iOS source and header files
* Make all ad-hoc plugin.xml parsing use PluginInfo instead
* Make all usages of PluginInfo use PluginInfoProvider instead
* Add PluginInfoProvider for better caching of PluginInfo
* CB-8284 revert npm dependency due to issues with registry
* CB-8223 Expose config.xml in the Browser platform (close #149)
* CB-8168 --list support for cordova-lib (close #145)
* [Amazon] Improve error message when `<source-file>` is missing `target-dir`
* refactor: Make addUninstalledPluginToPrepareQueue take pluginId rather than dirName
* Chnage plugman test plugins to have IDs as directory names
* Make all test plugin IDs unique
* Empty out contents of plugin test files (and delete some unused ones)
* CB-4789 refactor: Remove config_changes.get/set_platform_json in favour of PlatformJson
* CB-8319 Remove config_changes module from plugman's public API
* CB-8314 Speed up Travis CI (close #150)
* refactor: Extract PlatformJson and munge-util into separate modules
* refactor: Move ConfigFile and ConfigKeeper into their own files
* CB-8285 Fix regression caused by c49eaa86c92b (PluginInfo's are cached, don't change them)
* CB-8208 Made CI systems to get cordova-js dependency from gihub (close #146)
* CB-8285 Don't create .fetch.json files within plugin directories
* CB-8286 Never persist value of create --link-to within .cordova/config.json
* CB-8288 Don't set config.setAutoPersist() in cordova.create
* Fix create spec sometimes failing because it's deleted its own tmp directory
* CB-8153 generate cordova_plugins.json for browserify based projects
* CB-8043 CB-6462 CB-6105 Refactor orientation preference support (close #128)
* FirefoxOS parser: allow passing in a ConfigParser object
* Parsers: extend base parser with helper functions
* CB-8244 android: Have `plugin add --link` create symlinks for `<source-file>`, `<framework>`, etc 
* CB-8244 Pass options object to platform handlers in plugman (commit attempt #2)
* CB-8226 'cordova platform add' : Look up version in config.xml if no version specified
* Delete root .npmignore, since there's no node module there

### 4.2.0 (Jan 06, 2015)
* `ConfigParser`: refactor `getPreference()`
* Parsers: add base parser (parser.js) and make platform parsers inherit from it
* Parsers: assign methods without overriding the prototype
* CB-8225 Add Unit Tests for `platform.js/add` function (closes #138)
* CB-8230 Make `project.properties` optional for Android sub-libraries
* CB-8215 Improve error message when `<source-file>` is missing `target-dir` on android
* CB-8217 Fix plugin add --link when plugin given as relative path
* CB-8216 Resolve plugin paths relative to original CWD
* CB-7311 Fix tests on windows for iOS parser
* CB-7803 Allow adding any platform on any host OS (close #126)
* CB-8155 Do not fail plugin installation from git url with --link (close #129)
* Updates README with description of npm commands for this package
* CB-8129 Adds 'npm run cover' command to generate tests coverage report (close #131)
* CB-8114 Specify a cache-min-time for plugins (closes #133)
* CB-8190 Make plugman config/cache directory to be customizable via PLUGMAN_HOME (close #134)
* CB-7863 Fixed broken test run on Windows 8.1 caused by incorrect use of promises (close #132, close #112)
* CB-7610 Fix `cordova plugin add d:\path` (or any other non-c: path) (close #135)
* CB-8179 Corrected latest wp8 version
* CB-8158 added hasModule check to browserify code
* CB-8173 Point to the latest ubuntu version
* CB-8179 Point to the latest wp8 version
* CB-8158 adding symbolList to cordova.js
* CB-8154 Fix errors adding platforms or plugins
* browserify: updated require to use symbollist
* Amazon related changes. Added a type named "gradleReference" in framework according to https://git-wip-us.apache.org/repos/asf?p=cordova-lib.git;a=commit;h=02a96d757acc604610eb403cf11f79513ead4ac5
* CB-7736 Update npm dep to promote qs module to 1.0
* Added a missing "else" keyword.
* CB-8086 Fixed framework tests.
* CB-8086 Added an explanatory comment.
* CB-8086 Prefixed subprojects with package name.
* CB-8067 externalized valid-identifier it is it's own module
* Added identifier checking for app id, searches for java+C# reserved words
* [CB-6472] Adding content to -Info.plist - Unexpected behaviour
* CB-8053: Including a project reference in a plugin fails on Windows platform.
* Pass the searchpath when installing plugins
* Add a type named "gradleReference" in framework

### 4.1.2 (Nov 13, 2014)
* CB-7079 Allow special characters and digits in id when publishing to plugins registry
* CB-7988: Update platform versions for iOS, wp8 & Windows to 3.7.0
* CB-7846 Fix plugin deletion when dependency plugin does not exist
* CB-6992 Fix build issue on iOS when app name contains accented characters
* CB-7890 validate file copy operations in plugman
* CB-7884 moved platform metadata to platformsConfig.json
* Amazon Specific changes: Added support for SdkVersion
* Expose PluginInfo from cordova-lib
* CB-7839 android: Fix versionCode logic when version is less than 3 digits
* CB-7033 Improve cordova platform check
* CB-7311 Fix xcode project manipulation on Windows host
* CB-7820 Make cordova platfrom restore not stop if a platforms fails to restore
* CB-7649 Support iPhone 6 Plus Icon in CLI config.xml
* CB-7647 Support new iPhone 6 and 6 Plus Images in the CLI config.xml
* CB-7909 "plugman platform add" fixes
* Enable platform-specific id for android and ios
* Check for a CORDOVA_HOME environment variable to create a global config path

### 4.0.0 (Oct 10, 2014)
* Bumped version to 4.0.0 to be semVer complient and to match cli version
* Pinned dependencies in package.json
* updated platforms.js for 3.6.4
* CB-5390 Uninstall - recursively remove dependencies of dependencies
* fixes HooksRunner test - should run before_plugin_uninstall
* CB-6481 getPluginsHookScripts to work if plugin platform not defined
* CB-6481 Context opts should copy not reference
* CB-6481 Fixed tests - removed output
* CB-6481 Fixed HooksRunner and tests Avoided issue with parallel tests running Added checks for handling mocked config.xml and package.json in HooksRunner and scriptsFinder Addressed jshint issues Renamed ScriptsFinder to scriptsFinder
* CB-6481 Addressed community review notes: Removed commonModules from Context Renamed Hooker and subclasses to HooksRunner and scriptsFinder Moved scriptsRunner code into HooksRunner
* CB-6481 Replaced CordovaError throwings with Error per @kamrik review Extracted prepareOptions Hooker method
* CB-6481 Docs: deprecated .cordova/hooks + other minor updates
* CB-6481 Updated hooks documentation
* CB-6481 Added unified hooks support for cordova app and plugins
* CB-7572 Serve - respond with 304 when resource not modified
* computeCommitId for browserify workflow fixed to handle cli and non cli workflows:q
* CB-7219 prepare-browserify now supports commitId and platformVersion for cordovajs
* CB-7219: initial work for cordova.js platformVersion
* CB-7219 prepare-browserify now supports commitId and platformVersion for cordovajs
* CB-7219: initial work for cordova.js platformVersion
* CB-7383 Updated version and RELEASENOTES.md for release 0.21.13
* Fix CB-7615 Read config.xml after pre-prepare hooks fire
* CB-7578 Windows. Fix platform name reported by pre_package hook
* CB-7576 Support 'windows' merges folder for Windows platform
* Revert "Merge branch 'browserPlatform' of https://github.com/surajpindoria/cordova-lib"
* Added tests for browser platform

### 0.21.13
* remove shrinkwrap

### 0.21.12
* CB-7383: depend on a newer version of cordova-js, bump self version

### 0.21.11
* bump version numbers of platforms to 3.6.3

### 0.21.10 (Sep 05, 2014)
* CB-7457 - cordova plugin add --searchpath does not recurse through subfolders when a plugin.xml is malformed in one of them
* CB-7457 - Add malformed plugin for tests
* [Windows8] Fix failing test to match updated functionality
* CB-7420 Windows. Plugin <resource-file>s are removed from platform during prepare
* Windows helper. Removes unnecessary $(MSBuildThisFileDirectory)
* updated Releasenotes.md
* updated version to 0.21.10-dev
* CB-7457 - cordova plugin add --searchpath does not recurse through subfolders when a plugin.xml is malformed in one of them
* CB-7457 - Add malformed plugin for tests
* [Windows8] Fix failing test to match updated functionality
* updated Releasenotes.md
* updated version to 0.21.10-dev
* updated version, updated ffos to use 3.6.1, updated cordova-js dependency to be strcit
* CB-7383 Incremented package version to -dev
* updated platforms.js to use 3.6.0
*  Updated version and RELEASENOTES.md for release 0.21.8
* CB-5535: Remove "--arc" from ios platform creation args
* Windows helper. Removes unnecessary $(MSBuildThisFileDirectory)
* CB-7420 Windows. Plugin <resource-file>s are removed from platform during prepare
* CB-7416 Fixes file path reference when adding new source file
* CB-7416 handleInstall tests for null platformTag. removed uncalled 'hasPlatformSection' from PluginInfo.js
* Remove use of path.join for manifest.launch_path
* CB-7347 Improve cordova platform add /path/to handling
* CB-7118 (fix jshint warnings)
* CB-7114 Android: add support of min/max/target SDK to config.xml
* CB-7118 Use updated version of node-xcode
* CB-7118 iOS: add target-device and MinimumOSVersion support to config.xml
* ubuntu: support incremental builds
* ubuntu: support target-dir for resource-file
* ubuntu: use common.copyFile
* ubuntu: check icon existence
* ffos: Make author url optional
* CB-7142 Add <variable> to <feature> for "plugin restore" command
* Set git clone depth to 10 for Travis to make it faster
* windows: update as per changed manifest file names
* Don't spy and expect it to call the other spy ...
* Well that looks like an error
* Fixing failing tests: update_proj should be update_project
* Fix failing tests. update_jsproj and update_csproj are now just update_proj
* Fix jshint errors in amazon_fireos_parser : mixed single/double quotes
* CB-6699 Include files from www folder via single element (use ** glob pattern)
* Taking care of dashes in amazon-fireos platform name.
* Upleveled amazon-fireos changes.
* Fix link/copy parent check for windows
* Style fixes - comments
* Fix error in comments for munge functions
* Add link to BuildBot at ci.cordova.io in README
* CB-7255 Fixed writing plist unescaped
* Allow plugin modules to be .json files
* Style fixes - white space only
* Add JSCS config file
* CB-7260 Get cordova-android 3.5.1 instead of 3.5.0
* CB-7228: Fixed issue with "cordova prepare --browserify"
* CB-7234 added better outputs for plugin registry workflows
* CB-7100: Use npm based lazy-load by default
* CB-7091: Remove check_requirements() funcs from platform parsers
* CB-7091: Remove check_requirements() funcs from platform parsers
* CB-7140 Check plugin versions in local search path
* CB-7001: Create a --browserify option for run action
* CB-7228: Cordova prepare --browserify runs on all installed plugins
* CB-7190: Add browserify support in cordova-lib/cordova-cli
* Remove references to "firefoxos"
* Browser platform is now being created from cli
* Created new files for browser

### 0.21.8 (Aug 29, 2014)
* CB-5535: Remove "--arc" from ios platform creation args
* CB-7416 Fixes file path reference when adding new source file
* CB-7416 handleInstall tests for null platformTag. removed uncalled 'hasPlatformSection' from PluginInfo.js
* Remove use of path.join for manifest.launch_path
* CB-7347 Improve cordova platform add /path/to handling
* CB-7118 (fix jshint warnings)
* CB-7114 Android: add support of min/max/target SDK to config.xml
* CB-7118 Use updated version of node-xcode
* CB-7118 iOS: add target-device and MinimumOSVersion support to config.xml
* ubuntu: support incremental builds
* ubuntu: support target-dir for resource-file
* ubuntu: use common.copyFile
* ubuntu: check icon existence
* ffos: Make author url optional
* CB-7142 Add <variable> to <feature> for "plugin restore" command
* Set git clone depth to 10 for Travis to make it faster
* windows: update as per changed manifest file names
* Don't spy and expect it to call the other spy ...
* Well that looks like an error
* Fixing failing tests: update_proj should be update_project
* Fix failing tests. update_jsproj and update_csproj are now just update_proj
* Fix jshint errors in amazon_fireos_parser : mixed single/double quotes
* CB-6699 Include files from www folder via single element (use ** glob pattern)
* Allow plugin modules to be .json files
* Taking care of dashes in amazon-fireos platform name.
* Upleveled amazon-fireos changes.
* Fix link/copy parent check for windows
* Style fixes - comments
* Fix error in comments for munge functions
* Add link to BuildBot at ci.cordova.io in README
* CB-7255 Fixed writing plist unescaped
* Style fixes - white space only
* Add JSCS config file
* CB-7228: Fixed issue with "cordova prepare --browserify"
* CB-7001: Create a --browserify option for run action
* CB-7228: Cordova prepare --browserify runs on all installed plugins
* CB-7190: Add browserify support in cordova-lib/cordova-cli
* CB-7260 Get cordova-android 3.5.1 instead of 3.5.0
* CB-7001: Create a --browserify option for run action
* CB-7228: Cordova prepare --browserify runs on all installed plugins
* CB-7190: Add browserify support in cordova-lib/cordova-cli
* CB-7234 added better outputs for plugin registry workflows
* CB-7100: Use npm based lazy-load by default
* CB-7091: Remove check_requirements() funcs from platform parsers
* CB-7091: Remove check_requirements() funcs from platform parsers
* CB-7140 Check plugin versions in local search path
* small refactor for missing code block after conditional statement
* CB-7203 isRelativePath needs to pass path through
* CB-7199 control git/npm using platform.js
* CB-7199 control git/npm using platform.js
* Fix style errors - make jshint happy
* CB-6756 Adds save and restore command for platforms.
* Add VERSION files to fix failing tests (forgot to git add in b7781cb)
* CB-7132 Fix regression regarding default resources
* CB-7187 Make CoreLocation a required library only for cordova-ios < 3.6.0
* Add AppVeyor badge to README
* Add Travis and npm badges to README.md
* fix(tests): cordova/lazy_load spec on Windows
* Fix plugman/install spec
* build configuration for AppVeyor
* build configurations for Travis
* CB-7124 Wrap the cordova platform string in Platform object
* CB-7140: Switch to using PluginInfo in plugman/fetch.js
* Minor style fixes in fetch.js
* CB-7078: Disable serve.spec.js
* CB-6512: platform add <path> was using wrong www/cordova.js
* CB-7083 Missing SDKReference support on Windows Phone
* CB-6874 Consolidate <Content> tag additions into 1 ItemGroup
* CB-7100: Use npm based lazy-load by default
* CB-7091: Remove check_requirements() funcs from platform parsers
* CB-7091: Don't call check_requirements during platform add
* Fix typo in comment.
* CB-7087 Retire blackberry10/ directory
* CB-6776: Fix uri/url renaming bug
* Remove npm-shrinkwrap.json


### 0.21.4 (Jun 23, 2014)
* CB-3571, CB-2606: support for splashscreens
* CB-6976 Add support for Windows Universal apps (Windows 8.1 and WP 8.1)
* Use Plugininfo module to determine plugin id and version
* Fix plugin check error, when plugin dependency with specific version is given
* CB-6709 Do not create merges/ folder when adding a platform
* CB-6140 Don't allow deletion of platform dependencies
* CB-6698: Fix 'android update lib-project' to work with paths containing spaces
* CB-6973: Run JSHint on all code in src/ via npm test
* CB-6542: Delay creating project until there's some chance that it will succeed
* folder_contents() now ignores .svn folders
* CB-6970 Share win project files manipulation code between cordova and plugman
* CB-6954: Share events.js between cordova and plugman
* CB-6698 Automatically copy sub-libraries to project's directory
* Revert "CB-6698 Resolve android <framework> relative to plugin_dir when custom=true"
* CB-6942 Describe running hooks only in verbose mode.
* CB-6512: Allow "cordova platform add /path/to/platform/files"
* Update hooks-README.md - shebang line in hooks on Windows.
* CB-6895 Add more config properties into manifest
* Allow "cordova platform add platform@version"
* Add util func for chaining promises
* removing doWrap from prepare
* adding configurable attribute
* cleaning up plugman.js for uninstall
* adding param to uninstall
* adding support for prepare flag
* adding prepare-browserify
* adding options to prepare
* adding and freezing cordova-js
* [CB-6879] config parser breakout into a cordova level module
* CB-6698 Resolve android <framework> relative to plugin_dir when custom=true
* Fix tests on node 0.11.x
* Fix android <framework> unit tests to not expect end of line.
* CB-6024: Accept cli vars as part of opts param
* Refer properties-parser package from NPM.
* CB-6859 Removed all wp7 references, tests still passing
* Extract AndroidProject class into a separate .js file
* CB-6698: Support library references for Android via the framework tag
* CB-6854 Strip BOM when adding cordova.define() to js-modules
* Add npm cache based downloading to lazy_load
* Use PluginInfo in plugman/install.js
* Extend PluginInfo to parse more of plugin.xml
* CB-6772 Provide a default for AndroidLaunchMode
* CB-6711: Use parseProjectFile when working with XCode projects.
* Start using PluginInfo object in plugman/install.js
* CB-6709 Remove merges/ folder for default apps
* support for shrinkwrap flag
* Initial implementation for restore and save plugin
* CB-6668: Use <description> for "plugin ls" when <name> is missing.
* Add --noregstry flag for disabling plugin lookup in the registry
* Remove --force from default npm settings for plugin registry
* Use "npm info" for fetching plugin metadata
* Use "npm cache add" for downloading plugins
* CB-6691: Change some instances of Error() to CordovaError()


### 0.21.1
Initial release v0.21.1 (picks up from the same version number as plugman was).
