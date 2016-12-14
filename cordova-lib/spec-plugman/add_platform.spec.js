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
var platform = require('../src/plugman/platform'),
    Q = require('q'),
    fs = require('fs');

describe( 'platform add/remove', function() {
    it( 'should call platform add', function() {
        var sPlatformA = spyOn( platform, 'add' ).and.returnValue(Q()),
            sPlatformR = spyOn( platform, 'remove' ).and.returnValue(Q());
        platform.add();
        expect(sPlatformA).toHaveBeenCalled();
        platform.remove();
        expect(sPlatformR).toHaveBeenCalled();
    });
});


describe( 'platform add', function() {
    var done = false,
        existsSync;
    function platformPromise( f ) {
        f.then( function() { done = true; }, function(err) { done = err; } );
    }
    beforeEach( function() {
        existsSync = spyOn( fs, 'existsSync' ).and.returnValue( false );
        done = false;
    });
    it( 'should error on non existing plugin.xml', function(done) {
        platform.add().then(function(result){
            expect(false).toBe(true);
            done();
        },
        function err(errMsg) {
            expect(errMsg.toString()).toContain('can\'t find a plugin.xml.  Are you in the plugin?');
            done();
        });
    }, 6000);
});


describe( 'platform remove', function() {
    var done = false,
        existsSync;
    function platformPromise( f ) {
        f.then( function() { done = true; }, function(err) { done = err; } );
    }
    beforeEach( function() {
        existsSync = spyOn( fs, 'existsSync' ).and.returnValue( false );
        done = false;
    });
    it( 'should error on non existing plugin.xml', function(done) {
        platform.remove().then(function(result) {
            expect(false).toBe(true);
            done();
        },
        function err(errMsg) {
            expect(errMsg.toString()).toContain( 'can\'t find a plugin.xml.  Are you in the plugin?'  );
            done();
        });
    }, 6000);
});