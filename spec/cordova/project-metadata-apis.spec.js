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

const cordova = require('../../src/cordova/cordova');
const path = require('path');

describe('retrieval of project metadata', function () {
    const projectRoot = path.resolve(__dirname, 'fixtures/projects/ProjectMetadata');

    it('Test 001 : retrieve platforms saved in config.xml', function () {
        const androidVersion = '3.7.1';
        const browserSrc = 'https://github.com/apache/cordova-browser.git';

        return cordova.projectMetadata.getPlatforms(projectRoot)
            .then(function (platforms) {
                expect(platforms.length).toBe(2);

                // Android platform has version defined in deprecated version field - should still work.
                const androidPlatform = findPlatform(platforms, 'android');
                expect(androidPlatform).not.toBeNull();
                expect(androidPlatform.version).toBe(androidVersion);
                expect(androidPlatform.src).toBeUndefined();

                // Browser platform has source defined in the spec field.
                const browserPlatform = findPlatform(platforms, 'browser');
                expect(browserPlatform).not.toBeNull();
                expect(browserPlatform.version).toBeUndefined();
                expect(browserPlatform.src).toBe(browserSrc);
            });
    });

    it('Test 002 : retrieve plugins saved in config.xml', function () {
        const deviceId = 'org.apache.cordova.device';
        const deviceVersion = '0.3.0';

        const cameraId = 'org.apache.cordova.camera';
        const cameraSrc = 'https://github.com/apache/cordova-plugin-camera.git';
        const cameraVariableName = 'TEST_VARIABLE';
        const cameraVariableValue = 'My Test Variable';

        const fileId = 'org.apache.cordova.file';
        const fileSource = 'https://github.com/apache/cordova-plugin-file.git';

        return cordova.projectMetadata.getPlugins(projectRoot)
            .then(function (plugins) {
                expect(plugins.length).toBe(3);

                // Device plugin uses current spec attribute to specify version - should be returned in version field.
                const devicePlugin = findPlugin(plugins, deviceId);
                expect(devicePlugin).not.toBeNull();
                expect(devicePlugin.version).toBe(deviceVersion);
                expect(devicePlugin.src).toBeUndefined();

                const deviceVariables = devicePlugin.variables;
                expect(deviceVariables).not.toBeNull();
                expect(Array.isArray(deviceVariables)).toBeTruthy();
                expect(deviceVariables.length).toBe(0);

                // Camera plugin uses deprecated src attribute - still should work.
                const cameraPlugin = findPlugin(plugins, cameraId);
                expect(cameraPlugin).not.toBeNull();
                expect(cameraPlugin.src).toBe(cameraSrc);
                expect(cameraPlugin.version).toBeUndefined();

                const cameraVariables = cameraPlugin.variables;
                expect(cameraVariables).not.toBeNull();
                expect(cameraVariables.length).toBe(1);
                expect(cameraVariables[0].name).toBe(cameraVariableName);
                expect(cameraVariables[0].value).toBe(cameraVariableValue);

                // File plugin uses deprecated src and version attributes - version should be ignored.
                const filePlugin = findPlugin(plugins, fileId);
                expect(filePlugin).not.toBeNull();
                expect(filePlugin.version).toBeUndefined();
                expect(filePlugin.src).toBe(fileSource);

                const fileVariables = filePlugin.variables;
                expect(fileVariables).not.toBeNull();
                expect(Array.isArray(fileVariables)).toBeTruthy();
                expect(fileVariables.length).toBe(0);
            });
    });
});

function findPlatform (platforms, platformName) {
    for (let i = 0; i < platforms.length; i++) {
        if (platforms[i].name === platformName) {
            return platforms[i];
        }
    }
    return null;
}

function findPlugin (plugins, pluginId) {
    for (let i = 0; i < plugins.length; i++) {
        if (plugins[i].name === pluginId) {
            return plugins[i];
        }
    }
    return null;
}
