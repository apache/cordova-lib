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
var util  = require('../cordova/util'),
    events = require('../events'),
    Q = require('q'),
    plugin  = require('../cordova/plugin'),
    ScriptsFinder = require('./ScriptsFinder'),
    ScriptsRunner = require('./ScriptsRunner'),
    Context = require('./Context'),
    CordovaError = require('../CordovaError');

/**
 * Tries to create a hooker for passed project root.
 * @constructor
 */
function Hooker(projectRoot) {
    if (!util.isCordova(projectRoot)) {
        throw new CordovaError('Not a Cordova project ("' + projectRoot + '"), can\'t use hooks.');
    }
}

/**
 * Fires all event handlers and scripts for a passed hook type.
 * Returns a promise.
 */
Hooker.prototype.fire = function fire(hook, opts) {
    // args check
    if (!hook) {
        throw new CordovaError('hook type is not specified');
    }
    // execute hook event listeners first
    return setPluginsProperty(opts).then(function(){
        setCordovaVersionProperty(opts);

        var handlers = events.listeners(hook);
        return executeHandlersSerially(handlers, opts);
    // then execute hook script files
    }).then(function() {
        var scripts = ScriptsFinder.getHookScripts(hook, opts);
        var context = new Context(hook, opts);
        return ScriptsRunner.runScriptsSerially(scripts, context);
    });
};

/**
 * Sets hook options cordova.plugins list if it was not set.
 * Returns a promise.
 */
function setPluginsProperty(opts) {
    if(!opts.cordova.plugins) {
        return plugin().then(function(plugins) {
            opts.cordova.plugins = plugins;
            return Q();
        });
    }
    return Q();
}

/**
 * Sets hook options cordova.version if it was not set.
 */
function setCordovaVersionProperty(opts) {
    opts.cordova.version = opts.cordova.version || require('../../package').version;
}

// Returns a promise.
function executeHandlersSerially(handlers, opts) {
    if (handlers.length) {
        // Chain the handlers in series.
        return handlers.reduce(function(soFar, f) {
            return soFar.then(function() { return f(opts); });
        }, Q());
    } else {
        return Q(); // Nothing to do.
    }
}

module.exports = Hooker;