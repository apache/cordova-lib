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

/* jshint sub:true */

var et = require('elementtree'),
    xml= require('../util/xml-helpers'),
    CordovaError = require('../CordovaError'),
    fs = require('fs');

/**
 * Array of 'feature' params that are set as properties
 * @type {string[]}
 */
var FEATURE_SPECIAL_PARAMS = [
    'id',
    'url',
    'version',
    'installPath'
];

/** Wraps a config.xml file */
function ConfigParser(path) {
    this.path = path;
    try {
        this.doc = xml.parseElementtreeSync(path);
        this.cdvNamespacePrefix = getCordovaNamespacePrefix(this.doc);
        et.register_namespace(this.cdvNamespacePrefix, 'http://cordova.apache.org/ns/1.0');
    } catch (e) {
        console.error('Parsing '+path+' failed');
        throw e;
    }
    var r = this.doc.getroot();
    if (r.tag !== 'widget') {
        throw new CordovaError(path + ' has incorrect root node name (expected "widget", was "' + r.tag + '")');
    }
}

function getNodeTextSafe(el) {
    return el && el.text && el.text.trim();
}

function findOrCreate(doc, name) {
    var ret = doc.find(name);
    if (!ret) {
        ret = new et.Element(name);
        doc.getroot().append(ret);
    }
    return ret;
}

function getCordovaNamespacePrefix(doc){
    var rootAtribs = Object.getOwnPropertyNames(doc.getroot().attrib);
    var prefix = 'cdv';
    for (var j = 0; j < rootAtribs.length; j++ ) {
        if(rootAtribs[j].indexOf('xmlns:') === 0 &&
            doc.getroot().attrib[rootAtribs[j]] === 'http://cordova.apache.org/ns/1.0'){
            var strings = rootAtribs[j].split(':');
            prefix = strings[1];
            break;
        }
    }
    return prefix;
}

/**
 * Finds the value of an element's attribute
 * @param  {String} attributeName Name of the attribute to search for
 * @param  {Array}  elems         An array of ElementTree nodes
 * @return {String}
 */
function findElementAttributeValue(attributeName, elems) {

    elems = Array.isArray(elems) ? elems : [ elems ];

    var value = elems.filter(function (elem) {
        return elem.attrib.name.toLowerCase() === attributeName.toLowerCase();
    }).map(function (filteredElems) {
        return filteredElems.attrib.value;
    }).pop();

    return value ? value : '';
}

