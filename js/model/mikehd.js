define([
    'underscore',
    'backbone',
    'model/base'
], function(_, Backbone, BaseModel){
    'use strict';
    var mikehd = BaseModel.extend({
        url: '/mikehd',
        initialize: function(options){
            if (options && options.url) {
                this.url = options.url;
            }
            // no op initialization because base model has a model rewind listener
        }
    });
    return mikehd;
});