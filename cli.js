
/**
 * Module dependencies.
 */

var express = require('express')
, url = require('url')
, jsdom = require('jsdom')
, request = require('request')
, fs = require("fs")
, util = require('util')
, config = require('config')
, jf = require('jsonfile');

var exec = require('child_process').exec;
var jquery = fs.readFileSync("./public/javascript/jquery.js");
var mongoose = require('mongoose');
var dbconnect = mongoose.connect(config.dburl);
//var dbconnect = mongoose.connect("mongodb://localhost/test7");


var Crawler = require('./models/crawler.js')(dbconnect);
var Result = require('./models/crawlerresult.js')(dbconnect);
var currentResult = false;
var ResultItem = require('./models/crawlerresultitem.js')(dbconnect);

var urlIndexs = [];
var stillNeedToProcess = [];
var skipUrls = config.skipUrls;
var startPath = config.startPath;
var startURL = config.startURL;
var loginURL = config.loginURL;
var loginParams = config.loginParams;
var currentRequest = false;
var noOfCuncurrentCheck = config.noOfCuncurrentCheck;

var canParse = function(nextURL){
    if(nextURL == undefined){
        return false;
    }
    nextURL = nextURL.trim();
    if(nextURL == '' || nextURL[0] == '#' || nextURL[0].indexOf('mailto:') == 0){
        return false;
    }

    //remove anchor
    nextUrlObj = url.parse(nextURL);
    startURLObj = url.parse(startURL);
    if(startURLObj.host != nextUrlObj.host){
        return false;
    }

    if(startPath != '' && nextURL.pathname != undefined && nextURL.pathname.indexOf(startPath) == -1){
        return false;
    }

    for(i = 0; i< skipUrls.length; i++){
        if(nextURL.match(new RegExp(skipUrls[i]))){
            return false;
        }
    }

    nextUrlObj = null;
    startURLObj = null;
    nextURL = null;
    return true;
};

var ideaTime = 0;
var finallyCheck = false;
var reachedMaxCheck = false;
var exitOnNoTranscationAndURL = function(){

    if(ideaTime >= 30 && startedCrawler && finallyCheck){
        if(urlQueues.length == 0){
            currentResult.isrunning = false;
        }
        currentResult.save(function(err, currentResult){
            if(urlQueues.length != 0){
                jsonfile =  'tmp/'+currentResult._id+'.json';
                jf.writeFile(jsonfile,
                    {
                        resultid: currentResult._id,
                        urlqueues: urlQueues,
                        logincookie: LoginCookieString
                    }, function(err) { //json file has four space indenting now
                    clearInterval(existCheckTimmer);
                    clearInterval(processQueueTimmer);
                    exec('node ./cli.js "'+jsonfile+'" >> tmp/currentCli.log', function(error, stdout, stderr) {});
                    setTimeout(function(){
                        console.log("Sub process has been started output could be watched using currentCli.");
                        process.exit();
                    }, 10000);
                })
            }
            else{
                console.log("Done.");
                process.exit();
            }
        });
    }
    else if(ideaTime >= 30 && startedCrawler && !finallyCheck){
        //console.log(util.inspect(process.memoryUsage()));
        console.log("Doing final check on broken links.");
        finallyCheck = true;
        ideaTime = 0;
        saveTranscation++;
        ResultItem.ensureIndexes(function (err) {
            ResultItem.find({resultid: currentResult._id,
            isbroken: true})
            .populate('from', 'brokenurls')
            .exec(function(error, items) {
                saveTranscation--;
                for (var i = 0; i < items.length; i++) {
                    for (var j = 0; j < items[i].from.length; j++) {
                        if(items[i].from[j].brokenurls.indexOf(items[i]._id) == -1){
                            (function(currentUrl, fromid){
                                ResultItem.findById(fromid, function(err, fromItem){
                                    fromItem.brokenurls.push(currentUrl._id);
                                    saveTODB(fromItem);
                                });

                            })(items[i], items[i].from[j]._id);
                        }
                    }
                }
            });
        });
    }

    if((urlQueues.length == 0 || reachedMaxCheck) && saveTranscation == 0 && Object.keys(stillNeedToProcess).length == 0){
        ideaTime ++;
    }
    else{
        ideaTime = 0;
    }
};

var existCheckTimmer = setInterval(exitOnNoTranscationAndURL, 1000);

