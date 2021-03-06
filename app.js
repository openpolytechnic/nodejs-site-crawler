
/**
 * Module dependencies.
 */

var express = require('express')
  , http = require('http')
  , path = require('path')
  , fs = require('fs')
  , mongoose = require('mongoose')
  , csv = require('express-csv')
  , config = require('config');

var app = module.exports = express();
var dbconnect = mongoose.connect(config.dburl);

// Authenticator, users are set in config/default.json
app.use(express.basicAuth(function(user, pass) {
    if(config.users != undefined && config.users[user]){
        if(pass === config.users[user].password){
            app.set('isadmin', config.users[user].isAdmin);
            return true;
        }
    }
    return false;
}));

// all environments
app.set('name', 'Moodle Crawler');
app.set('dbconnect', dbconnect);
app.set('port', process.env.PORT || 80);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' === app.get('env')) {
  app.use(express.errorHandler());
}


// dynamically include routes (Controller)
fs.readdirSync('./controllers').forEach(function (file) {
    if(file.substr(-3) == '.js') {
        route = require('./controllers/' + file);
        route.controller(app);
    }
});


http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
