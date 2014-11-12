
/*
 * GET users listing.
 */

var app = require('../app');

exports.list = function(req, res){
  res.send("respond with a resource");
};

app.get('/users', exports.list);
