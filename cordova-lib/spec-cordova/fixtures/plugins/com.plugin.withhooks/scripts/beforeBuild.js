module.exports = function(context) {
    var orderLogger = require(require('path').join(context.opts.projectRoot, 'scripts', 'orderLogger'));
    orderLogger.logOrder('21', context);
};
