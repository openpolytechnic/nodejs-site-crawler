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
        if(app.get('isadmin')){
            ResultItem.remove({resultid: req.params.id}, function(err){
                if (err) {
                    res.status(404).render('error', {app_name: app.get('name'),
                        title: 'Delete failed',
                        messages: ['The result items could not be deleted.']});
                }
                Result.remove({_id: req.params.id}, function(err){
                    if (!err) {
                        res.status(404).render('error', {app_name: app.get('name'),
                            title: 'Delete failed',
                            messages: ['The result could not be deleted.']});
                    }
                }).exec();
            }).exec();
            res.redirect('/');
        }
        res.status(403).render('error', {app_name: app.get('name'),
            title: 'Access forbidden',
            messages: ['You do not have access to delete.']});

    });

    app.get('/delete', function(req, res) {
        res.status(404).render('error', {app_name: app.get('name'),
            title: 'Request is unknown',
            messages: ['The request could not be handle, please check the URL.']});
    });
}