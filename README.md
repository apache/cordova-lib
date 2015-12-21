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

[![Build status](https://ci.appveyor.com/api/projects/status/q9s459ssqvs1t7j6/branch/master)](https://ci.appveyor.com/project/Humbedooh/cordova-lib)
[![Build Status](https://travis-ci.org/apache/cordova-lib.svg?branch=master)](https://travis-ci.org/apache/cordova-lib)
[![NPM](https://nodei.co/npm/cordova.png)](https://nodei.co/npm/cordova/)

[BuildBot waterfall](http://ci.cordova.io/) with [cordova-mobile-spec](https://github.com/apache/cordova-mobile-spec) running on real Android and iOS devices.


# cordova-lib
Contains npm modules used primarily by [cordova](https://github.com/apache/cordova-cli/) and [plugman](https://github.com/apache/cordova-plugman/).

:warning: Report issues on the [Apache Cordova issue tracker](https://issues.apache.org/jira/issues/?jql=project%20%3D%20CB%20AND%20status%20in%20%28Open%2C%20%22In%20Progress%22%2C%20Reopened%29%20AND%20resolution%20%3D%20Unresolved%20AND%20component%20%3D%20%22CordovaLib%22%20ORDER%20BY%20priority%20DESC%2C%20summary%20ASC%2C%20updatedDate%20DESC)


## Setup
* Clone this repository onto your local machine.
    `git clone https://git-wip-us.apache.org/repos/asf/cordova-lib.git`
* In terminal, navigate to the inner cordova-lib directory.
    `cd cordova-lib/cordova-lib`
* Install dependencies and npm-link
    `npm install && npm link`
* Navigate to CLI and Plugman directories and link cordova-lib
    `cd ../../cordova-cli && npm link cordova-lib && npm install`
    `cd ../../cordova-plugman && npm link cordova-lib && npm install`

## NPM commands

This package exposes the following commands;

* `npm run jshint` - runs jshint check against all js files
* `npm run jasmine` - runs jasmine tests from spec-plugman and spec-cordova directories
* `npm run cover` - runs istanbul code coverage tool to measure tests coverage

* `npm test` - shortcut for `npm run jshint && npm run jasmine`
