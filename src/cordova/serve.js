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

var cordova_util = require('./util');
var path = require('path');
var globby = require('globby');
var url = require('url');
var platforms = require('../platforms/platforms');
var ConfigParser = require('cordova-common').ConfigParser;
var HooksRunner = require('../hooks/HooksRunner');
var Q = require('q');
var events = require('cordova-common').events;
var serve = require('cordova-serve');
var md5File = require('md5-file');

var projectRoot;
var installedPlatforms;

function handleRoot (request, response, next) {
    if (url.parse(request.url).pathname !== '/') {
        response.sendStatus(404);
        return;
    }

    response.writeHead(200, {'Content-Type': 'text/html'});
    var config = new ConfigParser(cordova_util.projectConfig(projectRoot));
    var contentNode = config.doc.find('content');
    var contentSrc = (contentNode && contentNode.attrib.src) || ('index.html');

    response.write('<html><head><title>' + config.name() + '</title></head><body>');
    response.write('<table border cellspacing=0><thead><caption><h3>Package Metadata</h3></caption></thead><tbody>');
    ['name', 'packageName', 'version'].forEach(function (c) {
        response.write('<tr><th>' + c + '</th><td>' + config[c]() + '</td></tr>');
    });
    response.write('</tbody></table>');
    response.write('<h3>Platforms</h3><ul>');
    Object.keys(platforms).forEach(function (platform) {
        if (installedPlatforms.indexOf(platform) >= 0) {
            response.write('<li><a href="' + platform + '/www/' + contentSrc + '">' + platform + '</a></li>\n');
        } else {
            response.write('<li><em>' + platform + '</em></li>\n');
        }
    });
    response.write('</ul>');
    response.write('<h3>Plugins</h3><ul>');
    var pluginPath = path.join(projectRoot, 'plugins');
    var plugins = cordova_util.findPlugins(pluginPath);
    Object.keys(plugins).forEach(function (plugin) {
        response.write('<li>' + plugins[plugin] + '</li>\n');
    });
    response.write('</ul>');
    response.write('</body></html>');
    response.end();
}

// https://issues.apache.org/jira/browse/CB-11274
// Use referer url to redirect absolute urls to the requested platform resources
// so that an URL is resolved against that platform www directory.
function getAbsolutePathHandler () {
    return function (request, response, next) {
        if (!request.headers.referer) {
            next();
            return;
        }

        var pathname = url.parse(request.headers.referer).pathname;
        var platform = pathname.split('/')[1];

        if (installedPlatforms.indexOf(platform) >= 0 &&
            request.originalUrl.indexOf(platform) === -1) {
            response.redirect('/' + platform + '/www' + request.originalUrl);
        } else {
            next();
        }
    };
}

function platformRouter (platform) {
    const { configXml, www } = platforms.getPlatformApi(platform).getPlatformInfo().locations;
    const router = serve.Router();
    router.use('/www', serve.static(www));
    router.get('/config.xml', (req, res) => res.sendFile(configXml));
    router.get('/project.json', (req, res) => res.send({
        configPath: `/${platform}/config.xml`,
        wwwPath: `/${platform}/www`,
        wwwFileList: generateWwwFileList(www)
    }));
    return router;
}

function generateWwwFileList (www) {
    return globby.sync('**', { cwd: www }).map(p => ({
        path: p,
        etag: md5File.sync(path.join(www, p))
    }));
}

module.exports = function server (port, opts) {
    return Q().then(() => {
        port = +port || 8000;
        projectRoot = cordova_util.cdProjectRoot();

        var hooksRunner = new HooksRunner(projectRoot);
        return hooksRunner.fire('before_serve', opts).then(() => {
            // Run a prepare first!
            return require('./cordova').prepare([]);
        }).then(function () {
            var server = serve();

            installedPlatforms = cordova_util.listPlatforms(projectRoot);
            installedPlatforms.forEach(platform =>
                server.app.use(`/${platform}`, platformRouter(platform))
            );

            server.app.get('/*', getAbsolutePathHandler());
            server.app.get('*', handleRoot);

            server.launchServer({port: port, events: events});
            return hooksRunner.fire('after_serve', opts).then(() => {
                return server.server;
            });
        });
    });
};
