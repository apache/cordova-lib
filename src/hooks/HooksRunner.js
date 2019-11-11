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

const execa = require('execa');
const fs = require('fs-extra');
const path = require('path');

const cordovaUtil = require('../cordova/util');
const scriptsFinder = require('./scriptsFinder');
const Context = require('./Context');
const { CordovaError, events } = require('cordova-common');

/**
 * Tries to create a HooksRunner for passed project root.
 * @constructor
 */
function HooksRunner (projectRoot) {
    var root = cordovaUtil.isCordova(projectRoot);
    if (!root) throw new CordovaError('Not a Cordova project ("' + projectRoot + '"), can\'t use hooks.');
    else this.projectRoot = root;
}

/**
 * Fires all event handlers and scripts for a passed hook type.
 * Returns a promise.
 */
HooksRunner.prototype.fire = function fire (hook, opts) {
    if (isHookDisabled(opts, hook)) {
        return Promise.resolve('hook ' + hook + ' is disabled.');
    }

    // args check
    if (!hook) {
        throw new Error('hook type is not specified');
    }
    opts = this.prepareOptions(opts);

    // first run hook event listeners, then run hook script files
    return runJobsSerially([
        ...getEventHandlerJobs(hook, opts),
        ...getHookJobs(hook, opts)
    ]);
};

/**
 * Refines passed options so that all required parameters are set.
 */
HooksRunner.prototype.prepareOptions = function (opts) {
    opts = opts || {};
    opts.projectRoot = this.projectRoot;
    opts.cordova = opts.cordova || {};
    opts.cordova.platforms = opts.cordova.platforms || opts.platforms || cordovaUtil.listPlatforms(opts.projectRoot);
    opts.cordova.platforms = opts.cordova.platforms.map(function (platform) { return platform.split('@')[0]; });
    opts.cordova.plugins = opts.cordova.plugins || opts.plugins || cordovaUtil.findPlugins(path.join(opts.projectRoot, 'plugins'));

    try {
        opts.cordova.version = opts.cordova.version || require('../../package').version;
    } catch (ex) {
        events.emit('warn', 'HooksRunner could not load package.json: ' + ex.message);
    }

    return opts;
};

module.exports = HooksRunner;

/**
 * Executes hook event handlers serially. Doesn't require a HooksRunner to be constructed.
 * Returns a promise.
 */
module.exports.fire = globalFire;
function globalFire (hook, opts) {
    if (isHookDisabled(opts, hook)) {
        return Promise.resolve('hook ' + hook + ' is disabled.');
    }

    opts = opts || {};
    return runJobsSerially(getEventHandlerJobs(hook, opts));
}

function getEventHandlerJobs (hook, opts) {
    return events.listeners(hook)
        .map(handler => () => handler(opts));
}

function getHookJobs (hook, opts) {
    const scripts = scriptsFinder.getHookScripts(hook, opts);

    if (scripts.length === 0) {
        events.emit('verbose', `No scripts found for hook "${hook}".`);
    }

    const context = new Context(hook, opts);
    return scripts.map(script => () => runScript(script, context));
}

function runJobsSerially (jobs) {
    return jobs.reduce((acc, job) => acc.then(job), Promise.resolve());
}

/**
 * Async runs single script file.
 */
function runScript (script, context) {
    var source;
    var relativePath;

    if (script.plugin) {
        source = 'plugin ' + script.plugin.id;
        relativePath = path.join('plugins', script.plugin.id, script.path);
    } else {
        source = 'config.xml';
        relativePath = path.normalize(script.path);
    }

    events.emit('verbose', 'Executing script found in ' + source + ' for hook "' + context.hook + '": ' + relativePath);

    const runScriptStrategy = path.extname(script.path).toLowerCase() === '.js'
        ? runScriptViaModuleLoader
        : runScriptViaChildProcessSpawn;

    return runScriptStrategy(script, context);
}

/**
 * Runs script using require.
 * Returns a promise. */
function runScriptViaModuleLoader (script, context) {
    if (!fs.existsSync(script.fullPath)) {
        events.emit('warn', 'Script file does\'t exist and will be skipped: ' + script.fullPath);
        return Promise.resolve();
    }
    var scriptFn = require(script.fullPath);
    context.scriptLocation = script.fullPath;
    if (script.plugin) {
        context.opts.plugin = script.plugin;
    }

    // We can't run script if it is a plain Node script - it will run its commands when we require it.
    // This is not a desired case as we want to pass context, but added for compatibility.
    if (scriptFn instanceof Function) {
        // If hook is async it can return promise instance and we will handle it.
        return Promise.resolve(scriptFn(context));
    } else {
        return Promise.resolve();
    }
}

/**
 * Runs script using child_process spawn method.
 * Returns a promise. */
function runScriptViaChildProcessSpawn (script, context) {
    var opts = context.opts;
    var command = script.fullPath;
    var args = [opts.projectRoot];

    const execOpts = {
        cwd: opts.projectRoot,
        stdio: 'inherit',
        env: {
            CORDOVA_VERSION: require('../../package').version,
            CORDOVA_PLATFORMS: opts.platforms ? opts.platforms.join() : '',
            CORDOVA_PLUGINS: opts.plugins ? opts.plugins.join() : '',
            CORDOVA_HOOK: script.fullPath,
            CORDOVA_CMDLINE: process.argv.join(' ')
        }
    };

    events.emit('log', `Running hook: ${command} ${args.join(' ')}`);

    return execa(command, args, execOpts)
        .then(data => data.stdout);
}

/**
 * Checks if the given hook type is disabled at the command line option.
 * @param {Object} opts - the option object that contains command line options
 * @param {String} hook - the hook type
 * @returns {Boolean} return true if the passed hook is disabled.
 */
function isHookDisabled (opts, hook) {
    if (opts === undefined || opts.nohooks === undefined) {
        return false;
    }
    return opts.nohooks.some(pattern => hook.match(pattern) !== null);
}
