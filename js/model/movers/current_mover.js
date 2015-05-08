define([
    'underscore',
    'backbone',
    'model/base',
    'model/environment/tide'
], function(_, Backbone, BaseModel, GnomeTide){
    var currentMover = BaseModel.extend({
        urlRoot: '/mover/',
        requesting: false,
        requested: false,

        initialize: function(options){
            BaseModel.prototype.initialize.call(options, this);
            this.on('change', this.resetRequest, this);
        },

        resetRequest: function(){
            this.requested = false;
        },

        getGrid: function(callback){
            var url = webgnome.config.api + this.urlRoot + this.id + '/grid';
            if(!this.requesting && !this.requested || this.requested && this.hasChanged()){
                this.requesting = true;
                $.get(url, null, _.bind(function(geo_json){
                    this.requesting = false;
                    this.requested = true;
                    this.geo_json = geo_json;
                    callback(geo_json);
                }, this));
            } else {
                callback(this.geo_json);
            }
        }
    });

    return currentMover;
});