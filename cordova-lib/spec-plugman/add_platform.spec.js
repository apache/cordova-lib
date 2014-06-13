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
    fs = require('fs'),
    shell = require('shelljs'),
    plugman = require('../src/plugman/plugman');

describe( 'platform add/remove', function() {
    it( 'should call platform add', function() {
        var sPlatformA = spyOn( platform, 'add' ).andReturn(Q()),
            sPlatformR = spyOn( platform, 'remove' ).andReturn(Q());
        platform.add();
        expect(sPlatformA).toHaveBeenCalled();
        platform.remove();
        expect(sPlatformR).toHaveBeenCalled();
    });
});


describe( 'platform add', function() {
    var done = false,
        existsSync,
        mkdir,
        writeFileSync;
    function platformPromise( f ) {
        f.then( function() { done = true; }, function(err) { done = err; } );
    }
    beforeEach( function() {
        existsSync = spyOn( fs, 'existsSync' ).andReturn( false );
        done = false;
    });
    it( 'should error on non existing plugin.xml', function() {
        runs(function() {
            platformPromise( platform.add() );
        });
        waitsFor(function() { return done; }, 'platform promise never resolved', 500);
        runs(function() {
            expect(''+ done ).toContain( "can't find a plugin.xml.  Are you in the plugin?"  );
        });
    });
});


describe( 'platform remove', function() {
    var done = false,
        existsSync,
        mkdir,
        writeFileSync;
    function platformPromise( f ) {
        f.then( function() { done = true; }, function(err) { done = err; } );
    }
    beforeEach( function() {
        existsSync = spyOn( fs, 'existsSync' ).andReturn( false );
        done = false;
    });
    it( 'should error on non existing plugin.xml', function() {
        runs(function() {
            platformPromise( platform.remove() );
        });
        waitsFor(function() { return done; }, 'platform promise never resolved', 500);
        runs(function() {
            expect(''+ done ).toContain( "can't find a plugin.xml.  Are you in the plugin?"  );
        });
    });
});
