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
var config = require('../src/plugman/config'),
    Q = require('q'),
    registry = require('../src/plugman/registry/registry');

describe('config', function() {
    it('Test 001 : should run config', function() {
        var sConfig = spyOn(registry, 'config').and.returnValue(Q());
        var params = ['set', 'registry', 'http://registry.cordova.io'];
        config(params);
        expect(sConfig).toHaveBeenCalledWith(params);
    });
});
