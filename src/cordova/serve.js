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
var { template, object: zipObject } = require('underscore');

var projectRoot;
var installedPlatforms;

const INDEX_TEMPLATE = `
<!doctype html>
<html>
<head>
    <meta charset=utf-8>
    <title>{{ metaData.name }}</title>
</head>
<body>
    <h3>Package Metadata</h3>
    <table style="text-align: left">
        {% for (const key in metaData) { %}
            <tr>
                <th>{{ key }}</th><td>{{ metaData[key] }}</td>
            </tr>
        {% } %}
    </table>

    <h3>Platforms</h3>
    <ul>
        {% for (const platform of platforms) { %}
            <li>
                {% if (platform.url) { %}
                    <a href="{{ platform.url }}">{{ platform.name }}</a>
                {% } else { %}
                    <em>{{ platform.name }}</em>
                {% } %}
            </li>
        {% } %}
    </ul>

    <h3>Plugins</h3>
    <ul>
        {% for (const plugin of plugins) { %}
            <li>{{ plugin }}</li>
        {% } %}
    </ul>
</body>
</html>
`;
const renderIndex = template(INDEX_TEMPLATE, {
    escape: /\{\{(.+?)\}\}/g,
    evaluate: /\{%(.+?)%\}/g
});

function handleRoot (request, response, next) {
    if (url.parse(request.url).pathname !== '/') {
        response.sendStatus(404);
        return;
    }

    const config = new ConfigParser(cordova_util.projectConfig(projectRoot));
    const contentNode = config.doc.find('content');
    const contentSrc = (contentNode && contentNode.attrib.src) || 'index.html';
    const metaDataKeys = ['name', 'packageName', 'version'];
    const platformUrl = name => installedPlatforms.includes(name) ?
        `${name}/www/${contentSrc}` : null;

    response.send(renderIndex({
        metaData: zipObject(metaDataKeys, metaDataKeys.map(k => config[k]())),
        plugins: cordova_util.findPlugins(path.join(projectRoot, 'plugins')),
        platforms: Object.keys(platforms).map(name => ({
            name, url: platformUrl(name)
        }))
    }));
}

// https://issues.apache.org/jira/browse/CB-11274
// Use referer url to redirect absolute urls to the requested platform resources
// so that an URL is resolved against that platform www directory.
function absolutePathHandler (request, response, next) {
    if (!request.headers.referer) return next();

    const { pathname } = url.parse(request.headers.referer);
    const platform = pathname.split('/')[1];

    if (installedPlatforms.includes(platform) &&
        !request.originalUrl.includes(platform)) {
        response.redirect(`/${platform}/www` + request.originalUrl);
    } else {
        next();
    }
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

            server.app.get('/*', absolutePathHandler);
            server.app.get('*', handleRoot);

            server.launchServer({port: port, events: events});
            return hooksRunner.fire('after_serve', opts).then(() => {
                return server.server;
            });
        });
    });
};
