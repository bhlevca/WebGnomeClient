define([
    'underscore',
    'backbone',
    'model/outputters/file_outputter'
], function(_, Backbone, FileOutputterModel){
    'use strict';
    var kmzOutputter = FileOutputterModel.extend({
        urlRoot: '/outputter/',

        defaults: function() {
            return _.defaults({
                'obj_type': 'gnome.outputters.kmz.KMZOutput',
                'name': 'Model',
                'filename': 'Model.kmz',
                'output_timestep': 900
            }, FileOutputterModel.defaults);
        },

        validate: function(attrs, options) {
            
        },

        toTree: function(){
            return '';
        }
    });

    return kmzOutputter;
});