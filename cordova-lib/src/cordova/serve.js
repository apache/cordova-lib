/**
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

var cordova_util = require('./util'),
    crypto       = require('crypto'),
    path         = require('path'),
    shell        = require('shelljs'),
    platforms    = require('../platforms/platforms'),
    ConfigParser = require('../configparser/ConfigParser'),
    HooksRunner  = require('../hooks/HooksRunner'),
    Q            = require('q'),
    fs           = require('fs'),
    serve        = require('cordova-serve');

var projectRoot;

function processUrlPath(urlPath, request, response, do302, do404, serveFile) {
    function doRoot() {
        var p;
        response.writeHead(200, {'Content-Type': 'text/html'});
        var config = new ConfigParser(cordova_util.projectConfig(projectRoot));
        response.write('<html><head><title>'+config.name()+'</title></head><body>');
        response.write('<table border cellspacing=0><thead><caption><h3>Package Metadata</h3></caption></thead><tbody>');
        for (var c in {'name': true, 'packageName': true, 'version': true}) {
            response.write('<tr><th>' + c + '</th><td>' + config[c]() + '</td></tr>');
        }
        response.write('</tbody></table>');
        response.write('<h3>Platforms</h3><ul>');
        var installed_platforms = cordova_util.listPlatforms(projectRoot);
        for (p in platforms) {
            if (installed_platforms.indexOf(p) >= 0) {
                response.write('<li><a href="' + p + '/">' + p + '</a></li>\n');
            } else {
                response.write('<li><em>' + p + '</em></li>\n');
            }
        }
        response.write('</ul>');
        response.write('<h3>Plugins</h3><ul>');
        var pluginPath = path.join(projectRoot, 'plugins');
        var plugins = cordova_util.findPlugins(pluginPath);
        for (p in plugins) {
            response.write('<li>'+plugins[p]+'</li>\n');
        }
        response.write('</ul>');
        response.write('</body></html>');
        response.end();
    }

    var firstSegment = /\/(.*?)\//.exec(urlPath);
    var parser;

    if (!firstSegment) {
        doRoot();
        return;
    }
    var platformId = firstSegment[1];
    if (!platforms[platformId]) {
        do404();
        return;
    }
    // Strip the platform out of the path.
    urlPath = urlPath.slice(platformId.length + 1);

    try {
        parser = platforms.getPlatformProject(platformId, path.join(projectRoot, 'platforms', platformId));
    } catch (e) {
        do404();
        return;
    }

    var filePath = null;

    if (urlPath == '/config.xml') {
        filePath = parser.config_xml();
    } else if (urlPath == '/project.json') {
        processAddRequest(request, response, platformId, projectRoot);
        return;
    } else if (/^\/www\//.test(urlPath)) {
        filePath = path.join(parser.www_dir(), urlPath.slice(5));
    } else if (/^\/+[^\/]*$/.test(urlPath)) {
        do302('/' + platformId + '/www/');
        return;
    } else {
        do404();
        return;
    }

    serveFile(filePath);
}

function calculateMd5(fileName) {
    var md5sum,
        BUF_LENGTH = 64*1024,
        buf = new Buffer(BUF_LENGTH),
        bytesRead = BUF_LENGTH,
        pos = 0,
        fdr = fs.openSync(fileName, 'r');

    try {
        md5sum = crypto.createHash('md5');
        while (bytesRead === BUF_LENGTH) {
            bytesRead = fs.readSync(fdr, buf, 0, BUF_LENGTH, pos);
            pos += bytesRead;
            md5sum.update(buf.slice(0, bytesRead));
        }
    } finally {
        fs.closeSync(fdr);
    }
    return md5sum.digest('hex');
}

function processAddRequest(request, response, platformId, projectRoot) {
    var parser = platforms.getPlatformProject(platformId, path.join(projectRoot, 'platforms', platformId));
    var wwwDir = parser.www_dir();
    var payload = {
        'configPath': '/' + platformId + '/config.xml',
        'wwwPath': '/' + platformId + '/www',
        'wwwFileList': shell.find(wwwDir)
            .filter(function(a) { return !fs.statSync(a).isDirectory() && !/(^\.)|(\/\.)/.test(a); })
            .map(function(a) { return {'path': a.slice(wwwDir.length), 'etag': '' + calculateMd5(a)}; })
    };
    console.log('200 ' + request.url);
    response.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    });
    response.write(JSON.stringify(payload));
    response.end();
}

module.exports = function server(port) {
    var d = Q.defer();
    projectRoot = cordova_util.cdProjectRoot();
    port = +port || 8000;

    var hooksRunner = new HooksRunner(projectRoot);
    hooksRunner.fire('before_serve')
    .then(function () {
        // Run a prepare first!
        return require('./cordova').raw.prepare([]);
    }).then(function () {
        var server = serve.launchServer({port: port, urlPathHandler: processUrlPath}).server;
        hooksRunner.fire('after_serve').then(function () {
            d.resolve(server);
        });
    });
    return d.promise;
};

