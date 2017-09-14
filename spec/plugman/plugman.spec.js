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

var plugman = require('../../src/plugman/plugman');
var Q = require('q');

describe('plugman commands', function () {
    it('should call plugman config', function () {
        spyOn(plugman, 'config');
        plugman.config();
        expect(plugman.config).toHaveBeenCalled();
    });

    it('plugman config should return a promise', function () {
        expect(plugman.config()).toEqual(jasmine.any(Object));
    });

    it('should call plugman owner', function () {
        spyOn(plugman, 'owner');
        plugman.owner();
        expect(plugman.owner).toHaveBeenCalled();
    });

    it('plugman owner should return a promise', function () {
        expect(plugman.owner()).toEqual(jasmine.any(Object));
    });

    it('should call plugman install and use defaults provided', function () {
        spyOn(plugman, 'install').and.returnValue(Q());
        var cli_opts = { project: 'some/path' };
        var opts = {
            fetch: cli_opts.fetch || false,
            save: cli_opts.save || false,
            www_dir: cli_opts.www,
            searchpath: cli_opts.searchpath,
            link: cli_opts.link,
            projectRoot: cli_opts.project,
            force: cli_opts.force || false,
            nohooks: cli_opts.nohooks || false
        };
        plugman.install(opts);
        expect(plugman.install).toHaveBeenCalledWith(opts);
    });

    it('should call plugman install and use cli_opts over defaults', function () {
        spyOn(plugman, 'install').and.returnValue(Q());
        var cli_opts = { project: 'some/path', force: true };
        var opts = {
            force: cli_opts.force || false
        };
        plugman.install(opts);
        expect(plugman.install).toHaveBeenCalledWith(Object({ force: true }));
    });

    it('should call plugman uninstall', function () {
        spyOn(plugman, 'uninstall');
        plugman.uninstall();
        expect(plugman.uninstall).toHaveBeenCalled();
    });

    it('plugman uninstall should return a promise', function () {
        expect(plugman.uninstall('id', 'plugins_dir', 'options')).toEqual(jasmine.any(Object));
    });

    it('should call plugman uninstall and use defaults provided', function () {
        spyOn(plugman, 'uninstall').and.returnValue(Q());
        var cli_opts = { project: 'some/path' };
        var opts = {
            www_dir: cli_opts.www,
            save: cli_opts.save || false,
            fetch: cli_opts.fetch || false,
            projectRoot: cli_opts.project
        };
        plugman.uninstall(opts);
        expect(plugman.uninstall).toHaveBeenCalledWith(opts);
    });

    it('should call plugman uninstall and use cli_opts over defaults', function () {
        spyOn(plugman, 'uninstall').and.returnValue(Q());
        var cli_opts = { project: 'some/path', fetch: true };
        var opts = {
            fetch: cli_opts.fetch || false
        };
        plugman.uninstall(opts);
        expect(plugman.uninstall).toHaveBeenCalledWith(Object({ fetch: true }));
    });

    it('should call plugman search', function () {
        spyOn(plugman, 'search').and.returnValue(Q());
        plugman.search();
        expect(plugman.search).toHaveBeenCalled();
    });

    it('should call plugman info', function () {
        spyOn(plugman, 'info').and.returnValue(Q());
        plugman.info();
        expect(plugman.info).toHaveBeenCalled();
    });

    it('should call plugman create', function () {
        spyOn(plugman, 'create').and.returnValue(Q());
        plugman.create();
        expect(plugman.create).toHaveBeenCalled();
    });

    it('should call plugman platform', function () {
        spyOn(plugman, 'platform').and.returnValue(Q());
        plugman.platform();
        expect(plugman.platform).toHaveBeenCalled();
    });

    it('should call plugman createpackagejson', function () {
        spyOn(plugman, 'createpackagejson').and.returnValue(Q());
        plugman.createpackagejson();
        expect(plugman.createpackagejson).toHaveBeenCalled();
    });
});
