/**
 * Created by vivraj on 6/09/14.
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crawlerresultSchema = new Schema({
    starturl: String,
    started: {type: Date, default: Date.now},
    ended: Date,
    isrunning: {type: Boolean, default: false},
    noofbrokenlink: {type: Number, default: 0}
});

mongoose.model('CrawlerResult', crawlerresultSchema);

module.exports = function(db) {
    return db.model('CrawlerResult');
}