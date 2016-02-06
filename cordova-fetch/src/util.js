var path = require('path');
var shell = require('shelljs');

// Global configuration paths
var global_config_path = process.env['CORDOVA_HOME'];
if (!global_config_path) {
    var HOME = process.env[(process.platform.slice(0, 3) == 'win') ? 'USERPROFILE' : 'HOME'];
    global_config_path = path.join(HOME, '.cordova');
}

var lib_path = path.join(global_config_path, 'lib');
shell.mkdir('-p', lib_path);
shell.mkdir('-p', path.join(lib_path, 'node_modules'));

exports.globalConfig = global_config_path;
exports.libDirectory = lib_path;
