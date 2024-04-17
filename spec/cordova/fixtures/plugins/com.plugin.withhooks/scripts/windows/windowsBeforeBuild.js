module.exports = function(context) {
    var orderLogger = require(require('node:path').join(context.opts.projectRoot, 'scripts', 'orderLogger'));
    orderLogger.logOrder('24', context);
};