var urlQueues = [];
var NoOfProccessURl = 0;
var NoWaitingForTrigger = 0;
var fetchProcessing = 0;
var processQueue = function(){
    console.log("Checking the Queue", {
        StillNeedToProcess: Object.keys(stillNeedToProcess).length,
        URLQueueLength: urlQueues.length,
        FetchSubProcess: fetchProcessing,
        UrlIndexLength: Object.keys(urlIndexs).length,
        NoURLProcessed: NoOfProccessURl
    }, process.memoryUsage());
    if(Object.keys(stillNeedToProcess).length <= 0 && startedCrawler
        && NoWaitingForTrigger <= 0 && fetchProcessing <= 0){
        if(NoOfProccessURl >= 100){
            reachedMaxCheck = true;
            return
        }
        var limit = noOfCuncurrentCheck;
        if(urlQueues.length < limit){
            limit = urlQueues.length;
        }
        NoOfProccessURl += limit;
        for(var i = 0; i < limit; i++){
            NoWaitingForTrigger++;
            var urlid = urlQueues.pop();
            ResultItem.findById(urlid,function(err, Item){
                if(err){
                    console.log("Process Queue", err);
                }
                NoWaitingForTrigger--;
                fetchURL(Item);
                Item = null;
            });
            urlid = null;
        }
    }
}

var processQueueTimmer = setInterval(processQueue, 5000);


var saveTranscation = 0;
var saveTODB = function(item, callback){
    saveTranscation++;
    item.save(function (err, item) {
        if(callback != undefined){
            callback(err, item);
        }
        item = null;
        saveTranscation--;
    });

};


var getURLKey = function(url) {
    return url.substring(0, 950);
};

var fetchURL = function(currentUrl){
    console.log('Triggering', 'node ./processurl.js "'+currentUrl.url.split('"').join('\"')+'" "'+LoginCookieString+'"');
    stillNeedToProcess[currentUrl.url] = true;
    exec('node ./processurl.js "'+currentUrl.url.split('"').join('\"')+'" "'+LoginCookieString+'"', function(error, stdout, stderr) {
        stillNeedToProcess[currentUrl.url] = null;
        delete stillNeedToProcess[currentUrl.url];
        if (error !== null || (stderr != null && stderr.trim() != '') || stdout == undefined) {
            console.log('Something went wrong for ', currentUrl.url);
            currentUrl.responsecode = 404;
            currentUrl.isbroken = true;
        }
        else {
            var response = JSON.parse(stdout);
            currentUrl.responsecode = response.statusCode;
            currentUrl.isbroken = (response.statusCode >= 400);
            console.log("Processing done for ", currentUrl.url, response.statusCode);
            if(!response.hasError){
                currentUrl.header = response.headers;
                if(response.extraInfromation.title != undefined){
                    currentUrl.title = response.extraInfromation.title;
                }
                if(response.extraInfromation.tags != undefined){
                    currentUrl.tags = response.extraInfromation.tags;
                }
                if(response.extraInfromation.type != undefined){
                    currentUrl.type = response.extraInfromation.type;
                }
                saveTODB(currentUrl);
                if(!currentUrl.isbroken && canParse(currentUrl.url)){
                    currentUrl.spellmistakes = response.spellMistakes;
                    (function(response, currentUrl){
                        ResultItem.ensureIndexes(function (err) {
                            for(var i = 0; i < response.toURLs.length ; i ++){
                                var newpath = response.toURLs[i].path;
                                fetchProcessing++;
                                (function (newpath, fromtext, fromhref, currentUrl) {
                                    ResultItem.findOne({key: getURLKey(newpath),
                                            resultid: currentResult._id}, function(err,obj){
                                            fetchProcessing--;
                                            if(obj != null || urlIndexs[newpath] != undefined){
                                                if(urlIndexs[newpath] != undefined){
                                                    var objid = urlIndexs[newpath];
                                                }
                                                else {
                                                    var objid = obj._id;
                                                    urlIndexs[obj.url] = obj._id;
                                                }
                                                (function (objid, fromtext, fromhref) {
                                                    saveTranscation++;
                                                    ResultItem.findByIdAndUpdate(objid, {$push: {
                                                            from: currentUrl._id,
                                                            fromlinktext: fromtext,
                                                            fromlinkhref: fromhref}},
                                                        { upsert: true },
                                                        function(err, oldItem){
                                                            if(err) {
                                                                console.log(err);
                                                            }
                                                            saveTranscation--;
                                                            if(currentUrl.to.indexOf(oldItem._id) == -1){
                                                                currentUrl.to.push(oldItem._id);
                                                                if(oldItem.isbroken){
                                                                    currentUrl.brokenurls.push(oldItem._id);
                                                                }
                                                                saveTODB(currentUrl);
                                                            }
                                                        }
                                                    );
                                                }(objid, fromtext, fromhref));
                                            }
                                            else{
                                                var newItem = new ResultItem({
                                                    resultid: currentResult._id,
                                                    key: getURLKey(newpath),
                                                    url: newpath,
                                                    from: [currentUrl._id],
                                                    fromlinktext: fromtext,
                                                    fromlinkhref: fromhref
                                                });
                                                saveTranscation++;
                                                newItem.save(function (err, newItem) {
                                                    if(err){
                                                        console.log(err);
                                                    }
                                                    saveTranscation--;
                                                    currentUrl.to.push(newItem._id);
                                                    saveTODB(currentUrl);
                                                    urlIndexs[newItem.url] = newItem._id;
                                                    urlQueues.push(newItem._id);
                                                });
                                                newItem = null;
                                            }
                                            obj = null;
                                        }
                                    );

                                }(newpath, response.toURLs[i].text, response.toURLs[i].link, currentUrl));
                                newpath = null;
                            }
                        });
                    }(response, currentUrl));
                    response = null;
                }
            }
        }
        if(currentUrl.isbroken) {
            currentResult.noofbrokenlink++;
            if(util.isArray(currentUrl.from) &&  currentUrl.from.length > 0){
                for (var i = 0; i < currentUrl.from.length; i++) {
                    (function (currentUrl, id) {
                        ResultItem.findById(currentUrl.from[i], function(err, fromItem){
                            fromItem.brokenurls.push(currentUrl._id);
                            saveTODB(fromItem);
                            fromItem = null;
                        });
                    })(currentUrl, currentUrl.from[i]);
                }
            }
            saveTODB(currentResult)
        }

        saveTODB(currentUrl);
        currentUrl = null;
    });
};

