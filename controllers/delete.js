/**
 * Created by vivraj on 10/09/14.
 */
var app = require('../app.js')
    , config = require('config');

var Result = require('../models/crawlerresult.js')(app.get('dbconnect'));
var ResultItem = require('../models/crawlerresultitem.js')(app.get('dbconnect'));
var limit = config.resultLimit;

module.exports.controller = function(app) {

    /**
     * a home page route
     */
    app.get('/delete/:id?', function(req, res) {
        console.log("Still not implemented.");
    });

    app.get('/delete', function(req, res) {
        res.status(404).render('error', {app_name: app.get('name'),
            title: 'Request is unknown',
            messages: ['The request could not be handle, please check the URL.']});
    });
}