ConfigParser.prototype = {
    packageName: function(id) {
        return this.doc.getroot().attrib['id'];
    },
    setPackageName: function(id) {
        this.doc.getroot().attrib['id'] = id;
    },
    android_packageName: function() {
        return this.doc.getroot().attrib['android-packageName'];
    },
    ios_CFBundleIdentifier: function() {
        return this.doc.getroot().attrib['ios-CFBundleIdentifier'];
    },
    name: function() {
        return getNodeTextSafe(this.doc.find('name'));
    },
    setName: function(name) {
        var el = findOrCreate(this.doc, 'name');
        el.text = name;
    },
    description: function() {
        return this.doc.find('description').text.trim();
    },
    setDescription: function(text) {
        var el = findOrCreate(this.doc, 'description');
        el.text = text;
    },
    version: function() {
        return this.doc.getroot().attrib['version'];
    },
    android_versionCode: function() {
        return this.doc.getroot().attrib['android-versionCode'];
    },
    ios_CFBundleVersion: function() {
        return this.doc.getroot().attrib['ios-CFBundleVersion'];
    },
    setVersion: function(value) {
        this.doc.getroot().attrib['version'] = value;
    },
    author: function() {
        return getNodeTextSafe(this.doc.find('author'));
    },
    getGlobalPreference: function (name) {
        return findElementAttributeValue(name, this.doc.findall('preference'));
    },
    getPlatformPreference: function (name, platform) {
        return findElementAttributeValue(name, this.doc.findall('platform[@name=\'' + platform + '\']/preference'));
    },
    getPreference: function(name, platform) {

        var platformPreference = '';

        if (platform) {
            platformPreference = this.getPlatformPreference(name, platform);
        }

        return platformPreference ? platformPreference : this.getGlobalPreference(name);

    },
    /**
     * Returns all resources for the platform specified.
     * @param  {String} platform     The platform.
     * @param {string}  resourceName Type of static resources to return.
     *                               "icon" and "splash" currently supported.
     * @return {Array}               Resources for the platform specified.
     */
    getStaticResources: function(platform, resourceName) {
        var ret = [],
            staticResources = [];
        if (platform) { // platform specific icons
            this.doc.findall('platform[@name=\'' + platform + '\']/' + resourceName).forEach(function(elt){
                elt.platform = platform; // mark as platform specific resource
                staticResources.push(elt);
            });
        }
        // root level resources
        staticResources = staticResources.concat(this.doc.findall(resourceName));
        // parse resource elements
        var that = this;
        staticResources.forEach(function (elt) {
            var res = {};
            res.src = elt.attrib.src;
            res.density = elt.attrib['density'] || elt.attrib[that.cdvNamespacePrefix+':density'] || elt.attrib['gap:density'];
            res.platform = elt.platform || null; // null means icon represents default icon (shared between platforms)
            res.width = elt.attrib.width;
            res.height = elt.attrib.height;

            // default icon
            if (!res.width && !res.height && !res.density) {
                ret.defaultResource = res;
            }
            ret.push(res);
        });

        /**
         * Returns resource with specified width and/or height.
         * @param  {number} width Width of resource.
         * @param  {number} height Height of resource.
         * @return {Resource} Resource object or null if not found.
         */
        ret.getBySize = function(width, height) {
            if (!width && !height){
                throw 'One of width or height must be defined';
            }
            for (var idx in this){
                var res = this[idx];
                // If only one of width or height is not specified, use another parameter for comparation
                // If both specified, compare both.
                if ((!width || (width == res.width)) &&
                    (!height || (height == res.height))){
                    return res;
                }
            }
            return null;
        };

        /**
         * Returns resource with specified density.
         * @param  {string} density Density of resource.
         * @return {Resource}       Resource object or null if not found.
         */
        ret.getByDensity = function (density) {
            for (var idx in this) {
                if (this[idx].density == density) {
                    return this[idx];
                }
            }
            return null;
        };

        /** Returns default icons */
        ret.getDefault = function() {
            return ret.defaultResource;
        };

        return ret;
    },

    /**
     * Returns all icons for specific platform.
     * @param  {string} platform Platform name
     * @return {Resource[]}      Array of icon objects.
     */
    getIcons: function(platform) {
        return this.getStaticResources(platform, 'icon');
    },

    /**
     * Returns all splash images for specific platform.
     * @param  {string} platform Platform name
     * @return {Resource[]}      Array of Splash objects.
     */
    getSplashScreens: function(platform) {
        return this.getStaticResources(platform, 'splash');
    },
    
    /**
     * Returns all hook scripts for the hook type specified.
     * @param  {String} hook     The hook type.
     * @param {Array}  platforms Platforms to look for scripts into (root scripts will be included as well).
     * @return {Array}               Script elements.
     */
    getHookScripts: function(hook, platforms) {
        var self = this;
        var scriptElements = self.doc.findall('./hook');

        if(platforms) {
            platforms.forEach(function (platform) {
                scriptElements = scriptElements.concat(self.doc.findall('./platform[@name="' + platform + '"]/hook'));
            });
        }

        function filterScriptByHookType(el) {
            return el.attrib.src && el.attrib.type && el.attrib.type.toLowerCase() === hook;
        }

        return scriptElements.filter(filterScriptByHookType);
    },

    /**
     * Returns a list of features (IDs)
     * @return {string[]} Array of feature IDs
     */
    getFeatureIdList: function () {
        var features = this.doc.findall('feature'),
            feature, idTag, id,
            result = [];

        // Check for valid features that have IDs set
        for (var i = 0, l = features.length; i < l; ++i) {
            feature = features[i];
            idTag = feature.find('./param[@name="id"]');
            if (null === idTag) {
                // Invalid feature
                continue;
            }
            id = idTag.attrib.value;
            if (!!id) {
                // Has id and id is non-empty
                result.push(id);
            }
        }

        return result;
    },

    /**
     * Gets feature info
     * @param {string} id Feature id
     * @returns {Feature} Feature object
     */
    getFeature: function(id) {
        if (!id) {
            return undefined;
        }
        var feature = this.doc.find('./feature/param[@name="id"][@value="' + id + '"]/..');
        if (null === feature) {
            return undefined;
        }

        var result = {};
        result.id = id;
        result.name = feature.attrib.name;

        // Iterate params and fill-in 'params' structure
        // For special cases like 'id', 'url, 'version' - copy to the main space
        result.params = processChildren (
            'param',
            function(name, value) {
                if (FEATURE_SPECIAL_PARAMS.indexOf(name) >= 0) {
                    result[name] = value;
                }
            }
        );

        // Iterate preferences
        result.variables = processChildren('variable');

        return result;

        /**
         * Processes a set of children
         * having a pair of 'name' and 'value' attributes
         * filling in 'output' object
         * @param {string} xPath Search expression
         * @param {function} [specialProcessing] Performs some additional actions on each valid element
         * @return {object} A transformed object
         */
        function processChildren (xPath, specialProcessing) {
            var result = {};
            var needsProcessing = 'function' === typeof specialProcessing;
            var nodes = feature.findall(xPath);
            nodes.forEach(function(param){
                var name = param.attrib.name;
                var value = param.attrib.value;
                if (name) {
                    result[name] = value;
                    if (needsProcessing) {
                        specialProcessing(name, value);
                    }
                }
            });
            return result;
        }
    },


    /**
     *This does not check for duplicate feature entries
     */
    addFeature: function (name, params){
        if(!name) return;
        var el = new et.Element('feature');
        el.attrib.name = name;
        if (params) {
            params.forEach(function(param){
                var p = new et.Element('param');
                p.attrib.name = param.name;
                p.attrib.value = param.value;
                el.append(p);
            });
        }
        this.doc.getroot().append(el);
    },

    /**
     * Adds an engine. Does not check for duplicates.
     * @param  {String} name the engine name
     * @param  {String} version engine version (optional)
     */
    addEngine: function(name, version){
        if(!name) return;
        var el = et.Element('engine');
        el.attrib.name = name;
        if(version){
            el.attrib.version = version;
        }
        this.doc.getroot().append(el);
    },
    /**
     * Removes all the engines with given name
     * @param  {String} name the engine name.
     */
    removeEngine: function(name){
        var engines = this.doc.findall('./engine/[@name="' +name+'"]');
        for(var i=0; i < engines.length; i++){
            var childs = this.doc.getroot().getchildren();
            var idx = childs.indexOf(engines[i]);
            if(idx > -1){
                childs.splice(idx,1);
            }
        }
    },
    getEngines: function(){
        var engines = this.doc.findall('./engine');
        return engines.map(function(engine){
	    var version = engine.attrib.version;
            return {
		'name': engine.attrib.name,
		'version': version ? version : null
	    };
        });
    },
    write:function() {
        fs.writeFileSync(this.path, this.doc.write({indent: 4}), 'utf-8');
    }
};

module.exports = ConfigParser;
