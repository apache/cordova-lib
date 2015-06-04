var Parser = require('../../../src/cordova/metadata/parser');

function FakeParser(project) { }
FakeParser.prototype.update_from_config = function() { };
FakeParser.prototype.www_dir = function() { };
FakeParser.prototype.config_xml = function() { };
FakeParser.prototype.cordovajs_src_path = function(libDir) { };
FakeParser.prototype.update_www = function() { };
FakeParser.prototype.update_project = function(cfg) { };

require('util').inherits(FakeParser, Parser);
module.exports = FakeParser;
