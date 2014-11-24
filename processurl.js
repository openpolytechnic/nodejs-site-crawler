
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

if(process.argv.length < 4 ){
    console.error("Need to pass the url and the cookie string");
    process.exit();
}

var CurrentUrl = process.argv[2];
var cookieString = process.argv[3];
var toURLs = [];
var extraInfromation = {};
var headers = {};
var statuscode = 0;
var haserror = false;
var isbroken = false;
var spellmistakes = [];
var skipUrls = config.skipUrls;

var donePrintOutput= function(){
    console.log(JSON.stringify({
        statusCode: statuscode,
        hasError: haserror,
        headers: headers,
        toURLs: toURLs,
        extraInfromation: extraInfromation,
        spellMistakes: spellmistakes
    }));
    process.exit();
};

var validateURL = function(currentURL, nextURL){
    if(nextURL == undefined || currentURL == undefined){
        return false;
    }
    nextURL = nextURL.trim();
    currentURL = currentURL.trim();
    if(nextURL == '' || nextURL[0] == '#' || nextURL.indexOf('mailto:') == 0 ){
        return false;
    }
    nextURL = url.resolve(currentURL, nextURL);

    if( nextURL.indexOf('http:') != 0 && nextURL.indexOf('https:') != 0 ){
        return false;
    }

    //remove anchor
    nextUrlObj = url.parse(nextURL);
    nextUrlObj.hash = '';
    currentURLObj = url.parse(currentURL);
    currentURLObj.hash = '';

    nextURL = url.format(nextUrlObj);
    if(nextURL == url.format(currentURLObj)){
        return false;
    }

    for(var i = 0; i< skipUrls.length; i++){
        if(nextURL.match(new RegExp(skipUrls[i]))){
            return false;
        }
    }

    nextUrlObj = null;
    currentURLObj = null;
    return nextURL;
};

var checkSameDomain = function(checkurl){
    if(checkurl == undefined || config.startURL == undefined){
        return false;
    }
    sourceUrlObj = url.parse(config.startURL);
    currentURLObj = url.parse(checkurl);
    return (sourceUrlObj.host == currentURLObj.host);
}

var getExtraInformation = function(jQuery){
    if(jQuery('title').length > 0){
        extraInfromation.title = jQuery('title').text().trim();
    }
    if(jQuery('body').attr('class') != undefined && jQuery('body').attr('class').trim() != ''){
        var classes = jQuery('body').attr('class').trim().split(/\s+/);
        extraInfromation.tags = [];
        for(i = 0; i < classes.length; i++){
            if(classes[i].match(/\w+-\d+/)){
                extraInfromation.tags.push(classes[i]);
                classinfo = classes[i].split('-')
            }
            if(classes[i].match(/^pagelayout-/)){
                extraInfromation.type = classes[i].replace('pagelayout-', '');
                extraInfromation.tags.push(extraInfromation.type);
            }
        }
        classes = null;
    }
};


var spellcheck = function(content, callback){
    content = content.replace(/"/g, '\"');
    content = content.replace(/\n/g, ' ');
    setTimeout(function(){
        if(callback != undefined && callback){
            callback();
        }
    }, 30000);//Wait for 20 seconds before timming out
    exec('echo "'+content+'"|aspell list -a >&1', function(error, stdout, stderr) {
        if (error !== null || (stderr != null && stderr.trim() != '')) {

        }
        else if(stdout.trim() != ''){
            spellmistakes = stdout.trim().split("\n").filter(function(value, index, self){
                return self.indexOf(value) === index;
            });
        }
        if(callback != undefined && callback){
            callback();
        }
    });
};

var parseContent = function(body){

    jsdom.env({
        html: body,
        src: [jquery],
        done: function (err, window) {
            //console.log("Number of links - ",window.jQuery('a').length);
            getExtraInformation(window.jQuery);
            var toUrlsCombined = [];
            window.jQuery('a').each(function(index, item){
                if(newpath = validateURL(CurrentUrl, window.jQuery(item).attr('href'))){
                    if(toUrlsCombined[newpath] != undefined){
                        toUrlsCombined[newpath].text.push(window.jQuery(item).text().trim());
                        toUrlsCombined[newpath].link.push(window.jQuery(item).attr('href'));
                    }
                    else {
                        toUrlsCombined[newpath] = {text: [window.jQuery(item).text().trim()],
                                                    link: [window.jQuery(item).attr('href')],
                                                    path: newpath};
                    }
                    newpath = null;
                }
            });
            //console.log("Number of other source - ",window.jQuery('*[src]').length);
            window.jQuery('*[src]').each(function(index, item){
                if(newpath = validateURL(CurrentUrl, window.jQuery(item).attr('src'))){
                    var pathelements = window.jQuery(item).attr('src').trim().split('/');
                    if(pathelements.length > 1){
                        var objectname = pathelements[pathelements.length - 1];
                    }
                    else {
                        var objectname = window.jQuery(item).attr('src').trim();
                    }
                    if(window.jQuery(item).attr('title') != undefined && window.jQuery(item).attr('title').trim() != ''){
                        objectname = window.jQuery(item).attr('title').trim();
                    }
                    else if(window.jQuery(item).attr('alt') != undefined && window.jQuery(item).attr('alt').trim() != ''){
                        objectname = window.jQuery(item).attr('alt').trim();
                    }
                    else if(window.jQuery(item).text().trim() != ''){
                        objectname = window.jQuery(item).text().trim().substring(0,24)
                    }

                    if(toUrlsCombined[newpath] != undefined){
                        toUrlsCombined[newpath].text.push(objectname);
                        toUrlsCombined[newpath].link.push(window.jQuery(item).attr('src'));
                    }
                    else {
                        toUrlsCombined[newpath] = {text: [objectname],
                            link: [window.jQuery(item).attr('src')],
                            path: newpath};
                    }

                    newpath = objectname = null;
                }
            });

            for(var key in toUrlsCombined){
                toURLs.push(toUrlsCombined[key]);
            }
            //console.log("Doing spell check");
            spellcheck(window.jQuery('body').text(), function(){
                donePrintOutput();
            });
            window.close();
        }
    });
    body = null;
};

var currentJar = request.jar();
currentJar.setCookie(cookieString, CurrentUrl);
var tmpRequest = request.defaults({jar: currentJar});
tmpRequest(CurrentUrl, function (error, response, body) {
    if(error){
        haserror = true;
        statuscode = 404;
        donePrintOutput();
    }
    statuscode = response.statusCode;
    isbroken = (response.statusCode >= 400);
    headers = response.headers;
    if(headers['content-type'].indexOf('text/html') != -1 && body.trim() != '' && checkSameDomain(CurrentUrl)){
        parseContent(body);
    }
    else {
        donePrintOutput();
    }
});

