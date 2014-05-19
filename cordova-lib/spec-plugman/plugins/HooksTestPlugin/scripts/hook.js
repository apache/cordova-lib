var Q = require('q');

module.exports = function(context) {
    var deferral = new Q.defer();

    setTimeout(function(){
        deferral.resolve();
    }, 0);

    return deferral.promise;
}