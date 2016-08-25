define([
    'jquery',
    'underscore',
    'backbone',
    'module',
    'moment',
    'text!templates/form/outputter/base.html',
    'views/modal/form',
    'views/modal/loading',
    'model/no_cleanup_step',
    'jqueryDatetimepicker'
], function($, _, Backbone, module, moment, OutputTemplate, FormModal, LoadingModal, NoCleanUpModel){
    'use strict';
    var outputForm = FormModal.extend({
        initialize: function(options, model){
            if (!_.isUndefined(model)) {
                this.model = model;
            }

            FormModal.prototype.initialize.call(this, options);
        },

        render: function(options) {
            var start_time = moment(this.model.get('output_start_time')).format(webgnome.config.date_format.moment);
            var output_timestep = this.model.get('output_timestep');
            var zeroStep = this.model.get('output_zero_step');
            var lastStep = this.model.get('output_last_step');
            this.body = _.template(OutputTemplate, {
                start_time: start_time,
                time_step: output_timestep,
                output_zero_step: zeroStep,
                output_last_step: lastStep
            });

            FormModal.prototype.render.call(this, options);

            this.$('#start_time').datetimepicker({
                format: webgnome.config.date_format.datetimepicker,
                allowTimes: webgnome.config.date_format.half_hour_times,
                step: webgnome.config.date_format.time_step
            });
        },

        contextualizeTime: function() {

        },

        convertToSeconds: function(duration, unit) {
            switch (unit){
                case "s":
                    break;
                case "min":
                    duration *= 60;
                    break;
                case "hr":
                    duration *= 3600;
                    break;
            }

            return duration;
        },

        update: function() {
            var output_timestep = this.$('#time_step').val();
            var zeroStep = this.$('.zerostep').is(':checked');
            var lastStep = this.$('.laststep').is(':checked');
            var unit = this.$('#units').val();

            output_timestep = this.convertToSeconds(output_timestep, unit);

            this.model.set('output_timestep', output_timestep);
            this.model.set('output_zero_step', zeroStep);
            this.model.set('output_last_step', lastStep);
        },

        toggleOutputters: function(cb, on) {
            webgnome.model.get('outputters').each(_.bind(function(el, i, arr){
                if (el.get('obj_type') === this.model.get('obj_type')) {
                    el.set('on', on);
                } else {
                    el.set('on', !on);
                }
            }, this));
            webgnome.model.save(null, {
                success: cb
            });
        },

        save: function(options) {
            this.toggleOutputters(_.bind(function(){
                var full_run = new NoCleanUpModel({'response_on': true});
                full_run.save(null, {
                    success: _.bind(this.turnOff, this),
                    error: function(model, response, options) {
                        console.log(response);
                    }
                });
                this.hide();
                this.loadingModal = new LoadingModal({title: "Running Model..."});
                this.loadingModal.on('hide', this.close, this.loadingModal);
                this.loadingModal.render();
            }, this), true);
        },

        turnOff: function() {
            this.toggleOutputters(_.bind(function(){
                webgnome.cache.rewind();
                this.loadingModal.hide();
                FormModal.prototype.save.call(this);
            }, this), false);
        },

        close: function() {
            $('.xdsoft_datetimepicker:last').remove();
            FormModal.prototype.close.call(this);
        }

    });

    return outputForm;
});