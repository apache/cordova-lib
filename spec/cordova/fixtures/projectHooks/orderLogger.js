module.exports.logOrder = function logOrder(index, context) {
    var indexWithEOL = index + require('node:os').EOL;
    var path = require('node:path');
    var fs = require('node:fs');

    if(context) {
        fs.appendFileSync(path.join(context.opts.projectRoot, 'hooks_order.txt'), indexWithEOL);
    } else {

        fs.appendFileSync('hooks_order.txt', indexWithEOL);
    }
};
