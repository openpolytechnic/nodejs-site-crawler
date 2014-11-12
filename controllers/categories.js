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
    app.get('/categories/:resultid/:offset?', function(req, res) {
        Result.findById(req.params.resultid, function(error, currentResult){
            var offset = 0;
            if(req.params.offset != undefined){
                offset = parseInt(req.params.offset);
            }
            var filter = {type: 'coursecategory',
                            resultid: req.params.resultid};
            ResultItem.count(filter, function(error, total){
                if (error) {
                    console.error(error);
                }
                if(req.query.export != undefined && req.query.export.trim() != ''){
                    limit = total;
                }
                else{
                    limit = config.resultLimit;
                }

                ResultItem.find(filter)
                    .limit(limit)
                    .skip(offset)
                    .populate('from', 'url')
                    .exec(function(error, items) {
                        if(req.query.export != undefined && req.query.export.trim() != ''){
                            res.locals.sendAsCSV(items, res);
                        }
                        var pagination = {total: total,
                            baseurl: '/categories/'+req.params.resultid,
                            offset: offset,
                            limit: limit,
                            hasPrev: ((offset - limit) >= 0 ),
                            offsetPrev: (offset - limit),
                            hasNext: ((offset + limit) < total ),
                            offsetNext: (offset + limit),
                            show: (total > limit),
                            pages: []};
                        var counter = 0;
                        var index = 1;
                        while((counter) <= total){
                            pagination.pages.push({index: index, offset: counter, isactive: (counter == offset)});
                            counter += limit;
                            index++
                        }
                        if (error) {
                            console.error(error);
                        } else {
                            res.render('categories', {app_name: app.get('name'),
                                title: 'Categories In this Result',
                                resultid: req.params.resultid,
                                currentresult: currentResult,
                                total: total,
                                items: items,
                                pagination: pagination});
                        }
                    });
            });
        });
    });

    app.get('/categories', function(req, res) {
        res.status(404).render('error', {app_name: app.get('name'),
            title: 'Request is unknow',
            messages: ['The request could not be handle, please check the URL.']});
    });
}