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

const fs = require('fs-extra');
const path = require('path');
const et = require('elementtree');
const CordovaError = require('cordova-common').CordovaError;
const stripLicense = require('./util/strip-license');

module.exports = function create (name, id, version, pluginPath, options) {
    const cwd = pluginPath + '/' + name + '/';
    const templatesDir = path.join(__dirname, '..', '..', 'templates/');

    // Check we are not already in a plugin
    if (fs.existsSync(cwd + 'plugin.xml')) {
        return Promise.reject(new CordovaError('plugin.xml already exists. Are you already in a plugin?'));
    }

    // Create a plugin.xml file
    const root = et.Element('plugin');
    root.set('xmlns', 'http://apache.org/cordova/ns/plugins/1.0');
    root.set('xmlns:android', 'http://schemas.android.com/apk/res/android');
    root.set('id', id);
    root.set('version', version);

    // Add the name tag
    const pluginName = et.XML('<name></name>');
    pluginName.text = name;
    root.append(pluginName);

    // Loop through the options( variables ) for other tags
    for (const key in options) {
        const temp = et.XML('<' + key + '>');
        temp.text = options[key];
        root.append(temp);
    }

    // Setup the directory structure
    fs.ensureDirSync(cwd + 'www');
    fs.ensureDirSync(cwd + 'src');

    // Create a base plugin.js file
    const baseJS = stripLicense.fromCode(fs.readFileSync(templatesDir + 'base.js', 'utf-8').replace(/%pluginName%/g, name));
    fs.writeFileSync(cwd + 'www/' + name + '.js', baseJS, 'utf-8');
    // Add it to the xml as a js module
    const jsMod = et.Element('js-module');
    jsMod.set('src', 'www/' + name + '.js');
    jsMod.set('name', name);

    const clobber = et.Element('clobbers');
    clobber.set('target', 'cordova.plugins.' + name);
    jsMod.append(clobber);

    root.append(jsMod);

    // Write out the plugin.xml file
    fs.writeFileSync(cwd + 'plugin.xml', new et.ElementTree(root).write({ indent: 4 }), 'utf-8');

    return Promise.resolve();
};
