var search = require('../src/plugman/search'),
    Q = require('q'),
    registry = require('../src/plugman/registry/registry');

describe('search', function() {
    it('should search a plugin', function() {
        var sSearch = spyOn(registry, 'search').andReturn(Q());
        search(new Array('myplugin', 'keyword'));
        expect(sSearch).toHaveBeenCalledWith(['myplugin', 'keyword']);
    });
});
