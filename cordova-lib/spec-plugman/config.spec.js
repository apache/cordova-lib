var config = require('../src/plugman/config'),
    Q = require('q'),
    registry = require('../src/plugman/registry/registry');

describe('config', function() {
    it('should run config', function() {
        var sConfig = spyOn(registry, 'config').andReturn(Q());
        var params = ['set', 'registry', 'http://registry.cordova.io'];
        config(params);
        expect(sConfig).toHaveBeenCalledWith(params);
    });
});
