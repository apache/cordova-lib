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

const rewire = require('rewire');
const cordovaServe = require('cordova-serve');
const { omniStub } = require('../helpers');
const cordova = require('../../src/cordova/cordova');
const cordovaUtil = require('../../src/cordova/util');
const platforms = require('../../src/platforms/platforms');

describe('cordova/serve', () => {
    let serve;

    beforeEach(() => {
        serve = rewire('../../src/cordova/serve');
    });

    describe('serve command', () => {
        let port, opts, calls, testPlatforms, serverSpy, HooksRunnerMock;

        beforeEach(() => {
            port = 42;
            opts = Object.freeze({});
            testPlatforms = Object.freeze(['foo', 'bar']);

            // Records order of some spy calls since jasmine has no support for
            // checking interleaved calls.
            calls = [];

            const PROJECT_ROOT = '/root';
            const pushAndResolve = tag => {
                calls.push(tag);
                return Promise.resolve(tag);
            };

            HooksRunnerMock = class {
                constructor (dir) {
                    expect(dir).toBe(PROJECT_ROOT);
                }
                fire (hook, fireOpts) {
                    expect(fireOpts).toBe(opts);
                    return pushAndResolve(hook);
                }
            };

            serverSpy = cordovaServe();
            serverSpy.server = Symbol('server.server');
            spyOn(serverSpy, 'launchServer').and.callFake(launchOpts => {
                expect(launchOpts).toEqual(jasmine.objectContaining({ port }));
                return pushAndResolve('launchServer');
            });

            const serveSpy = jasmine.createSpy('cordova-serve').and.returnValue(serverSpy);
            serveSpy.static = jasmine.createSpy('static').and.returnValue(_ => _);

            spyOn(cordova, 'prepare').and.callFake(_ => pushAndResolve('prepare'));
            spyOn(cordovaUtil, 'cdProjectRoot').and.returnValue(PROJECT_ROOT);
            spyOn(cordovaUtil, 'listPlatforms').and.returnValue(testPlatforms);
            spyOn(platforms, 'getPlatformApi').and.returnValue(omniStub());

            serve.__set__({ serve: serveSpy, HooksRunner: HooksRunnerMock });
        });

        function checkBasicOperation (result) {
            expect(result).toBe(serverSpy.server);

            // Check order of some calls
            expect(calls).toEqual([
                'before_serve', 'prepare', 'launchServer', 'after_serve'
            ]);
        }

        it('should not run outside of a Cordova-based project', () => {
            const fakeMessage = 'CAN I HAZ CORDOVA PLZ?';
            cordovaUtil.cdProjectRoot.and.throwError(fakeMessage);

            return serve(port, opts).then(() => {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err).toEqual(jasmine.any(Error));
                expect(err.message).toBe(fakeMessage);
                expect(cordovaUtil.cdProjectRoot).toHaveBeenCalled();
            });
        });

        it('should serve with no platforms installed', () => {
            cordovaUtil.listPlatforms.and.returnValue([]);
            return serve(port, opts).then(checkBasicOperation);
        });

        it('should work without arguments', () => {
            port = 8000;
            opts = undefined;

            return serve().then(checkBasicOperation);
        });

        it('should serve all installed platforms', () => {
            spyOn(serverSpy.app, 'use');

            return serve(port, opts).then(_ => {
                testPlatforms.forEach(platform => {
                    expect(serverSpy.app.use).toHaveBeenCalledWith(
                        jasmine.stringMatching(`^/${platform}`),
                        jasmine.any(Function)
                    );
                });
            });
        });
    });

    describe('handleRoot', () => {
        let handleRoot, response;

        beforeEach(() => {
            handleRoot = serve.__get__('handleRoot');
            serve.__set__({
                platforms: { foo: 0, bar: 0 },
                installedPlatforms: ['foo'],
                projectRoot: '',
                ConfigParser: function () {
                    return omniStub({ src: undefined });
                }
            });

            spyOn(cordovaUtil, 'projectConfig');
            spyOn(cordovaUtil, 'findPlugins').and.returnValue([
                'cordova-plugin-beer'
            ]);

            response = jasmine.createSpyObj('response', [
                'sendStatus', 'writeHead', 'write', 'end'
            ]);
        });

        it('should return a status of 404 for anything but /', () => {
            handleRoot({ url: '/foo' }, response);
            expect(response.sendStatus).toHaveBeenCalledWith(404);
        });

        it('should return an index of available platforms and plugins on /', () => {
            handleRoot({ url: '/' }, response);
            expect(response.writeHead).toHaveBeenCalledWith(200, {
                'Content-Type': 'text/html'
            });
            expect(response.write).toHaveBeenCalled();
            expect(response.end).toHaveBeenCalled();
        });
    });

    describe('absolutePathHandler', () => {
        let absolutePathHandler, next;

        beforeEach(() => {
            absolutePathHandler = serve.__get__('getAbsolutePathHandler')();
            serve.__set__({ installedPlatforms: ['foo'] });

            next = jasmine.createSpy('next');
        });

        it('should do nothing if `referer` is not set', () => {
            const request = { headers: {} };

            absolutePathHandler(request, null, next);
            expect(next).toHaveBeenCalled();
        });

        it('should do nothing if `referer` is not a platform URL', () => {
            const request = { headers: { referer: '/www/index.html' } };

            absolutePathHandler(request, null, next);
            expect(next).toHaveBeenCalled();
        });

        it('should do nothing if requested URL is a platform URL', () => {
            const request = {
                headers: { referer: '/foo/www/index.html' },
                originalUrl: '/foo/www/style.css'
            };

            absolutePathHandler(request, null, next);
            expect(next).toHaveBeenCalled();
        });

        it('should redirect all other requests relative to /platform/www', () => {
            const request = {
                headers: { referer: '/foo/index.html' },
                originalUrl: '/style.css'
            };
            const response = jasmine.createSpyObj('response', ['redirect']);

            absolutePathHandler(request, response, next);
            expect(next).not.toHaveBeenCalled();
            expect(response.redirect).toHaveBeenCalledWith('/foo/www/style.css');
        });
    });
});
