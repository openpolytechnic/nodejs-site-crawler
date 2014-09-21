/**
 * Created by vivraj on 10/09/14.
 */
var app = require('../app.js');
var Result = require('../models/crawlerresult.js')(app.get('dbconnect'));
var ResultItem = require('../models/crawlerresultitem.js')(app.get('dbconnect'));
var limit = 10;

module.exports.controller = function(app) {

    /**
     * a home page route
     */
    app.get('/link/:id?', function(req, res) {

        ResultItem.findById(req.params.id)
            .populate('from')
            .populate('to')
            .populate('brokenurls', 'url')
            .exec(function(err, result) {
                if (err) return console.error(err);
                console.log(result);
                alertclass = 'alert-success';
                if(result.isbroken){
                    alertclass = 'alert-danger';
                }
                var title = '<span class="badge pull-right '+ alertclass +'">'+ result.responsecode +'</span>';
                title += '<a href="'+result.url+'" target="_blank">'+result.url+'</a>';
                Result.findById(result.resultid, function(error, currentResult){

                    res.render('link', {app_name: app.get('name'),
                    title: title,
                    resultid: result.resultid,
                    currentresult: currentResult,
                    item: result});
                });
            })
    });

    app.post('/link', function(req, res) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header("Access-Control-Allow-Headers", "X-Requested-With");
        var url = req.param('url', false);
        console.log(url.trim());
        if(url && url.trim() != ''){
            ResultItem.findOne({url: url.trim()})
                .populate('brokenurls')
                .sort('-checkedate')
                .exec(function(error, item){
                    console.log(item);
                    res.send(item)
                });
        }
        else{
            res.status(404).send('URL missing');
        }
    });

    app.get('/link', function(req, res) {
        res.status(404).render('error', {app_name: app.get('name'),
            title: 'Request is unknow',
            messages: ['The request could not be handle, please check the URL.']});
    });
}