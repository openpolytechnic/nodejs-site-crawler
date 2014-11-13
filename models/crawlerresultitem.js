/**
 * Created by vivraj on 6/09/14.
 */

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crawlerresultitemSchema = new Schema({
    resultid: Schema.ObjectId,
    key: {type: String, index: true},
    url: {type: String},
    title: {type: String, default: 'No title'},
    responsecode: {type: Number, default: 0},
    isbroken: {type: Boolean, default: false},
    header: {type: Schema.Types.Mixed, default: {}},
    type: {type: String, default: 'unknown'},
    tags: {type: [String], default: [], index: true},
    checkedate: {type: Date, default: Date.now},
    from: [Schema.ObjectId],
    fromlinktext: [String],
    fromlinkhref: [String],
    to: [Schema.ObjectId],
    nooftries: {type: Number, default: 1},
    brokenurls: [Schema.ObjectId],
    spellmistakes: {type: [String], default: []}
});

crawlerresultitemSchema.index({ key: 1, resultid: 1 });

crawlerresultitemSchema.methods.getMainTag = function(){
    var mainTag = false;
    if(this.tags.length > 0){
        for(k = 0; k < this.tags.length; k++){
            if(this.type == 'coursecategory' && this.tags[k].indexOf('category-') == 0){
                mainTag = this.tags[k];
            }
            else if((this.type == 'course' || this.type == 'incourse' ) && this.tags[k] != 'course-1'
                && this.tags[k].indexOf('course-') == 0){
                mainTag = this.tags[k];
            }
        }
    }
    return mainTag;
};

mongoose.model('CrawlerResultItem', crawlerresultitemSchema);

module.exports = function(db) {
    return db.model('CrawlerResultItem');
}