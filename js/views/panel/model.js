define([
    'underscore',
    'jquery',
    'backbone',
    'sweetalert',
    'moment',
    'text!templates/panel/model.html',
    'views/panel/base',
    'views/form/model',
    'model/mikehd',
    'model/movers/py_current'
], function(_, $, Backbone, swal, moment,
            ModelPanelTemplate, BasePanel, ModelFormView, MikehdModel, PyCurrentMover) {
    'use strict';
    var modelPanel = BasePanel.extend({
        className: 'col-md-6 model object complete panel-view',

        events: _.defaults({
            'blur input': 'updateModel',
            'click input[type="checkbox"]': 'updateModel',
            'click #run_hd': 'runHD'
        }, BasePanel.prototype.events),

        render: function() {
            var model = webgnome.model;
            var duration = model.formatDuration();

            var compiled = _.template(ModelPanelTemplate)({
                name: model.get('name'),
                uncertain: model.get('uncertain'),
                start_time: moment(model.get('start_time'))
                                   .format(webgnome.config.date_format.moment),
                time_step: model.get('time_step'),
                duration: duration
            });

            this.$el.html(compiled);
            this.$('.panel').addClass('complete');
            this.$('.panel-body').show();

            if ($('.modal').length === 0) {
                $('.xdsoft_datetimepicker:last').remove();
            }

            BasePanel.prototype.render.call(this);


            this.$('.datetime').datetimepicker({
                format: webgnome.config.date_format.datetimepicker,
                allowTimes: webgnome.config.date_format.half_hour_times,
                step: webgnome.config.date_format.time_step,
                minDate:  "1970/01/01",
                yearStart: "1970",
            });

            this.$('#datepick').on('click', _.bind(function() {
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

            this.$('#lake option[value="' + model.get('lake') + '"]')
            .prop('selected', 'selected');
        },

        edit: function(e) {
            var form = new ModelFormView(null, webgnome.model);

            form.on('wizardclose', _.bind(this.render, this));
            form.on('wizardclose', form.close);

            form.on('save', _.bind(function(){
                webgnome.model.save(null, {validate: false});
                form.on('hidden', form.close);
            }, this));

            form.render();
        },

        runHD: function(){
            var lake = this.$('#lake').val();
            console.log('run hd');
            console.log(lake);

            var runhd = new MikehdModel();
            runhd.fetch({
                success: _.bind(function(response){
                    if(response.attributes.code === 0){
                        $('#model_status').text('HD Model is Running ...')
                        $('#model_status').show();
                        $('#run_hd').hide();
                        if (typeof(Worker) !== "undefined") {
                            // Yes! Web worker support!
                            if (typeof(webgnome.model.hdtimer) === "undefined") {
                                webgnome.model.hdtimer = new Worker("js/session_timer.js");
                                webgnome.model.hdtimer.onmessage = this.loadHD
                                console.log('hd timer is started.')
                            }
                        }
                        else {
                          console.warning('Sorry, web workers not supported!');
                        }
                    }
                    else{
                        $('#model_status').text(response.attributes.description)
                        $('#model_status').show();
                    }
                }, this),
                error: _.bind(function(e){
                    console.error('MIKE HD Model Simulation can\'t be started');
                }, this)
            });
        },

        loadHD: function(){
            console.log('loadHD');
            $.post({
                url: webgnome.config.api + '/mikehdnetcdf',
                data: {
                    'session': localStorage.getItem('session')
                },
                crossDomain: true,
                dataType: 'json',
                //contentType: 'application/json',
                xhrFields: {
                    withCredentials: true
                },
            })
            .done(_.bind(function(json_response) {
                if (json_response) {                    
                    var stopTimer = false;
                    if(json_response.obj_type){
                        var mover = new PyCurrentMover(json_response, {parse: true});
                        webgnome.model.get('movers').add(mover);
                        webgnome.model.get('environment').add(mover.get('current'));
                        webgnome.model.save();    

                        $('#model_status').hide();                        
                        stopTimer = true;
                    }
                    if(json_response.error_code && json_response.error_code === -1){                        
                        $('#model_status').show();
                        if(json_response.error_code === 1){
                            $('#model_status').text('HD Model is Running ...')
                        }
                        if(json_response.error_code === -1) {
                            $('#model_status').text('The MIKE HD Model Failed.');    
                            stopTimer = true;                        
                        }                        
                    }

                    if(stopTimer){
                        $('#run_hd').show();
                        if (typeof(Worker) !== "undefined") {
                            // Yes! Web worker support!
                            if (typeof(webgnome.model.hdtimer) !== "undefined") {
                                webgnome.model.hdtimer.terminate();
                                webgnome.model.hdtimer = undefined;
                                console.log('hd timer is terminated.')
                            }
                        }
                        else {
                            console.warning('Sorry, web workers not supported!');
                        }                        
                    }
                }
                else {
                    console.error('loadHD response is empty');
                }
            }, this));
        },
    });

    return modelPanel;
});
