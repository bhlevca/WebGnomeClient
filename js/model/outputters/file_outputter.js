define([
    'underscore',
    'backbone',
    'moment',
    'model/base'
], function(_, Backbone, moment, BaseModel){
    'use strict';
    var fileOutputter = BaseModel.extend({
        urlRoot: '/outputter/',

        defaults: {
            'output_last_step': true,
            'output_zero_step': true,
            'on': false,
            'output_timestep': 900
        },

        initialize: function(options) {
            if (_.has(window, 'webgnome') && _.has(webgnome, 'model') && !_.isNull(webgnome.model)){
                this.setStartTime();
            }
            BaseModel.prototype.initialize.call(this, options);
        },

        setStartTime: function() {
            var start_time = webgnome.model.get('start_time');

            this.set('output_start_time', start_time);
        },

        validate: function(attrs, options) {
            if (attrs.output_timestep <= 0) {
                return 'Output timestep must be greater than zero!';
            }

            if (moment(attrs.output_start_time).isBefore(webgnome.model.get('start_time'))) {
                return 'Output start time cannot be before model start time!';
            }
        },

        toTree: function(){
            return '';
        }
    });

    return fileOutputter;
});