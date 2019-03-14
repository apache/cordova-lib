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

var et = require('elementtree');
var fs = require('fs-extra');
var path = require('path');
var stripLicense = require('./util/strip-license');

/**
 * Used for adding templates for plugin platforms to plugin.xml
 */
module.exports = {
    add: function (platformName) {
        var pluginxml,
            platform;

        // Check to make sure we are in the plugin first
        if (!fs.existsSync('plugin.xml')) {
            return Promise.reject(new Error("can't find a plugin.xml.  Are you in the plugin?"));
        }

        // Get the current plugin.xml file
        pluginxml = et.parse(fs.readFileSync('plugin.xml', 'utf-8'));

        // Check if this platform exists
        if (pluginxml.find("./platform/[@name='" + platformName + "']")) {
            return Promise.reject(new Error('platform: ' + platformName + ' already added'));
        }

        // Get the platform specific elements
        platform = doPlatform(platformName, pluginxml.find('./name').text, pluginxml.getroot().get('id'));

        // Make sure we support it
        if (!platform) {
            return Promise.reject(new Error('platform: ' + platformName + ' not yet supported'));
        }

        pluginxml.getroot().append(platform.getroot());

        fs.writeFileSync('plugin.xml', pluginxml.write('plugin.xml', { indent: 4 }), 'utf-8');
        return Promise.resolve();
    },
    remove: function (platformName) {
        // Check to make sure we are in the plugin first
        if (!fs.existsSync('plugin.xml')) {
            return Promise.reject(new Error("can't find a plugin.xml.  Are you in the plugin?"));
        }

        // Get the current plugin.xml file
        var pluginxml = et.parse(fs.readFileSync('plugin.xml', 'utf-8'));

        // Check if this platform exists
        if (!pluginxml.find("./platform/[@name='" + platformName + "']")) {
            return Promise.reject(new Error('platform: ' + platformName + " hasn't been added"));
        }

        // Remove the Platform in question
        pluginxml.getroot().remove(pluginxml.find("./platform/[@name='" + platformName + "']"));

        // Rewrite the plugin.xml file back out
        fs.writeFileSync('plugin.xml', pluginxml.write('plugin.xml', { indent: 4 }), 'utf-8');

        // Remove the src/"platform"
        fs.removeSync(path.join('src', platformName));

        return Promise.resolve();
    }
};

function doPlatform (platformName, pluginName, pluginID, pluginVersion) {
    var templatesDir = path.join(__dirname, '..', '..', 'templates/platforms/' + platformName + '/');
    var platformFile = templatesDir + platformName + '.xml';
    var platform;

    if (!fs.existsSync(platformFile)) {
        return false;
    }

    platform = fs.readFileSync(platformFile, 'utf-8')
        .replace(/%pluginName%/g, pluginName)
        .replace(/%pluginID%/g, pluginID)
        .replace(/%packageName%/g, pluginID.replace(/[.]/g, '/'));
    platform = new et.ElementTree(et.XML(platform));

    doPlatformBase(templatesDir, platformName, pluginName, pluginID, pluginVersion);

    return platform;
}

function doPlatformBase (templatesDir, platformName, pluginName, pluginID, pluginVersion) {
    // Create the default plugin file
    var baseFiles = [];

    switch (platformName) {
    case 'android':
        baseFiles.push(
            {
                file: stripLicense.fromCode(fs.readFileSync(templatesDir + 'base.java', 'utf-8')
                    .replace(/%pluginName%/g, pluginName)
                    .replace(/%pluginID%/g, pluginID)),
                extension: 'java'
            }
        );

        break;
    case 'ios':
        baseFiles.push(
            {
                file: stripLicense.fromCode(fs.readFileSync(templatesDir + 'base.m', 'utf-8')
                    .replace(/%pluginName%/g, pluginName)),
                extension: 'm'
            }
        );
        break;
    case 'windows':
        baseFiles.push(
            {
                file: stripLicense.fromCode(fs.readFileSync(templatesDir + 'base.js', 'utf-8')),
                extension: 'js'
            }
        );
    }

    const baseDir = path.join('src', platformName);
    fs.ensureDirSync(baseDir);

    for (const { extension, file } of baseFiles) {
        const filePath = path.join(baseDir, `${pluginName}.${extension}`);
        fs.writeFileSync(filePath, file, 'utf-8');
    }

}
