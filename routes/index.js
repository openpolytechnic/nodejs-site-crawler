
/*
 * GET home page.
 */

var app = require('../app');
var mongoose = require('mongoose');
var dbconnect = mongoose.connect('mongodb://localhost/test');
var Crawler = require('./models/crawler.js')(dbconnect);
var Result = require('./models/crawlerresult.js')(dbconnect);


exports.index = function(req, res){
    Crawler.find(function(err, crawlers) {
        if (err) return console.error(err);
        console.dir(crawlers);
        res.render('index', { title: 'Express' });
    });

};

app.get('/', exports.index);

require('./user');