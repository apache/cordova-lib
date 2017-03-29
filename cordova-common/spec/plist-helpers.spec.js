var plistHelpers = require('../src/util/plist-helpers');


describe('prunePLIST', function() {
    var doc =  {
        FirstConfigKey: {
            FirstPreferenceName: '*',
            SecondPreferenceName: 'a + b',
            ThirdPreferenceName: 'x-msauth-$(CFBundleIdentifier:rfc1034identifier)'
        },

        SecondConfigKey: {
            FirstPreferenceName: 'abc'
        }
    };

    var xml = '<dict>' +
                '<key>FirstPreferenceName</key>' +
                '<string>*</string>'  +
                '<key>SecondPreferenceName</key>' +
                '<string>a + b</string>'  +
                '<key>ThirdPreferenceName</key>' +
                '<string>x-msauth-$(CFBundleIdentifier:rfc1034identifier)</string>'  +
              '</dict>';

    var selector = 'FirstConfigKey';

    it('Test 01: should remove property from plist file using provided selector', function(done) {
        var pruneStatus = plistHelpers.prunePLIST(doc, xml, selector);

        expect(pruneStatus).toBeTruthy();
        expect(doc).toEqual(
            {
                SecondConfigKey: {
                    FirstPreferenceName: 'abc'
                }
            }
        );

        done();
    });
});