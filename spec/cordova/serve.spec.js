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

const path = require('path');
const fs = require('fs-extra');
const rewire = require('rewire');
const cordovaServe = require('cordova-serve');
const { tmpDir: getTmpDir, omniStub } = require('../helpers');
const cordova = require('../../src/cordova/cordova');
const cordovaUtil = require('../../src/cordova/util');
const platforms = require('../../src/platforms/platforms');

describe('cordova/serve', () => {
    let serve;

    beforeEach(() => {
        serve = rewire('../../src/cordova/serve');
    });

    describe('main export', () => {
        const PROJECT_ROOT = '/root';

        class HooksRunnerMock {
            constructor (dir) { expect(dir).toBe(PROJECT_ROOT); }
            fire (hook, fireOpts) { return Promise.resolve(); }
        }

        beforeEach(() => {
            spyOn(cordovaUtil, 'cdProjectRoot').and.returnValue(PROJECT_ROOT);
            serve.__set__({
                HooksRunner: HooksRunnerMock,
                serve: jasmine.createSpy('serve', _ => Promise.resolve())
            });
        });

        it('should call hooks and `serve` in proper order', () => {
            const PORT = 1234567;
            const OPTS = {};

            // Records order of some spy calls since jasmine has no support for
            // checking interleaved calls.
            const calls = [];
            const pushAndResolve = tag => {
                calls.push(tag);
                return Promise.resolve(tag);
            };
            serve.__get__('serve').and.callFake(port => {
                expect(port).toBe(PORT);
                return pushAndResolve('serve');
            });
            spyOn(HooksRunnerMock.prototype, 'fire').and.callFake((hook, opts) => {
                expect(opts).toBe(OPTS);
                return pushAndResolve(hook);
            });

            return serve(PORT, OPTS).then(result => {
                expect(result).toBe('serve');
                expect(calls).toEqual([
                    'before_serve', 'serve', 'after_serve'
                ]);
            });
        });

        it('should fail if run outside of a Cordova project', () => {
            const fakeMessage = 'CAN I HAZ CORDOVA PLZ?';
            cordovaUtil.cdProjectRoot.and.throwError(fakeMessage);

            return serve(1234567, {}).then(() => {
                fail('Expected promise to be rejected');
            }, function (err) {
                expect(err).toEqual(jasmine.any(Error));
                expect(err.message).toBe(fakeMessage);
                expect(cordovaUtil.cdProjectRoot).toHaveBeenCalled();
            });
        });

        it('should fail if serve fails', () => {
            const fakeError = new Error();
            serve.__get__('serve').and.returnValue(Promise.reject(fakeError));

            return serve(1234567, {}).then(
                _ => fail('Expected promise to be rejected'),
                err => expect(err).toBe(fakeError)
            );
        }, 100);
    });

    describe('serve', () => {
        let privateServe, serverSpy;

        beforeEach(() => {
            serverSpy = jasmine.createSpyObj('server', ['launchServer']);
            serverSpy.app = Symbol('server.app');
            serverSpy.server = Symbol('server.server');

            spyOn(cordova, 'prepare').and.returnValue(Promise.resolve());

            serve.__set__({
                cordovaServe: jasmine.createSpy('cordova-serve').and.returnValue(serverSpy),
                registerRoutes: jasmine.createSpy('registerRoutes')
            });
            privateServe = serve.__get__('serve');
        });

        it('should launch a server after preparing the project', () => {
            const PORT = 1234567;
            const registerRoutes = serve.__get__('registerRoutes');

            return privateServe(PORT).then(result => {
                expect(result).toBe(serverSpy.server);
                expect(registerRoutes).toHaveBeenCalledWith(serverSpy.app);
                expect(serverSpy.launchServer).toHaveBeenCalledWith(
                    jasmine.objectContaining({ port: PORT })
                );
                expect(cordova.prepare).toHaveBeenCalledBefore(serverSpy.launchServer);
            });
        });

        it('should work without arguments', () => {
            return privateServe().then(result => {
                expect(serverSpy.launchServer).toHaveBeenCalledWith(
                    jasmine.objectContaining({ port: 8000 })
                );
            });
        });

        it('should fail if prepare fails', () => {
            const fakeError = new Error();
            cordova.prepare.and.returnValue(Promise.reject(fakeError));

            return privateServe(1234567, {}).then(
                _ => fail('Expected promise to be rejected'),
                err => expect(err).toBe(fakeError)
            );
        }, 100);
    });

    describe('registerRoutes', () => {
        let registerRoutes, app;

        beforeEach(() => {
            spyOn(cordovaUtil, 'listPlatforms').and.returnValue([ 'foo' ]);
            serve.__set__({
                handleRoot: jasmine.createSpy('handleRoot'),
                absolutePathHandler: jasmine.createSpy('absolutePathHandler'),
                platformRouter: jasmine.createSpy('platformRouter')
                    .and.returnValue(_ => _)
            });
            registerRoutes = serve.__get__('registerRoutes');
            app = new cordovaServe.Router();
        });

        it('should register a route for absolute paths', () => {
            const absolutePathHandler = serve.__get__('absolutePathHandler');

            registerRoutes(app);
            app({ method: 'GET', url: '/config.xml' }, null);
            expect(absolutePathHandler).toHaveBeenCalled();
        });

        it('should register a fallback root route', () => {
            const absolutePathHandler = serve.__get__('absolutePathHandler');
            absolutePathHandler.and.callFake((req, res, next) => next());
            const handleRoot = serve.__get__('handleRoot');

            registerRoutes(app);
            app({ method: 'GET', url: '/' }, null);
            expect(handleRoot).toHaveBeenCalled();
        });

        it('should register platform routes', () => {
            cordovaUtil.listPlatforms.and.returnValue([ 'foo', 'bar' ]);
            const platformRouter = serve.__get__('platformRouter');
            platformRouter
                .withArgs('foo').and.returnValue(jasmine.createSpy('fooHandler'))
                .withArgs('bar').and.returnValue(jasmine.createSpy('barHandler'));

            registerRoutes(app);
            app({ method: 'GET', url: '/foo/index.html' }, null);
            expect(platformRouter('foo')).toHaveBeenCalled();
            expect(platformRouter('bar')).not.toHaveBeenCalled();

            platformRouter('foo').calls.reset();
            app({ method: 'GET', url: '/bar/index.html' }, null);
            expect(platformRouter('bar')).toHaveBeenCalled();
            expect(platformRouter('foo')).not.toHaveBeenCalled();
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

            response = jasmine.createSpyObj('response', ['send']);
        });

        it('should return an index of available platforms and plugins', () => {
            handleRoot(null, response);
            expect(response.send).toHaveBeenCalledTimes(1);

            const [ document ] = response.send.calls.argsFor(0);
            expect(document).toContain('cordova-plugin-beer');
            expect(document).toContain('foo');
            expect(document).toContain('bar');

            // Contains links to installed platforms only
            expect(document).toContain('"foo/www/index.html"');
            expect(document).not.toContain('"bar/www/index.html"');
        });
    });

    describe('absolutePathHandler', () => {
        let absolutePathHandler, next;

        beforeEach(() => {
            absolutePathHandler = serve.__get__('absolutePathHandler');
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

    describe('platformRouter', () => {
        const PLATFORM = 'atari';
        let platformRouter;

        beforeEach(() => {
            platformRouter = serve.__get__('platformRouter');
            spyOn(platforms, 'getPlatformApi').and.returnValue({
                getPlatformInfo: _ => ({
                    locations: { configXml: 'CONFIG', www: 'WWW_DIR' }
                })
            });
        });

        it('should serve static from www', () => {
            const staticSpy = jasmine.createSpy('static');
            spyOn(cordovaServe, 'static').and.returnValue(staticSpy);

            const router = platformRouter(PLATFORM);
            expect(cordovaServe.static).toHaveBeenCalledWith('WWW_DIR');

            router({ method: 'GET', url: '/www/foo' }, null);
            expect(staticSpy).toHaveBeenCalled();
        });

        it('should serve the platform config.xml', () => {
            const router = platformRouter(PLATFORM);
            const sendFile = jasmine.createSpy('sendFile');

            router({ method: 'GET', url: '/config.xml' }, { sendFile });
            expect(sendFile).toHaveBeenCalledWith('CONFIG');
        });

        it('should serve generated information under /project.json', () => {
            serve.__set__({ generateWwwFileList: x => x });
            const router = platformRouter(PLATFORM);
            const send = jasmine.createSpy('send');

            router({ method: 'GET', url: '/project.json' }, { send });
            expect(send).toHaveBeenCalledWith({
                configPath: `/${PLATFORM}/config.xml`,
                wwwPath: `/${PLATFORM}/www`,
                wwwFileList: 'WWW_DIR'
            });
        });
    });

    describe('generateWwwFileList', () => {
        const emptyStringMd5 = 'd41d8cd98f00b204e9800998ecf8427e';
        let generateWwwFileList, tmpDir;

        beforeEach(() => {
            generateWwwFileList = serve.__get__('generateWwwFileList');
            tmpDir = getTmpDir('serve-test');
        });

        afterEach(() => {
            return fs.remove(tmpDir);
        });

        it('should generate a list of files with MD5 sums', () => {
            for (const f of ['a', 'b/c']) {
                fs.ensureFileSync(path.join(tmpDir, f));
            }
            expect(generateWwwFileList(tmpDir)).toEqual([
                { path: 'a', etag: emptyStringMd5 },
                { path: 'b/c', etag: emptyStringMd5 }
            ]);
        });

        it('should not include hidden files or directories', () => {
            for (const f of ['a', '.b/c', '.d']) {
                fs.ensureFileSync(path.join(tmpDir, f));
            }
            expect(generateWwwFileList(tmpDir)).toEqual([
                { path: 'a', etag: emptyStringMd5 }
            ]);
        });
    });
});
