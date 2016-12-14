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
var create = require('../src/plugman/create'),
    Q = require('q'),
    fs = require('fs'),
    shell = require('shelljs'),
    plugman = require('../src/plugman/plugman');

describe( 'create', function() {
    it( 'should call create', function() {
        var sCreate = spyOn( plugman, 'create' ).and.returnValue(Q());
        plugman.create();
        expect(sCreate).toHaveBeenCalled();
    });
});

describe( 'create plugin', function() {
    var done = false,
        existsSync,
        mkdir,
        writeFileSync;
    function createPromise( f ) {
        f.then( function() { done = true; }, function(err) { done = err; } );
    }
    beforeEach( function() {
        existsSync = spyOn( fs, 'existsSync' ).and.returnValue( false );
        mkdir = spyOn( shell, 'mkdir' ).and.returnValue( true );
        writeFileSync = spyOn( fs, 'writeFileSync' );
        done = false;
    });

    it( 'should be successful', function(done) {
        runs(function() {
            createPromise( create( 'name', 'org.plugin.id', '0.0.0', '.', [] ) );
        });
        waitsFor(function() { return done; }, 'create promise never resolved', 500);
        runs(function() {
            expect( done ).toBe( true );
            expect( writeFileSync.calls.length ).toEqual( 2 );
        });
    });
});

describe( 'create plugin in existing plugin', function() {
    var done = false,
        existsSync;
    function createPromise( f ) {
        f.then( function() { done = true; }, function(err) { done = err; } );
    }
    beforeEach( function() {
        existsSync = spyOn( fs, 'existsSync' ).and.returnValue( true );
        done = false;
    });

    it( 'should fail due to an existing plugin.xml', function(done) {
        create().then(function(result) {
            expect(false).toBe(true);
            done();
        },
        function err(errMsg) {
            expect(errMsg.toString()).toContain( 'plugin.xml already exists. Are you already in a plugin?'  );
            done();
        });
    }, 6000);
});
