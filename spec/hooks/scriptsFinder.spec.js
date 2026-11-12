/*!
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

describe('hooks/scriptsFinder', () => {
    let scriptsFinder;

    beforeEach(() => {
        scriptsFinder = rewire('../../src/hooks/scriptsFinder');
    });

    describe('plugin ordering', () => {
        const pluginInfos = ids => ids.map(id => ({ id, dir: `/project/plugins/${id}` }));

        /** The plugins directory is globbed without sorting, so this is the order to expect nothing of. */
        const asFoundOnDisk = pluginInfos(['plugin-c', 'plugin-a', 'plugin-b']);

        function withPackageJson (pkgJson) {
            scriptsFinder.__set__({
                fs: { existsSync: () => pkgJson !== undefined },
                cordovaUtil: { requireNoCache: () => pkgJson }
            });
        }

        it('orders plugins by their position in package.json, not by the order found on disk', () => {
            withPackageJson({ cordova: { plugins: { 'plugin-a': {}, 'plugin-b': {}, 'plugin-c': {} } } });
            const sort = scriptsFinder.__get__('sortPluginsByPackageJson');

            expect(sort(asFoundOnDisk, '/project').map(p => p.id)).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
        });

        it('follows package.json even when that is not alphabetical', () => {
            withPackageJson({ cordova: { plugins: { 'plugin-b': {}, 'plugin-c': {}, 'plugin-a': {} } } });
            const sort = scriptsFinder.__get__('sortPluginsByPackageJson');

            expect(sort(asFoundOnDisk, '/project').map(p => p.id)).toEqual(['plugin-b', 'plugin-c', 'plugin-a']);
        });

        it('leaves the order alone when there is no package.json', () => {
            withPackageJson(undefined);
            const sort = scriptsFinder.__get__('sortPluginsByPackageJson');

            expect(sort(asFoundOnDisk, '/project').map(p => p.id)).toEqual(['plugin-c', 'plugin-a', 'plugin-b']);
        });

        it('leaves the order alone when package.json declares no plugins', () => {
            withPackageJson({ cordova: {} });
            const sort = scriptsFinder.__get__('sortPluginsByPackageJson');

            expect(sort(asFoundOnDisk, '/project').map(p => p.id)).toEqual(['plugin-c', 'plugin-a', 'plugin-b']);
        });

        it('keeps a plugin missing from package.json in front, as installation does', () => {
            withPackageJson({ cordova: { plugins: { 'plugin-a': {}, 'plugin-b': {} } } });
            const sort = scriptsFinder.__get__('sortPluginsByPackageJson');

            expect(sort(asFoundOnDisk, '/project').map(p => p.id)).toEqual(['plugin-c', 'plugin-a', 'plugin-b']);
        });

        it('does not mutate the array it was given', () => {
            withPackageJson({ cordova: { plugins: { 'plugin-a': {}, 'plugin-b': {}, 'plugin-c': {} } } });
            const sort = scriptsFinder.__get__('sortPluginsByPackageJson');
            const given = asFoundOnDisk.slice();

            sort(given, '/project');

            expect(given.map(p => p.id)).toEqual(['plugin-c', 'plugin-a', 'plugin-b']);
        });

        it('collects hook scripts in that order', () => {
            withPackageJson({ cordova: { plugins: { 'plugin-a': {}, 'plugin-b': {}, 'plugin-c': {} } } });
            scriptsFinder.__set__({
                PluginInfoProvider: class {
                    getAllWithinSearchPath () { return asFoundOnDisk; }
                },
                getPluginScriptFiles: pluginOptions => [{ plugin: pluginOptions.id }]
            });
            const getAll = scriptsFinder.__get__('getAllPluginsHookScriptFiles');

            const scripts = getAll('before_prepare', { projectRoot: '/project', cordova: { platforms: ['android'] } });

            expect(scripts.map(s => s.plugin)).toEqual(['plugin-a', 'plugin-b', 'plugin-c']);
        });
    });
});
