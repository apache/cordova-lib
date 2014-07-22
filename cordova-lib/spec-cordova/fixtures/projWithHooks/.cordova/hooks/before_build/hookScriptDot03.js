#!/usr/bin/env node
var path = require('path');
var orderLogger = require(path.join(process.argv.slice(2)[0], 'scripts', 'orderLogger'));
orderLogger.logOrder('01');