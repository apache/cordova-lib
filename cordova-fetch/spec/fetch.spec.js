var Q = require('q');
var fetch = require('../index.js');

describe('', function() {

    it('should return a promise', function() {
        expect(Q.isPromise(fetch('cordova-plugin-device'))).toBe(true);
    });
})