var LoginCookieString = false;
var startedCrawler = false;
var startCrawler = function(crawl, skipStart){
    var currentJar = request.jar();
    var tmpRequest = request.defaults({jar: currentJar});
    crawl.lastresultid = currentResult._id;
    saveTODB( crawl, function (err, crawl) {
        tmpRequest.post(loginURL,
            { form: loginParams },
            function (error, response, body) {
                LoginCookieString = currentJar.getCookieString(loginURL);
                if (!error && response.statusCode < 400) {
                    startedCrawler = true;
                    if(skipStart){
                        console.log("Waiting for the queue to be processed");
                    }
                    else{
                        currentUrl= new ResultItem({
                            resultid: currentResult._id,
                            key: getURLKey(currentResult.starturl),
                            url: currentResult.starturl
                        });

                        saveTODB(currentUrl, function (err, currentUrl) {
                            //urlIndexs[currentUrl.url] = currentUrl._id;
                            currentRequest = request;
                            fetchURL(currentUrl);
                        });
                    }
                }
            }
        );
    });
};


var findResult = function(crawl){

    if(process.argv[2] != undefined ){
        jf.readFile(process.argv[2], function(err, obj) {
            if(obj.resultid == undefined || obj.urlqueues == undefined){
                console.error("Not a valid file");
                process.exit();
            }
            //LoginCookieString = obj.logincookie;
            console.log("Running the Crawler from the file : "+process.argv[2]);
            /*var urlqueuesids = [];
            for(var i = 0; i < obj.urlqueues.length ; i++){
                urlqueuesids.push(obj.urlqueues[i]._id);
            }*/
            urlQueues = obj.urlqueues;
            Result.findById(obj.resultid, function (err, prevResult){
                if (err){
                    return console.error(err);
                }
                //ResultItem.find({ '_id': { $in: urlqueuesids}}, function(err, items){
                    //urlQueues = items;
                    currentResult = prevResult;
                    startedCrawler = true;
                    startCrawler(crawl, true);
                    crawl = null;
                    //console.log("Waiting for the queue to be processed");
                //});
            });
        });
    }
    else{
        currentResult= new Result({
            starturl: startURL,
            isrunning: true
        });
        saveTODB(currentResult, function (err, currentResult) {
            if (err){
                return console.error(err);
            }
            startCrawler(crawl, false);
        });
    }
};


Crawler.find(function(err, crawlers){
    if(err){
        console.log(err);
        return false;
    }
    if(crawlers.length > 0){
        currentCrawler = crawlers[0];
        findResult(currentCrawler);
    }
    else {
        currentCrawler = new Crawler({
            title: 'Moodle crawler'
        });
        saveTODB(currentCrawler, function (err, currentCrawler) {
            if (err){
                return console.error(err);
            }
            findResult(currentCrawler);
        });
    }

});
