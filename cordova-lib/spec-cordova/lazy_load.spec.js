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

/* jshint sub:true */

var lazy_load = require('../src/cordova/lazy_load'),
    npmHelper = require('../src/util/npm-helper'),
    config = require('../src/cordova/config'),
    shell = require('shelljs'),
    npm = require('npm'),
    path = require('path'),
    HooksRunner = require('../src/hooks/HooksRunner'),
    request = require('request'),
    fs = require('fs'),
    Q = require('q'),
    platforms = require('../src/platforms/platforms');

describe('lazy_load module', function() {
    var custom_path, cachePackage, fakeLazyLoad;
    beforeEach(function() {
        custom_path = spyOn(config, 'has_custom_path').and.returnValue(false);
        cachePackage = spyOn(npmHelper, 'cachePackage').and.returnValue(Q(path.join('lib', 'dir')));
        fakeLazyLoad = function (id, platform, version) {
            if (platform == 'wp7' || platform == 'wp8') {
                return Q(path.join('lib', 'wp', id, version, platform));
            } else {
                return Q(path.join('lib', platform, id, version, platforms[platform] && platforms[platform].subdirectory ? platforms[platform].subdirectory : ''));
            }
        };
    });
    describe('cordova method (loads stock cordova libs)', function() {
        var custom,
            version;
        beforeEach(function() {
            custom = spyOn(lazy_load, 'custom').and.returnValue(Q(path.join('lib','dir')));
            version = platforms.android.version;
            platforms.android.version = '3.14.15.9265';
        });
        afterEach(function () {
            platforms.android.version = version;
        });
        it('should throw if platform is not a stock cordova platform', function(done) {
            lazy_load.cordova('atari').then(function() {
                expect('this call').toEqual('to fail');
            }, function(err) {
                expect('' + err).toContain('Cordova library "atari" not recognized.');
            }).fin(done);
        });
        it('should invoke lazy_load.custom with appropriate url, platform, and version as specified in platforms manifest', function(done) {
            lazy_load.cordova('android').then(function(dir) {
                expect(cachePackage).toHaveBeenCalled();
                expect(dir).toBeDefined();
                done();
            });
        });
    });

    describe('custom method (loads custom cordova libs)', function() {
        var exists, fire, rm, mv, readdir;
        beforeEach(function() {
            spyOn(shell, 'mkdir');
            rm = spyOn(shell, 'rm');
            mv = spyOn(shell, 'mv');
            exists = spyOn(fs, 'existsSync').and.returnValue(false);
            readdir = spyOn(fs, 'readdirSync').and.returnValue(['somefile.txt']);
            fire = spyOn(HooksRunner, 'fire').and.returnValue(Q());
        });

        it('should callback with no errors and not fire event hooks if library already exists', function(done) {
            exists.and.returnValue(true);
            var mock_platforms = {
                'platform X': {
                    id: 'some id',
                    url: 'http://some remote url',
                    version: 'three point five'
                }
            };
            lazy_load.custom(mock_platforms, 'platform X').then(function() {
                expect(fire).not.toHaveBeenCalled();
            }, function(err) {
                expect(err).not.toBeDefined();
            }).fin(done);
        });
        it('should callback with no errors and fire event hooks even if library already exists if the lib url is a local dir', function(done) {
            exists.and.returnValue(true);
            var mock_platforms = {
                'platform X': {
                    id: 'some id',
                    url: 'some local dir',
                    version: 'three point six'
                }
            };
            lazy_load.custom(mock_platforms, 'platform X').then(function() {
                expect(fire).not.toHaveBeenCalled();
            }, function(err) {
                expect(err).not.toBeDefined();
            }).fin(done);
        });

        describe('remote URLs for libraries', function() {
            var req,
                events = {},
                fakeRequest = {
                    on: jasmine.createSpy().and.callFake(function(event, cb) {
                        events[event] = cb;
                        return fakeRequest;
                    }),
                    pipe: jasmine.createSpy().and.callFake(function() { return fakeRequest; })
                };
            beforeEach(function() {
                events = {};
                fakeRequest.on.reset();
                fakeRequest.pipe.reset();
                req = spyOn(request, 'get').and.callFake(function() {
                    // Fire the 'end' event shortly.
                    setTimeout(function() {
                        events['end']();
                    }, 10);
                    return fakeRequest;
                });
                spyOn(npm, 'load').and.callFake(function(cb) { cb(); });
                spyOn(npm.config, 'get').and.returnValue(null);
            });

            it('should call request with appropriate url params', function(done) {
                var url = 'https://github.com/apache/someplugin';
                var with_android_platform = {
                    'android': {
                        id: 'random',
                        url: url,
                        version: '1.0'
                    }
                };
                lazy_load.custom(with_android_platform, 'android').then(function() {
                    expect(req).toHaveBeenCalledWith({
                        url:url
                    }, jasmine.any(Function));
                }, function(err) {
                    expect(err).not.toBeDefined();
                }).fin(done);
            });
            it('should take into account https-proxy npm configuration var if exists for https:// calls', function(done) {
                var proxy = 'https://somelocalproxy.com';
                npm.config.get.and.returnValue(proxy);
                var url = 'https://github.com/apache/someplugin';
                var with_android_platform = {
                    'android': {
                        id: 'random',
                        url: url,
                        version: '1.0'
                    }
                };
                lazy_load.custom(with_android_platform, 'android').then(function() {
                    expect(req).toHaveBeenCalledWith({
                        url:url,
                        proxy:proxy
                    }, jasmine.any(Function));
                }, function(err) {
                    expect(err).not.toBeDefined();
                }).fin(done);
            });
            it('should take into account proxy npm config var if exists for http:// calls', function(done) {
                var proxy = 'http://somelocalproxy.com';
                npm.config.get.and.returnValue(proxy);
                var url = 'http://github.com/apache/someplugin';
                var with_android_platform = {
                    'android': {
                        id: 'random',
                        url: url,
                        version: '1.0'
                    }
                };
                lazy_load.custom(with_android_platform, 'android').then(function() {
                    expect(req).toHaveBeenCalledWith({
                        url:url,
                        proxy:proxy
                    }, jasmine.any(Function));
                }, function(err) {
                    expect(err).not.toBeDefined();
                }).fin(done);
            });
        });

        describe('local paths for libraries', function() {
            it('should return the local path, no symlink', function(done) {
                var mock_platforms = {
                    'X': {
                        id: 'id',
                        url: '/some/random/lib',
                        version: 'three point eight'
                    }
                };
                lazy_load.custom(mock_platforms, 'X').then(function(dir) {
                    expect(path.normpath(dir)).toEqual('/some/random/lib');
                }, function(err) {
                    expect(err).toBeUndefined();
                }).fin(done);
            });
            it('should not file download hook', function(done) {
                var mock_platforms = {
                    'X': {
                        id: 'id',
                        url: '/some/random/lib',
                        version: 'three point nine'
                    }
                };
                lazy_load.custom(mock_platforms, 'X').then(function() {
                    expect(fire).not.toHaveBeenCalledWith('after_library_download', {platform:'X',url:'/some/random/lib',id:'id',version:'three point nine',path:'/some/random/lib', symlink:false});
                }, function(err) {
                    expect(err).toBeUndefined();
                }).fin(done);
            });
        });
    });

    describe('based_on_config method', function() {
        var cordova, custom, read;
        beforeEach(function() {
            cordova = spyOn(lazy_load, 'cordova').and.returnValue(Q());
            custom = spyOn(lazy_load, 'custom').and.returnValue(Q());
        });
        it('should invoke custom if a custom lib is specified', function(done) {
            read = spyOn(config, 'read').and.returnValue({
                lib:{
                    maybe:{
                        url:'you or eye?',
                        id:'eye dee',
                        version:'four point twenty'
                    }
                }
            });
            var p = '/some/random/custom/path';
            custom_path.and.returnValue(p);
            custom.and.callFake(function (platforms, platform) {
                expect(platform).toEqual('maybe');
                expect(platforms[platform].url).toEqual('you or eye?');
                expect(platforms[platform].id).toEqual('eye dee');
                expect(platforms[platform].version).toEqual('four point twenty');
                return fakeLazyLoad(platforms[platform].id, platform, platforms[platform].version);
            });
            lazy_load.based_on_config('yup', 'maybe').then(function() {
                expect(custom).toHaveBeenCalled();
            }, function(err) {
                expect(err).toBeUndefined();
            }).fin(done);
        });
        it('should invoke cordova if no custom lib is specified', function(done) {
            lazy_load.based_on_config('yup', 'ios').then(function() {
                expect(cordova).toHaveBeenCalled();
            }, function(err) {
                expect(err).toBeUndefined();
            }).fin(done);
        });
    });
});
