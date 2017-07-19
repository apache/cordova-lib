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

//     nopt = require('nopt');

// var known_opts = {
//     'verbose' : Boolean,
//     'debug' : Number
// }, shortHands = { 'd' : ['--debug'] };

// var opt = nopt(known_opts, shortHands);
// var mapNames = {
//     'verbose' : 7,
//     'info'    : 6,
//     'notice'  : 5,
//     'warn'    : 4,
//     'error'   : 3
// }

// if(opt.verbose)
//     opt.debug = 7;

// if(opt.debug) {
//     for(var i in mapNames) {
//         if(mapNames[i] <= opt.debug)
//             plugman.on(i, console.log);
//     }

//     if(opt.debug >= 6)
//         plugman.on('log', console.log);
// }
var common = {};

module.exports = common = {
    spy: {
        getInstall: function (emitSpy) {
            return common.spy.startsWith(emitSpy, 'Install start');
        },

        getDeleted: function (emitSpy) {
            return common.spy.startsWith(emitSpy, 'Deleted');
        },

        startsWith: function (emitSpy, string) {
            var match = [];
            emitSpy.calls.all().forEach(function (val, i) {
                if (emitSpy.calls.argsFor(i)[1].substr(0, string.length) === string) { match.push(emitSpy.calls.argsFor(i)[1]); }
            });
            return match;
        },

        contains: function (emitSpy, string) {
            var match = [];
            emitSpy.calls.all().forEach(function (val, i) {
                if (emitSpy.calls.argsFor(i)[1].indexOf(string) >= 0) { match.push(emitSpy.calls.argsFor(i)[1]); }
            });
            return match;
        }
    }
};
