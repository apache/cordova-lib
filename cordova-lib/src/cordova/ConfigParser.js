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
var et = require('elementtree'),
    xml= require('../util/xml-helpers'),
    CordovaError = require('../CordovaError'),
    fs = require('fs');


/** Wraps a config.xml file */
function ConfigParser(path) {
    this.path = path;
    try {
        this.doc = xml.parseElementtreeSync(path);
        et.register_namespace(getCordovaNamespacePrefix(this.doc), 'http://cordova.apache.org/ns/1.0');
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
        doc.getroot().append(content);
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

ConfigParser.prototype = {
    packageName: function(id) {
        return this.doc.getroot().attrib['id'];
    },
    setPackageName: function(id) {
        this.doc.getroot().attrib['id'] = id;
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
        this.doc.find('description').text = text;
        var el = findOrCreate(this.doc, 'description');
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
    getPreference: function(name) {
        var preferences = this.doc.findall('preference');
        var ret = null;
        preferences.forEach(function (preference) {
            // Take the last one that matches.
            if (preference.attrib.name.toLowerCase() === name.toLowerCase()) {
                ret = preference.attrib.value;
            }
        });
        return ret;
    },
    /**
     * Returns all icons for the platform specified.
     * @param  {String} platform The platform.
     * @return {Array} Icons for the platform specified.
     */
    getIcons: function(platform) {
        var ret = [];
            iconElements = [];

        if (platform) { // platform specific icons
            this.doc.findall('platform[@name=\'' + platform + '\']/icon').forEach(function(elt){
                elt.platform = platform; // mark as platform specific icon
                iconElements.push(elt)
            });
        }
        // root level icons
        iconElements = iconElements.concat(this.doc.findall('icon'));
        // parse icon elements
        var that = this;
        iconElements.forEach(function (elt) {
            var icon = {};
            icon.src = elt.attrib.src;
            icon.density = elt.attrib['density'] || elt.attrib[getCordovaNamespacePrefix(that.doc)+':density'] || elt.attrib['gap:density'];
            icon.platform = elt.platform || null; // null means icon represents default icon (shared between platforms)
            icon.width = elt.attrib.width;
            icon.height = elt.attrib.height;
            // If one of width or Height is undefined, assume they are equal.
            icon.width = icon.width || icon.height;
            icon.height = icon.height || icon.width;

            // default icon
            if (!icon.width && !icon.height && !icon.density) {
                ret.defaultIcon = icon;
            }
            ret.push(icon);
        });

        /**
         * Returns icon with specified width and height
         * @param  {number} w  Width of icon
         * @param  {number} h  Height of icon
         * @return {Icon}      Icon object or null if not found
         */
        ret.getIconBySize = function(w, h){
            // If only one of width and height is given
            // then we assume that they are equal.
            var width = w || h, height = h || w;
            for (var idx in this) {
                var icon = this[idx];
                if (width == icon.width && height == icon.width) return icon;
            }
            return null;
        };
        /** Returns default icons */
        ret.getDefault = function() {
            return ret.defaultIcon;
        }

        return ret;
    },
    /**
     *This does not check for duplicate feature entries
     */
    addFeature: function (name, params){ 
      if(!name) return;
      var el = new et.Element('feature');
      el.attrib.name = name;
        if(params){
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
     * @param  {String} id the engine id
     * @param  {String} version engine version (optional)
     */
    addEngine: function(id, version){
        if(!id) return;
        var el = et.Element('{http://cordova.apache.org/ns/1.0}engine');
        el.attrib.id = id;
        if(version){
            el.attrib.version = version;
        }
        this.doc.getroot().append(el);
    },
    /**
     * Removes all the engines with given id
     * @param  {String} id the engine id.
     */
    removeEngine: function(id){
         var engines = this.doc.findall('./'+getCordovaNamespacePrefix(this.doc)+':engine/[@id="' +id+'"]');
         for(var i=0; i < engines.length; i++){
            var childs = this.doc.getroot().getchildren();
            var idx = childs.indexOf(engines[i]);
            if(idx > -1){
                childs.splice(idx,1);
             }
         }
    },
    getEngines: function(){
        var engines = this.doc.findall('./'+getCordovaNamespacePrefix(this.doc)+':engine');
        return engines.map(function(engine){
           return {'id':engine.attrib.id};             
        });
    },
    write:function() {
        fs.writeFileSync(this.path, this.doc.write({indent: 4}), 'utf-8');
    }
};

module.exports = ConfigParser;
