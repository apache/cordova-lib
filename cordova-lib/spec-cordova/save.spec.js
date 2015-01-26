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

var path = require('path'),
    Q = require('q'),
    cordova = require('../src/cordova/cordova'),
    cordova_util = require('../src/cordova/util'),
    ConfigParser = require('../src/configparser/ConfigParser'),
    project_dir = path.join(__dirname, 'fixtures', 'base');

describe('save command', function(){
  var is_cordova, result;

   function wrapper(f, post) {
        runs(function() {
            Q().then(f).then(function() { result = true; }, function(err) { result = err; });
        });
        waitsFor(function() { return result; }, 'promise never resolved', 500);
        runs(post);
    }

  beforeEach(function(){
    is_cordova = spyOn(cordova_util, 'isCordova').andReturn(project_dir);

  });

  it('should not run outside of a Cordova-based project by calling util.isCordova', function() {
     is_cordova.andReturn(false);
     wrapper(cordova.raw.save, function() {
        expect('' + result).toMatch('Current working directory is not a Cordova-based project.');
     });
  });

  it('should not try to add features to config.xml', function(){
    var parserWriter = spyOn(ConfigParser.prototype, 'write');
    expect(ConfigParser.prototype.write).not.toHaveBeenCalled();
    cordova.save('plugins');
    expect(ConfigParser.prototype.write).not.toHaveBeenCalled();
    parserWriter.andCallThrough();
  });

  it('should not try to add platforms to config.xml', function(){
    var call_count =0;
    ConfigParser.prototype.write = function(){
      call_count++;
    };
    expect(call_count).toEqual(0);
    cordova.save('platforms');
    expect(call_count).toEqual(0);
  });
});
