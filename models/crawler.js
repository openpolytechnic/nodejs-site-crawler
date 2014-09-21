/**
 * Created by vivraj on 6/09/14.
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crawlerSchema = new Schema({
    title: String,
    lastrun: {type: Date, default: Date.now},
    lastresultid: Schema.ObjectId
});
mongoose.model('Crawler', crawlerSchema);

module.exports = function(db) {
    return db.model('Crawler');
}