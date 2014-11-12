/**
 * Created by vivraj on 10/09/14.
 */
var app = require('../app.js')
    , config = require('config');
//var dbconnect = mongoose.connect('mongodb://localhost/test');
var Result = require('../models/crawlerresult.js')(app.get('dbconnect'));


module.exports.controller = function(app) {

    app.all('*', function(req, res, next){
        var allowexport = ['tag', 'search', 'course', 'courses', 'categories', 'result'];
        var pathtype = req.path.split('/')[1];
        res.locals.canexport = false;
        if(allowexport.indexOf(pathtype) != -1){
            res.locals.canexport = true;
            if(Object.keys(req.query).length > 0){
                res.locals.exportpath = req.originalUrl + '&export=csv'
            }
            else {
                res.locals.exportpath = req.originalUrl + '?export=csv'
            }
        }
        res.locals.sendAsCSV = function(items, res){
            var csvlist = [['URL', 'LINKED FROM', 'RESPONSE CODE', 'BROKEN', 'BROKENLINKS']];
            for(var i =0; i < items.length; i ++){
                var csvItem = [];
                csvItem.push(items[i].url);
                var froms = []
                for(var j =0; j < items[i].from.length; j ++){
                    froms.push(items[i].from[j].url);
                }
                var brokenurls = []
                for(var j =0; j < items[i].brokenurls.length; j ++){
                    brokenurls.push(items[i].brokenurls[j].url);
                }

                csvItem.push(froms.join("\n"));
                csvItem.push(items[i].responsecode);
                csvItem.push(items[i].isbroken);
                csvItem.push(brokenurls.join("\n"));
                csvlist.push(csvItem);
                froms = null;
                csvItem = null;
                brokenurls = null;
            }
            res.setHeader('Content-disposition', 'attachment; filename=export.csv');
            res.csv(csvlist);
        };
        next();
    });

}