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

var Q = require('q'),
    fs = require('fs'),
    os = require('os'),
    path = require('path'),
    superspawn = require('../cordova/superspawn'),
    Context = require('./Context');

var isWindows = os.platform().slice(0, 3) === 'win';

module.exports = {
    /**
     * Serially fires scripts either via Q(require(pathToScript)(context)) or via child_process.spawn.
     * Returns promise.
     */
    runScriptsSerially: function(scripts, context) {
        var deferral = new Q.defer();

        function executePendingScript() {
            try {
                if (scripts.length === 0) {
                    deferral.resolve();
                    return;
                }
                var nextScript = scripts[0];
                scripts.shift();

                runScript(nextScript, context).then(executePendingScript, function(err){
                    deferral.reject(err);
                });
            } catch (ex) {
                deferral.reject(ex);
            }
        }
        executePendingScript();
        return deferral.promise;
    }
};

/**
 * Async runs single script file.
 */
function runScript(script, context) {
    if (typeof script.useModuleLoader == 'undefined') {
        // if it is not explicitly defined whether we should use modeule loader or not
        // we assume we should use module loader for .js files
        script.useModuleLoader = path.extname(script.path).toLowerCase() == '.js';
    }
    if(script.useModuleLoader) {
        return runScriptViaModuleLoader(script, context);
    } else {
        return runScriptViaChildProcessSpawn(script, context);
    }
}

/**
 * Runs script using require.
 * Returns a promise. */
function runScriptViaModuleLoader(script, context) {
    if(!fs.existsSync(script.fullPath)) {
        events.emit('warn', "Script file does't exist and will be skipped: " + script.fullPath);
        return Q();
    }
    var scriptFn = require(script.fullPath);
    context.scriptLocation = script.fullPath;
    context.opts.plugin = script.plugin;

    // We can't run script if it is a plain Node script - it will run its commands when we require it.
    // This is not a desired case as we want to pass context, but added for compatibility.
    if (scriptFn instanceof Function) {
        // If hook is async it can return promise instance and we will handle it.
        return Q(scriptFn(context));
    } else {
        return Q();
    }
}

/**
 * Runs script using child_process spawn method.
 * Returns a promise. */
function runScriptViaChildProcessSpawn(script, context) {
    var opts = context.opts;
    var command = script.fullPath;
    var args = [opts.projectRoot];
    if (isWindows) {
        // TODO: Make shebang sniffing a setting (not everyone will want this).
        var interpreter = extractSheBangInterpreter(script.fullPath);
        // we have shebang, so try to run this script using correct interpreter
        if (interpreter) {
            args.unshift(command);
            command = interpreter;
        }
    }

    var execOpts = {cwd: opts.projectRoot, printCommand: true, stdio: 'inherit'};
    execOpts.env = {};
    execOpts.env.CORDOVA_VERSION = require('../../package').version;
    execOpts.env.CORDOVA_PLATFORMS = opts.cordova.platforms ? opts.cordova.platforms.join() : '';
    execOpts.env.CORDOVA_PLUGINS = opts.cordova.plugins ? opts.cordova.plugins.join() : '';
    execOpts.env.CORDOVA_HOOK = script.fullPath;
    execOpts.env.CORDOVA_CMDLINE = process.argv.join(' ');

    return superspawn.spawn(command, args, execOpts)
        .catch(function(err) {
            // Don't treat non-executable files as errors. They could be READMEs, or Windows-only scripts.
            if (!isWindows && err.code == 'EACCES') {
                events.emit('verbose', 'skipped non-executable file: ' + script.fullPath);
            } else {
                throw new Error('Hook failed with error code ' + err.code + ': ' + script.fullPath);
            }
        });
}

/**
 * Extracts shebang interpreter from script' source. */
function extractSheBangInterpreter(fullpath) {
    var fileChunk;
    var octetsRead;
    var fileData;
    var hookFd = fs.openSync(fullpath, "r");
    try {
        // this is a modern cluster size. no need to read less
        fileData = new Buffer(4096);
        octetsRead = fs.readSync(hookFd, fileData, 0, 4096, 0);
        fileChunk = fileData.toString();
    } finally {
        fs.closeSync(hookFd);
    }

    var hookCmd, shMatch;
    // Filter out /usr/bin/env so that "/usr/bin/env node" works like "node".
    var shebangMatch = fileChunk.match(/^#!(?:\/usr\/bin\/env )?([^\r\n]+)/m);
    if (octetsRead == 4096 && !fileChunk.match(/[\r\n]/))
        events.emit('warn', 'shebang is too long for "' + fullpath + '"');
    if (shebangMatch)
        hookCmd = shebangMatch[1];
    // Likewise, make /usr/bin/bash work like "bash".
    if (hookCmd)
        shMatch = hookCmd.match(/bin\/((?:ba)?sh)$/);
    if (shMatch)
        hookCmd = shMatch[1];
    return hookCmd;
}