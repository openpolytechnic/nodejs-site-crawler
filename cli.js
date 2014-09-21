
/**
 * Module dependencies.
 */

var express = require('express')
, url = require('url')
, jsdom = require('jsdom')
, request = require('request')
, fs = require("fs")
, util = require('util')
, config = require('config');

var exec = require('child_process').exec;
var jquery = fs.readFileSync("./public/javascript/jquery.js");
var mongoose = require('mongoose');
var dbconnect = mongoose.connect(config.dburl);


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
        if(nextURL.match(skipUrls[i])){
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
var exitOnNoTranscationAndURL = function(){

    if(ideaTime >= 30 && startedCrawler && finallyCheck){
        currentResult.isrunning = false;
        currentResult.save(function(err, currentResult){
            console.log("Done.");
            process.exit();
        });
    }
    else if(ideaTime >= 30 && startedCrawler && !finallyCheck){
        console.log("Doing final check on broken links.");
        finallyCheck = true;
        ideaTime = 0;
        saveTranscation++;
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
    }

    if(urlQueues.length == 0 && saveTranscation == 0 && Object.keys(stillNeedToProcess).length == 0){
        ideaTime ++;
    }
    else{
        ideaTime = 0;
    }
};

setInterval(exitOnNoTranscationAndURL, 1000);

var urlQueues = [];
var processQueue = function(){
    if(Object.keys(stillNeedToProcess).length <= 0 && startedCrawler){
        var limit = noOfCuncurrentCheck;
        if(urlQueues.length < limit){
            limit = urlQueues.length;
        }
        for(i = 0; i < limit; i++){
            fetchURL(urlQueues.pop());
        }
    }
}

setInterval(processQueue, 5000);


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


var fetchURL = function(currentUrl){
    console.log('Triggering', 'node ./processurl.js "'+currentUrl.url+'" "'+LoginCookieString+'"');
    stillNeedToProcess[currentUrl.url] = true;
    exec('node ./processurl.js "'+currentUrl.url+'" "'+LoginCookieString+'"', function(error, stdout, stderr) {
        stillNeedToProcess[currentUrl.url] = null;
        delete stillNeedToProcess[currentUrl.url];
        if (error !== null || (stderr != null && stderr.trim() != '')) {
            console.log('Something went wrong');
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
                    for(var i = 0; i < response.toURLs.length ; i ++){
                        var newpath = response.toURLs[i].path;
                        if(urlIndexs[newpath] != undefined){
                            (function (newpath, fromtext, fromhref) {
                                saveTranscation++;
                                ResultItem.findByIdAndUpdate(urlIndexs[newpath], {$push: {
                                    from: currentUrl._id,
                                    fromlinktext: fromtext,
                                    fromlinkhref: fromhref}},
                                    { upsert: true },
                                    function(err, oldItem){
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
                            }(newpath, response.toURLs[i].text, response.toURLs[i].link));
                        }
                        else {
                            var newItem = new ResultItem({
                                resultid: currentResult._id,
                                url: newpath,
                                from: [currentUrl._id],
                                fromlinktext: [response.toURLs[i].text],
                                fromlinkhref: [response.toURLs[i].link]
                            });
                            saveTranscation++;
                            newItem.save(function (err, newItem) {
                                saveTranscation--;
                                currentUrl.to.push(newItem._id);
                                saveTODB(currentUrl);
                                urlIndexs[newItem.url] = newItem._id;
                                urlQueues.push(newItem);
                            });
                            newItem = null;
                        }
                        newpath = null;

                    }
                }
            }
        }
        if(currentUrl.isbroken) {
            currentResult.noofbrokenlink++;
            if(util.isArray(currentUrl.from) &&  currentUrl.from.length > 0){
                for (var i = 0; i < currentUrl.from.length; i++) {
                    ResultItem.findById(currentUrl.from[i], function(err, fromItem){
                        fromItem.brokenurls.push(currentUrl._id);
                        saveTODB(fromItem);
                    });
                }
            }
            saveTODB(currentResult)
        }

        saveTODB(currentUrl);
    });
};

var LoginCookieString = false;
var startedCrawler = false;
var startCrawler = function(crawl){
    currentResult= new Result({
        starturl: startURL,
        isrunning: true
    });
    var currentJar = request.jar();
    var tmpRequest = request.defaults({jar: currentJar});
    saveTODB(currentResult, function (err, currentResult) {
        crawl.lastresultid = currentResult._id;
        saveTODB( crawl, function (err, crawl) {
            tmpRequest.post(loginURL,
                { form: loginParams },
                function (error, response, body) {
                    LoginCookieString = currentJar.getCookieString(loginURL);
                    if (!error && response.statusCode < 400) {
                        currentUrl= new ResultItem({
                            resultid: currentResult._id,
                            url: currentResult.starturl
                        });
                        startedCrawler = true;

                        saveTODB(currentUrl, function (err, currentUrl) {
                            urlIndexs[currentUrl.url] = currentUrl._id;
                            currentRequest = request;
                            fetchURL(currentUrl);
                        });
                    }
                }
            );
        });
    });
};


Crawler.find(function(err, crawlers){
    if(err){
        console.log(err);
        return false;
    }
    if(crawlers.length > 0){
        currentCrawler = crawlers[0];
        console.log("Last Resultid : ", currentCrawler.lastresultid);
        startCrawler(currentCrawler);
    }
    else {
        currentCrawler = new Crawler({
            title: 'Moodle crawler'
        });
        saveTODB(currentCrawler, function (err, currentCrawler) {
            if (err){
                return console.error(err);
            }
            startCrawler(currentCrawler);
        });
    }

});
