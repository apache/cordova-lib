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

const { events } = require('cordova-common');
const { SpecReporter } = require('jasmine-spec-reporter');

// Node.js throws an Error if the `error` event is emitted on a EventEmitter
// instance that has no handlers attached for it. This often masks the actual
// error that was causing the issue. So we attach a listener here.
events.on('error', console.error);

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

jasmine.getEnv().clearReporters();
jasmine.getEnv().addReporter(new SpecReporter({
    spec: {
        displayPending: true,
        displayDuration: true
    },
    summary: {
        displayDuration: true,
        displayStacktrace: true
    }
}));
