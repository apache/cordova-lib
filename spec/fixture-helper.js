/*!
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
const { ConfigParser, events } = require('cordova-common');
const platformAdd = require('../src/cordova/platform').add;
const HooksRunner = require('../src/hooks/HooksRunner');

/**
 * Creates a function that provides access to various fixtures by name.
 *
 * @param {Function} tmpDir creates a temp dir when called and returns its path
 * @returns {Function} that provides access to various fixtures by name
 */
module.exports = function fixtureHelper (tmpDir) {
    let fixturesBaseDir;

    // Setup and teardown the directory where we setup our fixtures
    beforeAll(() => { fixturesBaseDir = tmpDir(); });
    afterAll(() => fs.removeSync(fixturesBaseDir));

    // The recipes for building the different kinds of fixture.
    // Resolve to the fixture path.
    const fixtureConstructors = {
        // Creates a stand-alone cordova-android app (platform-centered)
        androidApp () {
            const PlatformApi = require('cordova-android');
            const appPath = path.join(fixturesBaseDir, 'android-app');

            // We need to provide a ConfigParser instance to createPlatform :(
            const cfgXmlPath = require.resolve('cordova-android/bin/templates/project/res/xml/config.xml');
            const config = new ConfigParser(cfgXmlPath);

            // Create the app folder and return its path
            return PlatformApi.createPlatform(appPath, config, null, events)
                // Make our node_modules accessible from the app dir to make
                // platform modules work when they are required from the app dir.
                .then(_ => linkToGlobalModulesFrom(appPath))
                .then(_ => appPath);
        },

        // Creates a cordova project with one platform installed
        projectWithPlatform () {
            const projectFixture = path.join(__dirname, 'cordova/fixtures/basePkgJson');
            const projectPath = path.join(fixturesBaseDir, 'project-with-platform');

            return fs.copy(projectFixture, projectPath)
                .then(_ => process.chdir(projectPath))
                .then(_ => {
                    // Talk about a clunky interface :(
                    const platforms = ['android'];
                    const opts = { platforms, save: true };
                    const hooksRunner = new HooksRunner(projectPath);
                    return platformAdd(hooksRunner, projectPath, platforms, opts);
                })
                .then(_ => projectPath);
        }
    };

    // The fixture cache; contains promises to paths of already created fixtures
    const fixturePromises = {};

    // Finally, the public interface we provide our consumers. We intentionally
    // provide only a method to copy the fixtures, so that tests cannot alter
    // the global fixtures in any way.
    return function getFixture (name) {
        if (!(name in fixturePromises)) {
            fixturePromises[name] = fixtureConstructors[name]();
        }
        return {
            copyTo (targetPath) {
                return fixturePromises[name]
                    .then(fixturePath => fs.copy(fixturePath, targetPath))
                    .then(_ => targetPath);
            }
        };
    };
};

function linkToGlobalModulesFrom (dir) {
    return fs.symlink(
        path.join(__dirname, '../node_modules'),
        path.join(dir, 'node_modules'),
        'junction'
    );
}
