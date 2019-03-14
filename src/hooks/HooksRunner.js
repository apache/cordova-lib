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

const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const readChunk = require('read-chunk');
const shebangCommand = require('shebang-command');

const cordovaUtil = require('../cordova/util');
const scriptsFinder = require('./scriptsFinder');
const Context = require('./Context');
const { CordovaError, events, superspawn } = require('cordova-common');

const isWindows = os.platform().slice(0, 3) === 'win';

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

    var scripts = scriptsFinder.getHookScripts(hook, opts);

    // execute hook event listeners first
    return executeEventHandlersSerially(hook, opts).then(function () {
        // then execute hook script files
        var context = new Context(hook, opts);
        return runScriptsSerially(scripts, context);
    });
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
    return executeEventHandlersSerially(hook, opts);
}

// Returns a promise.
function executeEventHandlersSerially (hook, opts) {
    var handlers = events.listeners(hook);
    if (handlers.length) {
        // Chain the handlers in series.
        return handlers.reduce(function (soFar, f) {
            return soFar.then(function () { return f(opts); });
        }, Promise.resolve());
    } else {
        return Promise.resolve(); // Nothing to do.
    }
}

/**
 * Serially fires scripts either via Promise.resolve(require(pathToScript)(context)) or via child_process.spawn.
 * Returns promise.
 */
function runScriptsSerially (scripts, context) {
    if (scripts.length === 0) {
        events.emit('verbose', 'No scripts found for hook "' + context.hook + '".');
    }
    return scripts.reduce(function (prevScriptPromise, nextScript) {
        return prevScriptPromise.then(function () {
            return runScript(nextScript, context);
        });
    }, Promise.resolve());
}

/**
 * Async runs single script file.
 */
function runScript (script, context) {
    if (typeof script.useModuleLoader === 'undefined') {
        // if it is not explicitly defined whether we should use modeule loader or not
        // we assume we should use module loader for .js files
        script.useModuleLoader = path.extname(script.path).toLowerCase() === '.js';
    }

    var source;
    var relativePath;

    if (script.plugin) {
        source = 'plugin ' + script.plugin.id;
        relativePath = path.join('plugins', script.plugin.id, script.path);
    } else if (script.useModuleLoader) {
        source = 'config.xml';
        relativePath = path.normalize(script.path);
    } else {
        source = 'hooks directory';
        relativePath = path.join('hooks', context.hook, script.path);
    }

    events.emit('verbose', 'Executing script found in ' + source + ' for hook "' + context.hook + '": ' + relativePath);

    if (script.useModuleLoader) {
        return runScriptViaModuleLoader(script, context);
    } else {
        return runScriptViaChildProcessSpawn(script, context);
    }
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

    if (fs.statSync(script.fullPath).isDirectory()) {
        events.emit('verbose', 'Skipped directory "' + script.fullPath + '" within hook directory');
        return Promise.resolve();
    }

    if (isWindows) {
        // TODO: Make shebang sniffing a setting (not everyone will want this).
        var interpreter = extractSheBangInterpreter(script.fullPath);
        // we have shebang, so try to run this script using correct interpreter
        if (interpreter) {
            args.unshift(command);
            command = interpreter;
        }
    }

    var execOpts = { cwd: opts.projectRoot, printCommand: true, stdio: 'inherit' };
    execOpts.env = {};
    execOpts.env.CORDOVA_VERSION = require('../../package').version;
    execOpts.env.CORDOVA_PLATFORMS = opts.platforms ? opts.platforms.join() : '';
    execOpts.env.CORDOVA_PLUGINS = opts.plugins ? opts.plugins.join() : '';
    execOpts.env.CORDOVA_HOOK = script.fullPath;
    execOpts.env.CORDOVA_CMDLINE = process.argv.join(' ');

    return superspawn.spawn(command, args, execOpts)
        .catch(function (err) {
            // Don't treat non-executable files as errors. They could be READMEs, or Windows-only scripts.
            if (!isWindows && err.code === 'EACCES') {
                events.emit('verbose', 'Skipped non-executable file: ' + script.fullPath);
            } else {
                throw new Error('Hook failed with error code ' + err.code + ': ' + script.fullPath);
            }
        });
}

/**
 * Extracts shebang interpreter from script' source. */
function extractSheBangInterpreter (fullpath) {
    // this is a modern cluster size. no need to read less
    const chunkSize = 4096;
    const fileData = readChunk.sync(fullpath, 0, chunkSize);
    const fileChunk = fileData.toString();
    const hookCmd = shebangCommand(fileChunk);

    if (hookCmd && fileData.length === chunkSize && !fileChunk.match(/[\r\n]/)) {
        events.emit('warn', 'shebang is too long for "' + fullpath + '"');
    }
    return hookCmd;
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
    var disabledHooks = opts.nohooks;
    var length = disabledHooks.length;
    for (var i = 0; i < length; i++) {
        if (hook.match(disabledHooks[i]) !== null) {
            return true;
        }
    }
    return false;
}
