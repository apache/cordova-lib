
var rewire = require('rewire');
var metadata = rewire('../../../src/plugman/util/metadata');

var fileMocks;
var fsMock = {
    readFileSync: function (path, encoding) {
        if (fileMocks[path]) {
            var buffer = Buffer.from(fileMocks[path]);
            return (encoding) ? buffer.toString(encoding) : buffer;
        } else {
            throw new Error('fs mock: readFileSync: no such file.');
        }
    },
    existsSync: function (path) {
        return Boolean(fileMocks[path]);
    },
    writeFileSync: function (path, data, encoding) {
        fileMocks[path] = data.toString(encoding);
    },
    unlinkSync: function (path) {
        if (fileMocks[path]) {
            delete fileMocks[path];
        } else {
            throw new Error('fs mock: unlinkSync: no such file.');
        }
    }
};
metadata.__set__('fs', fsMock);

function getFileMocksJson () {
    var fileJson = {};
    for (var filename in fileMocks) {
        fileJson[filename] = JSON.parse(fileMocks[filename]);
    }
    return fileJson;
}

describe('plugman.metadata', function () {
    beforeEach(function () {
        fileMocks = {};
        metadata.__set__('cachedJson', null);
    });

    describe('get_fetch_metadata', function () {

        var get_fetch_metadata = metadata.get_fetch_metadata;

        describe('with no record', function () {
            it('should return an empty object if there is no record', function () {
                expect(get_fetch_metadata('/plugins_dir/', 'cordova-plugin-thinger')).toEqual({});
            });
        });

        describe('cache behaviour', function () {

            beforeEach(function () {
                spyOn(fsMock, 'readFileSync').and.callThrough();
                spyOn(fsMock, 'existsSync').and.callThrough();
            });

            it('with no cache, it should read from the filesystem', function () {

                metadata.__set__('cachedJson', null);
                fileMocks['/plugins_dir/fetch.json'] = JSON.stringify({
                    'cordova-plugin-thinger': {
                        'metadata': 'matches'
                    }
                });

                var meta = get_fetch_metadata('/plugins_dir/', 'cordova-plugin-thinger');

                expect(meta).toEqual({metadata: 'matches'});
                expect(fsMock.existsSync).toHaveBeenCalledWith('/plugins_dir/fetch.json');
                expect(fsMock.readFileSync).toHaveBeenCalledWith('/plugins_dir/fetch.json', 'utf-8');
            });

            it('with a cache, it should read from the cache', function () {
                metadata.__set__('cachedJson', {
                    'cordova-plugin-thinger': {
                        metadata: 'cached'
                    }
                });

                fileMocks['/plugins_dir/fetch.json'] = JSON.stringify({
                    'cordova-plugin-thinger': {
                        'metadata': 'matches'
                    }
                });

                var meta = get_fetch_metadata('/plugins_dir/', 'cordova-plugin-thinger');

                expect(meta).toEqual({metadata: 'cached'});
                expect(fsMock.existsSync).not.toHaveBeenCalled();
                expect(fsMock.readFileSync).not.toHaveBeenCalled();
            });

        });

        it('should return the fetch metadata in plugins_dir/fetch.json if it is there', function () {
            fileMocks['/plugins_dir/fetch.json'] = JSON.stringify({
                'cordova-plugin-thinger': {
                    'metadata': 'matches'
                }
            });

            var meta = get_fetch_metadata('/plugins_dir/', 'cordova-plugin-thinger');

            expect(meta).toEqual({metadata: 'matches'});
        });

        it('should migrate legacy fetch metadata if it is there', function () {
            fileMocks['/plugins_dir/cordova-plugin-thinger/.fetch.json'] = JSON.stringify({
                metadata: 'matches'
            });
            fileMocks['/plugins_dir/@cordova/cordova-plugin-thinger/.fetch.json'] = JSON.stringify({
                metadata: 'matches'
            });

            var meta = get_fetch_metadata('/plugins_dir', '@cordova/cordova-plugin-thinger');

            expect(meta).toEqual({metadata: 'matches'});
            expect(getFileMocksJson()).toEqual({
                '/plugins_dir/cordova-plugin-thinger/.fetch.json': {metadata: 'matches'},
                '/plugins_dir/fetch.json': {
                    '@cordova/cordova-plugin-thinger': {
                        metadata: 'matches'
                    }
                }
            });
        });

        it('should return the fetch metadata in plugins_dir/fetch.json if it is there with a scoped plugin', function () {
            fileMocks['/plugins_dir/fetch.json'] = JSON.stringify({
                '@cordova/cordova-plugin-thinger': {
                    'metadata': 'matches'
                }
            });
            spyOn(fsMock, 'readFileSync').and.callThrough();
            spyOn(fsMock, 'existsSync').and.callThrough();

            var meta = get_fetch_metadata('/plugins_dir/', '@cordova/cordova-plugin-thinger');

            expect(meta).toEqual({metadata: 'matches'});
            expect(fsMock.existsSync).toHaveBeenCalledWith('/plugins_dir/fetch.json');
            expect(fsMock.readFileSync).toHaveBeenCalledWith('/plugins_dir/fetch.json', 'utf-8');
        });

    });

    describe('save_fetch_metadata', function () {
        it('should save plugin metadata to a new fetch.json', function () {
            var meta = {metadata: 'saved'};

            metadata.save_fetch_metadata('/plugins_dir', '@cordova/cordova-plugin-thinger', meta);

            expect(getFileMocksJson()).toEqual({
                '/plugins_dir/fetch.json': {
                    '@cordova/cordova-plugin-thinger': {
                        metadata: 'saved'
                    }
                }
            });
        });

        it('should save plugin metadata to an existing fetch.json', function () {
            var meta = {metadata: 'saved'};

            fileMocks = {
                '/plugins_dir/fetch.json': JSON.stringify({
                    'some-other-plugin': {
                        metadata: 'not-touched'
                    }
                })
            };

            metadata.save_fetch_metadata('/plugins_dir', '@cordova/cordova-plugin-thinger', meta);

            expect(getFileMocksJson()).toEqual({
                '/plugins_dir/fetch.json': {
                    '@cordova/cordova-plugin-thinger': {
                        metadata: 'saved'
                    },
                    'some-other-plugin': {
                        metadata: 'not-touched'
                    }
                }
            });
        });
    });

    describe('remove_fetch_metadata', function () {
        it('should remove metadata', function () {
            fileMocks = {
                '/plugins_dir/fetch.json': JSON.stringify({
                    'some-plugin': {
                        metadata: 'existing'
                    }
                })
            };

            metadata.remove_fetch_metadata('/plugins_dir', 'some-plugin');

            expect(getFileMocksJson()).toEqual({
                '/plugins_dir/fetch.json': { }
            });
        });
    });

});
