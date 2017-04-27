cordova.define("net.yoik.cordova.plugins.screenorientation.screenorientation.android", function(require, exports, module) {
var exec = require('cordova/exec'),
    screenOrientation = {};

screenOrientation.setOrientation = function(orientation) {
    exec(null, null, "YoikScreenOrientation", "screenOrientation", ['set', orientation]);
};

module.exports = screenOrientation;
});
