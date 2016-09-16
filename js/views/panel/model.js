define([
    'underscore',
    'jquery',
    'backbone',
    'sweetalert',
    'moment',
    'views/panel/base',
    'views/form/model',
    'text!templates/panel/model.html',
    'jqueryDatetimepicker'
], function(_, $, Backbone, swal, moment, BasePanel, ModelFormView, ModelPanelTemplate){
    'use strict';
    var modelPanel = BasePanel.extend({
        className: 'col-md-6 model object complete panel-view',

        events: _.defaults({
            'blur input': 'updateModel'
        }, BasePanel.prototype.events),

        render: function() {
            var model = webgnome.model;
            var duration = model.formatDuration();
            var compiled = _.template(ModelPanelTemplate, {
                name: model.get('name'),
                start_time: moment(model.get('start_time')).format(webgnome.config.date_format.moment),
                duration: duration
            });
            this.$el.html(compiled);
            this.$('.panel').addClass('complete');
            this.$('.panel-body').show();
            BasePanel.prototype.render.call(this);

            this.$('.datetime').datetimepicker({
                format: webgnome.config.date_format.datetimepicker,
                allowTimes: webgnome.config.date_format.half_hour_times,
                step: webgnome.config.date_format.time_step
            });
            this.$('#datepick').on('click', _.bind(function(){
                this.$('.datetime').datetimepicker('show');
            }, this));

            var delay = {
                show: 500,
                hide: 100
            };

            this.$('.panel-heading .advanced-edit').tooltip({
                title: 'Advanced Edit',
                delay: delay,
                container: 'body'
            });
        },

        edit: function(e) {
            var form = new ModelFormView(null, webgnome.model);

            form.on('wizardclose', _.bind(this.render, this));
            form.on('save', _.bind(function(){
                webgnome.model.save(null, {validate: false});
                form.on('hidden', form.close);
            }, this));
            form.on('wizardclose', form.close);

            form.render();
        },

        updateModel: function(){
            var name = this.$('#name').val();
            webgnome.model.set('name', name);
            var start_time = moment(this.$('.datetime').val(), webgnome.config.date_format.moment).format('YYYY-MM-DDTHH:mm:ss');
            webgnome.model.set('start_time', start_time);

            var days = this.$('#days').val();
            var hours = this.$('#hours').val();
            var duration = (((parseInt(days, 10) * 24) + parseInt(hours, 10)) * 60) * 60;
            webgnome.model.set('duration', duration);

            webgnome.model.save(null, {
                validate: false,
                silent: true
            });
        }
    });

    return modelPanel;
});