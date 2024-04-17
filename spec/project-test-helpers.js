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

const fs = require('node:fs');
const path = require('node:path');
const { ConfigParser } = require('cordova-common');

const fixturesPath = path.join(__dirname, 'cordova/fixtures');

// TODO remove this once apache/cordova-common#38
// and apache/cordova-common#39 are resolved
class TestConfigParser extends ConfigParser {
    addPlugin (plugin) {
        return (super.addPlugin(plugin, plugin.variables), this);
    }

    addEngine (...args) {
        return (super.addEngine(...args), this);
    }
}

module.exports = function projectTestHelpers (getProjectPath) {
    const getPkgJsonPath = () => path.join(getProjectPath(), 'package.json');
    const getConfigXmlPath = () => path.join(getProjectPath(), 'config.xml');

    function setupBaseProject () {
        const projectPath = getProjectPath();
        fs.cpSync(path.join(fixturesPath, 'basePkgJson'), projectPath, { recursive: true });
        process.chdir(projectPath);

        // It's quite bland, I assure you
        expect(getCfg().getPlugins()).toEqual([]);
        expect(getCfg().getEngines()).toEqual([]);
        expect(getPkgJson('cordova')).toBeUndefined();
        expect(getPkgJson('devDependencies')).toBeUndefined();
    }

    function getCfg () {
        const configXmlPath = getConfigXmlPath();
        expect(configXmlPath).toExist();
        return new TestConfigParser(configXmlPath);
    }

    function getPkgJson (propPath) {
        const pkgJsonPath = getPkgJsonPath();
        expect(pkgJsonPath).toExist();
        const keys = propPath ? propPath.split('.') : [];
        const jsonobj = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        return keys.reduce((obj, key) => {
            expect(obj).toBeDefined();
            return obj[key];
        }, jsonobj);
    }

    function setPkgJson (propPath, value) {
        const pkgJsonPath = getPkgJsonPath();
        expect(pkgJsonPath).toExist();
        const keys = propPath.split('.');
        const target = keys.pop();
        const pkgJsonObj = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const parentObj = keys.reduce((obj, key) => {
            return obj[key] || (obj[key] = {});
        }, pkgJsonObj);
        parentObj[target] = value;
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJsonObj, null, 2), 'utf8');
    }

    return {
        getPkgJsonPath,
        getConfigXmlPath,
        setupBaseProject,
        getCfg,
        getPkgJson,
        setPkgJson
    };
};
