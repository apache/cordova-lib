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
var create = require('../../src/plugman/create'),
    Q = require('q'),
    fs = require('fs'),
    shell = require('shelljs'),
    plugman = require('../../src/plugman/plugman');

describe( 'create', function() {
    it( 'Test 001 : should call create', function() {
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

    beforeEach( function() {
        existsSync = spyOn( fs, 'existsSync' ).and.returnValue( false );
        mkdir = spyOn( shell, 'mkdir' ).and.returnValue( true );
        writeFileSync = spyOn( fs, 'writeFileSync' );
        done = false;
    });

    it( 'Test 002 : should be successful', function(done) {
        create('name', 'org.plugin.id', '0.0.0', '.', [])
        .then(function(result) {
            expect( writeFileSync.calls.count() ).toEqual( 2 );
            done();
        }).fail(function err(errMsg) {
            expect(errMsg).toBeUndefined();
            done();
        });
    }, 6000);
});

describe( 'create plugin in existing plugin', function() {
    var done = false,
        existsSync;

    beforeEach( function() {
        existsSync = spyOn( fs, 'existsSync' ).and.returnValue( true );
        done = false;
    });

    it( 'Test 003 : should fail due to an existing plugin.xml', function(done) {
        create()
        .then(function(result) {
            expect(false).toBe(true);
            done();
        }).fail(function err(errMsg) {
            expect(errMsg.toString()).toContain( 'plugin.xml already exists. Are you already in a plugin?'  );
            done();
        });
    }, 6000);
});
