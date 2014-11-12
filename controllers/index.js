/**
 * Created by vivraj on 10/09/14.
 */
var app = require('../app.js')
    , config = require('config');
//var dbconnect = mongoose.connect('mongodb://localhost/test');
var Result = require('../models/crawlerresult.js')(app.get('dbconnect'));


module.exports.controller = function(app) {

    /**
     * a home page route
     */
    app.get('/', function(req, res) {
        Result.find(function(err, results) {
            if (err) return console.error(err);
            console.dir(results);
            res.render('index', {app_name: app.get('name'),
                                    title: 'Crawler Results',
                                    results: results});
        });
    });

    /**
     * About page route
     */
    /*app.get('/login', function(req, res) {
        // any logic goes here
        res.render('users/login')
    });*/

}