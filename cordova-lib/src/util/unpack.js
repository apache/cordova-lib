// commands for packing and unpacking tarballs
// this file is used by lib/cache.js

var events = require('../events'),
    fs     = require("fs"),
    path   = require("path"),
    Q      = require('q'),
    tar    = require("tar"),
    zlib   = require("zlib");

exports.unpackTgz = unpackTgz;

// Returns a promise for the path to the unpacked tarball (unzip + untar).
function unpackTgz(package_tgz, unpackTarget) {
    return Q.promise(function(resolve, reject) {
        var extractOpts = { type: "Directory", path: unpackTarget, strip: 1 };

        fs.createReadStream(package_tgz)
        .on("error", function (err) {
            events.emit('verbose', 'Unable to open tarball ' + package_tgz + ': ' + err);
            reject(err);
        })
        .pipe(zlib.createUnzip())
        .on("error", function (err) {
            events.emit('verbose', 'Error during unzip for ' + package_tgz + ': ' + err);
            reject(err);
        })
        .pipe(tar.Extract(extractOpts))
        .on('error', function(err) {
            events.emit('verbose', 'Error during untar for ' + package_tgz + ': ' + err);
            reject(err);
        })
        .on("end", resolve);
    })
    .then(function() {
        return unpackTarget;
    });
}
