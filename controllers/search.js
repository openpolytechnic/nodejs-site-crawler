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
    app.get('/search/:resultid/:offset?', function(req, res) {
        Result.findById(req.params.resultid, function(error, currentResult){
            var offset = 0;
            if(req.params.offset != undefined){
                offset = parseInt(req.params.offset);
            }
            var filter = {resultid: req.params.resultid};
            var onlybroken = false;
            if(req.query.onlybroken != undefined && req.query.onlybroken.trim() != ''){
                filter.brokenurls = { '$not': { '$size': 0 } };
                onlybroken = true;
            }
            else{
                //filter.brokenurls = null;
                onlybroken = false;
            }
            if(req.query.search != undefined && req.query.search.trim() != ''){
                var query = req.query.search.trim();
                var queryregex = new RegExp(query, "i");
                var querycnd = [{title: queryregex},
                                {tags: queryregex},
                                {type: queryregex},
                                {url: queryregex},
                                {id: queryregex}];

                ResultItem.count(filter)
                    .or(querycnd)
                    .exec(function(error, total){
                        if (error) {
                            console.error(error);
                        }
                        if(req.query.export != undefined && req.query.export.trim() != ''){
                            limit = total;
                            offset = 0;
                        }
                        else{
                            limit = config.resultLimit;
                        }
                        ResultItem.find(filter)
                            .or(querycnd)
                            .limit(limit)
                            .skip(offset)
                            .populate('from', 'url')
                            .populate('brokenurls', 'url')
                            .exec(function(error, items) {
                                if(req.query.export != undefined && req.query.export.trim() != ''){
                                    res.locals.sendAsCSV(items, res);
                                }
                                var suffixurl = '?search='+req.query.search.trim();
                                if(onlybroken){
                                    suffixurl += '&onlybroken='+1;
                                }
                                var pagination = {total: total,
                                    baseurl: '/search/'+req.params.resultid,
                                    suffixurl: suffixurl,
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
                                    res.render('search', {app_name: app.get('name'),
                                        title: 'Search For : <pre>'+query+'</pre>',
                                        query: query,
                                        hasresults: true,
                                        onlybroken: onlybroken,
                                        resultid: req.params.resultid,
                                        currentresult: currentResult,
                                        total: total,
                                        items: items,
                                        pagination: pagination});
                                }
                            });
                });
            }
            else {
                res.render('search', {app_name: app.get('name'),
                    title: 'Search ',
                    query: '',
                    onlybroken: true,
                    hasresults: false,
                    resultid: req.params.resultid,
                    currentresult: currentResult,
                    total: 0,
                    items: [],
                    pagination: {show: false,
                                baseurl: '/search/'+req.params.resultid,
                                suffixurl: ''
                                }});
            }
        });

    });

    app.get('/search', function(req, res) {
        res.status(404).render('error', {app_name: app.get('name'),
            title: 'Request is unknow',
            messages: ['The request could not be handle, please check the URL.']});
    });
}
