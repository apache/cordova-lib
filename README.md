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

[![Build status](https://ci.appveyor.com/api/projects/status/hovrl5rwj03co6oa/branch/master?svg=true)](https://ci.appveyor.com/project/ApacheSoftwareFoundation/cordova-lib/branch/master)
[![Build Status](https://travis-ci.org/apache/cordova-lib.svg?branch=master)](https://travis-ci.org/apache/cordova-lib)
[![Code coverage](https://codecov.io/github/apache/cordova-lib/coverage.svg?branch=master)](https://codecov.io/github/apache/cordova-lib?branch=master)
[![NPM](https://nodei.co/npm/cordova.png)](https://nodei.co/npm/cordova/)

# cordova-lib
Contains npm modules used primarily by [cordova](https://github.com/apache/cordova-cli/) and [plugman](https://github.com/apache/cordova-plugman/).

:warning: Report issues on the [Apache Cordova issue tracker](https://issues.apache.org/jira/issues/?jql=project%20%3D%20CB%20AND%20status%20in%20%28Open%2C%20%22In%20Progress%22%2C%20Reopened%29%20AND%20resolution%20%3D%20Unresolved%20AND%20component%20%3D%20%22cordova-lib%22%20ORDER%20BY%20priority%20DESC%2C%20summary%20ASC%2C%20updatedDate%20DESC)

## Setup from a cloned repo
* Clone this repository onto your local machine.
    `git clone https://github.com/apache/cordova-lib.git`
* Install dependencies and npm-link
    `npm install && npm link`

## Setup from npm
* `npm install cordova-lib`

> Note: you will likely also want to get github.com/apache/cordova-common, github.com/apache/cordova-create, github.com/apache/cordova-serve which previously lived in this repo but have since been moved.

## npm commands

This package exposes the following commands;

* `npm run eslint` - runs a linter (eslint) on relevant source and test code
* `npm run unit-tests` - runs the unit tests (via jasmine) from the `spec/` directory
* `npm run cover` - runs istanbul code coverage tool to measure unit test code coverage
* `npm run e2e-tests` - runs heavy integration tests from the `integration-tests/` directory (WARNING: these take a long time to run and rely on file and network I/O)
* `npm test` - shortcut for running the linter, the unit tests and the integration tests
