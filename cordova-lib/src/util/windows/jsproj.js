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

/* jshint node:true, bitwise:true, undef:true, trailing:true, quotmark:true,
          indent:4, unused:vars, latedef:nofunc,
          quotmark:false, unused:false
*/

/*
  Helper for dealing with Windows Store JS app .jsproj files
*/


var xml_helpers = require('../../util/xml-helpers'),
    et = require('elementtree'),
    fs = require('fs'),
    shell = require('shelljs'),
    events = require('../../events'),
    path = require('path');

var WinCSharpProjectTypeGUID = "{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}";  // .csproj
var WinCplusplusProjectTypeGUID = "{8BC9CEB8-8B4A-11D0-8D11-00A0C91BC942}";  // .vcxproj

// Match a JavaScript Project
var JsProjectRegEx = /(Project\("\{262852C6-CD72-467D-83FE-5EEB1973A190}"\)\s*=\s*"[^"]+",\s*"[^"]+",\s*"\{[0-9a-f\-]+}"[^\r\n]*[\r\n]*)/gi;

// Chars in a string that need to be escaped when used in a RegExp
var RegExpEscRegExp = /([.?*+\^$\[\]\\(){}|\-])/g;

function jsproj(location) {
    if (!location) {
        throw new Error('Project file location can\'t be null or empty' );
    }
    events.emit('verbose','creating jsproj from project at : ' + location);
    this.location = location;
    this.xml = xml_helpers.parseElementtreeSync(location);
    // Detect universal Windows app project template
    this.isUniversalWindowsApp = location.match(/\.(projitems|shproj)$/i);
    return this;
}

