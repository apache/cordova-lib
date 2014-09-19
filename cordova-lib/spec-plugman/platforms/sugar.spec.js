/*
 *
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 *
*/
var sugar = require('../../src/plugman/platforms/sugar'),
	common = require('../../src/plugman/platforms/common'),
	temp = require('temp'),
	os = require('osenv'),
	fs = require('fs'),
	et = require('elementtree'),
	path = require('path'),
	sugar_project = path.join(__dirname, '..', 'projects', 'sugar'),
	destination = temp.path(),
	shell = require('shelljs'),
	dummyPluginPath = path.join(__dirname, '..', 'plugins', 'DummyPlugin'),
	dummyPlugin = et.XML(fs.readFileSync(
		path.join(dummyPluginPath, 'plugin.xml'), {encoding: "utf-8"})),
	dummySources = dummyPlugin
		.find('./platform[@name="sugar"]')
		.findall('./source-file');

describe('Sugar project handler', function() {
	describe('www_dir method', function() {
		it('should append www to the directory passed in', function() {
			expect(sugar.www_dir(path.sep)).toEqual(path.join(path.sep, 'www'));
		});
	});
});
