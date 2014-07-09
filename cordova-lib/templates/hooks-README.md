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
# Cordova Hooks

This directory may contain scripts used to customize cordova commands. This
directory used to exist at `.cordova/hooks`, but has now been moved to the
project root. Any scripts you add to these directories will be executed before
and after the commands corresponding to the directory name. Useful for
integrating your own build systems or integrating with version control systems.
Hook scripts can also be defined in `config.xml` and `plugins/.../plugin.xml` 
and will be run serially in the following order: 
* Application hooks from `.cordova/hooks`;
* Application hooks from `/hooks`;
* Application hooks from `config.xml`;
* Plugin hooks from `plugins/.../plugin.xml`.

__Remember__: Make your scripts executable.

## Ways to define hooks
### Hook Directories
The following subdirectories of `.cordova/hooks` and `/hooks` will be used for hooks:

    after_build/
    after_compile/
    after_docs/
    after_emulate/
    after_platform_add/
    after_platform_rm/
    after_platform_ls/
    after_plugin_add/
    after_plugin_ls/
    after_plugin_rm/
    after_plugin_search/
    after_plugin_install/   <-- Plugin hooks defined in plugin.xml are executed exclusively for a plugin being installed
    after_prepare/
    after_run/
    after_serve/
    before_build/
    before_compile/
    before_docs/
    before_emulate/
    before_platform_add/
    before_platform_rm/
    before_platform_ls/
    before_plugin_add/
    before_plugin_ls/
    before_plugin_rm/
    before_plugin_search/
    before_plugin_install/   <-- Plugin hooks defined in plugin.xml are executed exclusively for a plugin being installed
    before_plugin_uninstall/   <-- Plugin hooks defined in plugin.xml are executed exclusively for a plugin being uninstalled
    before_prepare/
    before_run/
    before_serve/
    pre_package/ <-- Windows 8 and Windows Phone only.

### Config.xml

Hooks can be defined in project's `config.xml` in the following way:

    <script type="before_build" src="scripts/appBeforeBuild.bat" />
    <script type="before_build" src="scripts/appBeforeBuild.js" />
    <script type="before_plugin_install" src="scripts/appBeforePluginInstall.js" />

    <platform name="wp8">
        <script type="before_build" src="scripts/wp8/appWP8BeforeBuild.bat" />
        <script type="before_build" src="scripts/wp8/appWP8BeforeBuild.js" />
        <script type="before_plugin_install" src="scripts/wp8/appWP8BeforePluginInstall.js" />
        ...
    </platform>

    <platform name="windows8">
        <script type="before_build" src="scripts/windows8/appWin8BeforeBuild.bat" />
        <script type="before_build" src="scripts/windows8/appWin8BeforeBuild.js" />
        <script type="before_plugin_install" src="scripts/windows8/appWin8BeforePluginInstall.js" />
        ...
    </platform>

### Plugin hooks (plugin.xml)

As a plugin developer you can define hook scripts using `<script>` elements in a `plugin.xml` like that:

    <script type="before_plugin_install" src="scripts/beforeInstall.js" />
    <script type="after_build" src="scripts/afterBuild.js" />

    <platform name="wp8">
        <script type="before_plugin_install" src="scripts/wp8BeforeInstall.js" />
        <script type="before_build" src="scripts/wp8BeforeBuild.js" />
        ...
    </platform>

`before_plugin_install`, `after_plugin_install`, `before_plugin_uninstall` plugin hooks will be fired exclusively for the plugin being installed/uninstalled.

## Script Interface

### Javascript

If you are writing hooks in Javascript you should use the following module definition:
```javascript
module.exports = function(context) {
    ...
}
```

You can make your scipts async using Q, which can be retrieved from `context.commonModules`:
```javascript
module.exports = function(context) {
    var Q = context.commonModules.Q;
	var deferral = new Q.defer();

    setTimeout(function(){
    	console.log('hook.js>> end');
		deferral.resolve();
    }, 1000);

    return deferral.promise;
}
```

`context` object contains hook type, executed script full path, hook options, common modules, and command-line arguments passed to Cordova:
```json
{
	"hook": "before_plugin_install",
	"scriptLocation": "c:\\script\\full\\path\\appBeforePluginInstall.js",
	"cmdLine": "The\\exact\\command\\cordova\\run\\with arguments",
	"opts": {
		"projectRoot":"C:\\path\\to\\the\\project",
		"cordova": {
			"platforms": ["wp8"],
			"plugins": ["com.plugin.withhooks"],
			"version": "0.21.7-dev"
		},
		"plugin": {
			"id": "com.plugin.withhooks",
			"pluginInfo": {
				...
			},
			"platform": "wp8",
			"dir": "C:\\path\\to\\the\\project\\plugins\\com.plugin.withhooks"
		}
	},
	"commonModules": { 
		"fs": { ... },
		"path": { ... },
		"os": { ... },
		"events": { ... },
		"util": { ... },
		"cordovaUtil": { ... }
	}
}

```
`context.opts.plugin` object will only be passed to plugin hooks scripts.

You can also require additional Cordova modules in your script using `context.requireCordovaModule` in the following way:
```javascript
var et = context.requireCordovaModule('elementtree');
var xmlHelpers = context.requireCordovaModule('../util/xml-helpers');
```

New module loader script interface is used for the `.js` files defined via `config.xml` or `plugin.xml` only. 
For compatibility reasons hook files specified via `.cordova/hooks` and `/hooks` folders are run via Node child_process spawn, see 'Non-javascript' section below.

### Non-javascript

Non-javascript scripts are run via Node child_process spawn from the project's root directory and have the root directory passes as the first argument. All other options are passed to the script using environment variables:

* CORDOVA_VERSION - The version of the Cordova-CLI.
* CORDOVA_PLATFORMS - Comma separated list of platforms that the command applies to (e.g.: android, ios).
* CORDOVA_PLUGINS - Comma separated list of plugin IDs that the command applies to (e.g.: org.apache.cordova.file, org.apache.cordova.file-transfer)
* CORDOVA_HOOK - Path to the hook that is being executed.
* CORDOVA_CMDLINE - The exact command-line arguments passed to cordova (e.g.: cordova run ios --emulate)

If a script returns a non-zero exit code, then the parent cordova command will be aborted.

## Writing hooks

We highly recommend writting your hooks using Node.js so that they are
cross-platform. Some good examples are shown here:

[http://devgirl.org/2013/11/12/three-hooks-your-cordovaphonegap-project-needs/](http://devgirl.org/2013/11/12/three-hooks-your-cordovaphonegap-project-needs/)

Also, note that even if you are working on Windows, and in case your hook scripts aren't bat files (which is recommended, if you want your scripts to work in non-Windows operating systems) Cordova CLI will expect a shebang line as the first line for it to know the interpreter it needs to use to launch the script. The shebang line should match the following example:

    #!/usr/bin/env [name_of_interpreter_executable]