jsproj.prototype = {
    location:null,
    xml:null,
    plugins_dir:"Plugins",
    write:function() {
        fs.writeFileSync(this.location, this.xml.write({indent:4}), 'utf-8');
    },

    // add/remove the item group for SDKReference
    // example :
    // <ItemGroup><SDKReference Include="Microsoft.VCLibs, version=12.0" /></ItemGroup>
    addSDKRef:function(incText) {
        var item_group = new et.Element('ItemGroup');
        var elem = new et.Element('SDKReference');
        elem.attrib.Include = incText;

        item_group.append(elem);
        this.xml.getroot().append(item_group);
    },

    removeSDKRef:function(incText) {
        var item_group = this.xml.find('ItemGroup/SDKReference[@Include="' + incText + '"]/..');
        if(item_group) { // TODO: error handling
            this.xml.getroot().remove(0, item_group);
        }
    },

    addReference:function(relPath) {
        events.emit('verbose','addReference::' + relPath);

        var item = new et.Element('ItemGroup');
        var extName = path.extname(relPath);

        var elem = new et.Element('Reference');
        // add file name
        elem.attrib.Include = path.basename(relPath, extName);

        // add hint path with full path
        var hint_path = new et.Element('HintPath');
        hint_path.text = relPath;

        elem.append(hint_path);

        if(extName == ".winmd") {
            var mdFileTag = new et.Element("IsWinMDFile");
            mdFileTag.text = "true";
            elem.append(mdFileTag);
        }

        item.append(elem);
        this.xml.getroot().append(item);
    },

    removeReference:function(relPath) {
        events.emit('verbose','removeReference::' + relPath);

        var extName = path.extname(relPath);
        var includeText = path.basename(relPath,extName);
        // <ItemGroup>
        //   <Reference Include="WindowsRuntimeComponent1">
        var item_group = this.xml.find('ItemGroup/Reference[@Include="' + includeText + '"]/..');

        if(item_group) { // TODO: erro handling
            this.xml.getroot().remove(0, item_group);
        }
    },

    addSourceFile:function(relative_path) {
        // we allow multiple paths to be passed at once as array so that
        // we don't create separate ItemGroup for each source file, CB-6874
        if (!(relative_path instanceof Array)) {
            relative_path = [relative_path];
        }
        // make ItemGroup to hold file.
        var item = new et.Element('ItemGroup');

        relative_path.forEach(function(filePath) {
            filePath = filePath.split('/').join('\\');

            var content = new et.Element('Content');
            content.attrib.Include = filePath;
            item.append(content);
        });
        this.xml.getroot().append(item);
    },

    removeSourceFile: function(relative_path) {
        var isRegexp = relative_path instanceof RegExp;
        if (!isRegexp) {
            // path.normalize(relative_path);// ??
            relative_path = relative_path.split('/').join('\\');
        }

        var root = this.xml.getroot();
        // iterate through all ItemGroup/Content elements and remove all items matched
        this.xml.findall('ItemGroup').forEach(function(group){
            // matched files in current ItemGroup
            var filesToRemove = group.findall('Content').filter(function(item) {
                if (!item.attrib.Include) return false;
                return isRegexp ? item.attrib.Include.match(relative_path) :
                    item.attrib.Include == relative_path;
            });

            // nothing to remove, skip..
            if (filesToRemove.length < 1) return;

            filesToRemove.forEach(function(file) {
                // remove file reference
                group.remove(0, file);
            });
            // remove ItemGroup if empty
            if(group.findall('*').length < 1) {
                root.remove(0, group);
            }
        });
    },

    // relative path must include the project file, so we can determine .csproj, .jsproj, .vcxproj...
    addProjectReference: function (relative_path) {
        events.emit('verbose', 'adding project reference to ' + relative_path);

        relative_path = relative_path.split('/').join('\\');

        var pluginProjectXML = xml_helpers.parseElementtreeSync(relative_path);

        // find the guid + name of the referenced project
        var projectGuid = pluginProjectXML.find("PropertyGroup/ProjectGuid").text;
        var projName = pluginProjectXML.find("PropertyGroup/ProjectName").text;

        // get the project type
        var projectTypeGuid = getProjectTypeGuid(relative_path);
        if (!projectTypeGuid) {
            throw new Error("unrecognized project type");
        }

        var preInsertText = "\tProjectSection(ProjectDependencies) = postProject\r\n" +
            "\t\t" + projectGuid + "=" + projectGuid + "\r\n" +
            "\tEndProjectSection\r\n";
        var postInsertText = '\r\nProject("' + projectTypeGuid + '") = "' +
            projName + '", "' + relative_path + '", ' +
            '"' + projectGuid + '"\r\nEndProject';

        // There may be multiple solutions (for different VS versions) - process them all
        getSolutionPaths(this.location).forEach(function (solutionPath) {
            var solText = fs.readFileSync(solutionPath, {encoding: "utf8"});

            // Insert a project dependency into each jsproj in the solution.
            var jsProjectFound = false;
            solText = solText.replace(JsProjectRegEx, function (match) {
                jsProjectFound = true;
                return match + preInsertText;
            });

            if (!jsProjectFound) {
                throw new Error("no jsproj found in solution");
            }

            // Add the project after existing projects. Note that this fairly simplistic check should be fine, since the last
            // EndProject in the file should actually be an EndProject (and not an EndProjectSection, for example).
            var pos = solText.lastIndexOf("EndProject");
            if (pos === -1) {
                throw new Error("no EndProject found in solution");
            }
            pos += 10; // Move pos to the end of EndProject text
            solText = solText.slice(0, pos) + postInsertText + solText.slice(pos);

            fs.writeFileSync(solutionPath, solText, {encoding: "utf8"});
        });

        // Add the ItemGroup/ProjectReference to the cordova project :
        // <ItemGroup><ProjectReference Include="blahblah.csproj"/></ItemGroup>
        var item = new et.Element('ItemGroup');
        var projRef = new et.Element('ProjectReference');
        projRef.attrib.Include = relative_path;
        item.append(projRef);
        this.xml.getroot().append(item);
    },

    removeProjectReference: function (relative_path) {
        events.emit('verbose', 'removing project reference to ' + relative_path);

        // find the guid + name of the referenced project
        var pluginProjectXML = xml_helpers.parseElementtreeSync(relative_path);
        var projectGuid = pluginProjectXML.find("PropertyGroup/ProjectGuid").text;
        var projName = pluginProjectXML.find("PropertyGroup/ProjectName").text;

        // get the project type
        var projectTypeGuid = getProjectTypeGuid(relative_path);
        if (!projectTypeGuid) {
            throw new Error("unrecognized project type");
        }

        var preInsertTextRegExp = getProjectReferencePreInsertRegExp(projectGuid);
        var postInsertTextRegExp = getProjectReferencePostInsertRegExp(projName, projectGuid, relative_path, projectTypeGuid);

        // There may be multiple solutions (for different VS versions) - process them all
        getSolutionPaths(this.location).forEach(function (solutionPath) {
            var solText = fs.readFileSync(solutionPath, {encoding: "utf8"});

            // To be safe (to handle subtle changes in formatting, for example), use a RegExp to find and remove
            // preInsertText and postInsertText

            solText = solText.replace(preInsertTextRegExp, function () {
                return "";
            });

            solText = solText.replace(postInsertTextRegExp, function () {
                return "";
            });

            fs.writeFileSync(solutionPath, solText, {encoding: "utf8"});
        });

        // select first ItemsGroups with a ChildNode ProjectReference
        // ideally select all, and look for @attrib 'Include'= projectFullPath
        var projectRefNodesPar = this.xml.find("ItemGroup/ProjectReference[@Include='" + relative_path + "']/..");
        if (projectRefNodesPar) {
            this.xml.getroot().remove(0, projectRefNodesPar);
        }
    }
};

function getProjectReferencePreInsertRegExp(projectGuid) {
    projectGuid = escapeRegExpString(projectGuid);
    return new RegExp("\\s*ProjectSection\\(ProjectDependencies\\)\\s*=\\s*postProject\\s*" + projectGuid + "\\s*=\\s*" + projectGuid + "\\s*EndProjectSection", "gi");
}

function getProjectReferencePostInsertRegExp(projName, projectGuid, relative_path, projectTypeGuid) {
    projName = escapeRegExpString(projName);
    projectGuid = escapeRegExpString(projectGuid);
    relative_path = escapeRegExpString(relative_path);
    projectTypeGuid = escapeRegExpString(projectTypeGuid);
    return new RegExp('\\s*Project\\("' + projectTypeGuid + '"\\)\\s*=\\s*"' + projName + '"\\s*,\\s*"' + relative_path + '"\\s*,\\s*"' + projectGuid + '"\\s*EndProject', 'gi');
}

function getSolutionPaths(jsprojLocation) {
    return shell.ls(path.join(path.dirname(jsprojLocation), "*.sln")); // TODO:error handling
}

function escapeRegExpString(regExpString) {
    return regExpString.replace(RegExpEscRegExp, "\\$1");
}

function getProjectTypeGuid(projectPath) {
    switch (path.extname(projectPath)) {
        case ".vcxproj":
            return WinCplusplusProjectTypeGUID;

        case ".csproj":
            return WinCSharpProjectTypeGUID;
    }
    return null;
}

module.exports = jsproj;
