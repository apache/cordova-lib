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

const url = require('url');
const path = require('path');
const globby = require('globby');
const md5File = require('md5-file');
const { template, object: zipObject } = require('underscore');

const { ConfigParser, events } = require('cordova-common');
const cordovaServe = require('cordova-serve');
const cordovaPrepare = require('./prepare');
const cordovaUtil = require('./util');
const platforms = require('../platforms/platforms');
const HooksRunner = require('../hooks/HooksRunner');

let projectRoot, installedPlatforms;

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

function handleRoot (request, response) {
    const config = new ConfigParser(cordovaUtil.projectConfig(projectRoot));
    const contentNode = config.doc.find('content');
    const contentSrc = (contentNode && contentNode.attrib.src) || 'index.html';
    const metaDataKeys = ['name', 'packageName', 'version'];
    const platformUrl = name => installedPlatforms.includes(name)
        ? `${name}/www/${contentSrc}` : null;

    response.send(renderIndex({
        metaData: zipObject(metaDataKeys, metaDataKeys.map(k => config[k]())),
        plugins: cordovaUtil.findPlugins(path.join(projectRoot, 'plugins')),
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

    // @todo Use 'url.URL' constructor instead since 'url.parse' was deprecated since v11.0.0
    const { pathname } = url.parse(request.headers.referer); // eslint-disable-line
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
    const router = cordovaServe.Router();
    router.use('/www', cordovaServe.static(www));
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

function registerRoutes (app) {
    installedPlatforms = cordovaUtil.listPlatforms(projectRoot);
    installedPlatforms.forEach(platform =>
        app.use(`/${platform}`, platformRouter(platform))
    );

    app.get('/*', absolutePathHandler);
    app.get('/', handleRoot);
}

function serve (port) {
    return Promise.resolve().then(() => {
        port = +port || 8000;
        const server = cordovaServe();

        // Run a prepare first!
        return cordovaPrepare([])
            .then(() => {
                registerRoutes(server.app);
                return server.launchServer({ port, events });
            })
            .then(() => server.server);
    });
}

module.exports = (port, hookOpts) => {
    return Promise.resolve().then(_ => {
        projectRoot = cordovaUtil.cdProjectRoot();
        const hooksRunner = new HooksRunner(projectRoot);
        return Promise.resolve()
            .then(_ => hooksRunner.fire('before_serve', hookOpts))
            .then(_ => serve(port))
            .then(result => {
                return hooksRunner.fire('after_serve', hookOpts)
                    .then(_ => result);
            });
    });
};
