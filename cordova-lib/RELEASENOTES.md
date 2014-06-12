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

### 0.21.5 (June 14, 2014)

* CB-6931: Fix licence headers in cordova-lib
* Add util func for chaining promises
* Minor style fixes

### 0.21.4 (June 9. 2014) (Unreleased)

* removed root package.json file
* [CB-6879] config parser breakout into a cordova level module
* CB-6698 Resolve android <framework> relative to plugin dir when custom=true
* Fix tests on node 0.11.x
* Use properties-parser dep from npm registry, not github
* CB-6859 Removed all wp7 references, tests still passing
* Remove trailing spaces in all js files
* Extract AndroidProject class into a separate .js file
* CB-6698: Support library references for Android via the framework tag
* CB-6854 Strip BOM when adding cordova.define() to js-modules
* Add npm cache based downloading to lazyload
* CB-6823 Improve test for is source path ancestor when using copy-from or link-to
* CB-6815 Add license to CONTRIBUTING.md
* Use PluginInfo in plugman/install.js
* Extend PluginInfo to parse more of plugin.xml
* CB-6767 Allow `cordova` to be replaceable
* CB-6772 Provide a default for AndroidLaunchMode
* CB-5421 fix windows8 test
* CB-6711: Use parseProjectFile when working with XCode projects.
* Start using PluginInfo object in plugman/install.js
* Fix create.spec - don't expect merges dir
* CB-6709 Remove merges/ folder for default apps
* support for shrinkwrap flag
* Initial implementation for restore and save plugin
* Remove unused code from plugman/install.js
* CB-6668: Use <description> for "plugin ls" when <name> is missing.
* Add --noregstry flag for disabling plugin lookup in the registry
* Remove --force from default npm settings for plugin registry
* Use "npm info" for fetching plugin metadata
* Use "npm cache add" for downloading plugins
* CB-6691: Change some instances of Error() to CordovaError()
* Minor style fixes

### Initial release v0.21.1 (picks up from the same version number as plugman was).
