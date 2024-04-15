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

const path = require('node:path');
const rewire = require('rewire');

const pluginsDir = path.normalize('/plugins_dir/');
const fetchJsonPath = path.join(pluginsDir, 'fetch.json');

let fetchJson = null;
const fsMock = {
    readFileSync: () => fetchJson,
    existsSync: () => fetchJson !== null,
    writeFileSync (_, data) { fetchJson = data; },
    unlinkSync () { fetchJson = null; }
};

// expect fsMock to only operate on fetchJsonPath
Object.entries(fsMock).forEach(([key, fn]) => {
    fsMock[key] = (...args) => {
        expect(args[0]).toBe(fetchJsonPath);
        return fn(...args);
    };
});

describe('plugman.metadata', () => {
    const TEST_PLUGIN = 'cordova-plugin-thinger';
    let metadata;

    beforeEach(() => {
        metadata = rewire('../../../src/plugman/util/metadata');
        metadata.__set__('fs', fsMock);
        fetchJson = JSON.stringify({
            [TEST_PLUGIN]: { metadata: 'matches' }
        });
    });

    describe('get_fetch_metadata', () => {
        const get_fetch_metadata = pluginId =>
            metadata.get_fetch_metadata(pluginsDir, pluginId);

        it('should return an empty object if there is no record', () => {
            fetchJson = null;
            expect(get_fetch_metadata(TEST_PLUGIN)).toEqual({});
        });

        it('should return the fetch metadata in plugins_dir/fetch.json if it is there', () => {
            expect(get_fetch_metadata(TEST_PLUGIN)).toEqual({ metadata: 'matches' });
        });

        it('should return the fetch metadata in plugins_dir/fetch.json for a scoped plugin', () => {
            const meta = { metadata: 'matches' };
            fetchJson = JSON.stringify({ '@cordova/plugin-thinger': meta });

            expect(get_fetch_metadata('@cordova/plugin-thinger')).toEqual(meta);
        });

        describe('cache behaviour', () => {
            beforeEach(() => {
                spyOn(fsMock, 'readFileSync').and.callThrough();
                spyOn(fsMock, 'existsSync').and.callThrough();
            });

            it('with no cache, it should read from the filesystem', () => {
                expect(get_fetch_metadata(TEST_PLUGIN)).toEqual({ metadata: 'matches' });
                expect(fsMock.existsSync).toHaveBeenCalled();
                expect(fsMock.readFileSync).toHaveBeenCalled();
            });

            it('with a cache, it should read from the cache', () => {
                metadata.__set__('cachedJson', {
                    'cordova-plugin-thinger': { metadata: 'cached' }
                });

                expect(get_fetch_metadata(TEST_PLUGIN)).toEqual({ metadata: 'cached' });
                expect(fsMock.existsSync).not.toHaveBeenCalled();
                expect(fsMock.readFileSync).not.toHaveBeenCalled();
            });
        });
    });

    describe('save_fetch_metadata', () => {
        const save_fetch_metadata = (...args) =>
            metadata.save_fetch_metadata(pluginsDir, ...args);

        it('should save plugin metadata to a new fetch.json', () => {
            fetchJson = null;
            const meta = { metadata: 'saved' };

            save_fetch_metadata('@cordova/plugin-thinger', meta);

            expect(JSON.parse(fetchJson)).toEqual({
                '@cordova/plugin-thinger': meta
            });
        });

        it('should save plugin metadata to an existing fetch.json', () => {
            const meta = { metadata: 'saved' };
            const oldFetchJson = {
                'some-other-plugin': { metadata: 'not-touched' }
            };
            fetchJson = JSON.stringify(oldFetchJson);

            save_fetch_metadata('@cordova/plugin-thinger', meta);

            expect(JSON.parse(fetchJson)).toEqual({
                '@cordova/plugin-thinger': meta,
                ...oldFetchJson
            });
        });
    });

    describe('remove_fetch_metadata', () => {
        const remove_fetch_metadata = (...args) =>
            metadata.remove_fetch_metadata(pluginsDir, ...args);

        it('should remove metadata', () => {
            remove_fetch_metadata(TEST_PLUGIN);
            expect(JSON.parse(fetchJson)).toEqual({});
        });
    });
});
