var express = require('express');
var app = express();

app.use(express.compress());
app.use(express.static(__dirname));

var server = app.listen(process.env.PORT || 3080, function() {
    console.log('Listening on port %d', server.address().port);
});
