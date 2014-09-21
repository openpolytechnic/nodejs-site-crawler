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
    app.get('/result/:id/:offset?', function(req, res) {
        Result.findById(req.params.id, function(err, result) {
            if (err) return console.error(err);
            var offset = 0;
            if(req.params.offset != undefined){
                offset = parseInt(req.params.offset);
            }
            var filter = {resultid: req.params.id,
                isbroken: true};
            ResultItem.count(filter, function(error, total){
                if (error) {
                    console.error(error);
                }
                if(req.query.export != undefined && req.query.export.trim() != ''){
                    limit = total;
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
                            baseurl: '/result/'+req.params.id,
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
                            res.render('result', {app_name: app.get('name'),
                                title: result.started,
                                result: result,
                                currentresult: result,
                                resultid: req.params.id,
                                total: total,
                                items: items,
                                pagination: pagination});
                        }
                    });
            });
        });
    });

    app.get('/result', function(req, res) {
        res.status(404).render('error', {app_name: app.get('name'),
            title: 'Request is unknow',
            messages: ['The request could not be handle, please check the URL.']});
    });
}