module.exports.logOrder = function logOrder(index, context) {
    var indexWithEOL = index + require('os').EOL;
    var path = require('path');
    var fs = require('fs');

    if(context) {
        fs.appendFileSync(path.join(context.opts.projectRoot, 'hooks_order.txt'), indexWithEOL);
    } else {

        fs.appendFileSync('hooks_order.txt', indexWithEOL);
    }
}