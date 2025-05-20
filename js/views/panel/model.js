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
    'model/mikehdstatus',
    'model/movers/py_current'
], function(_, $, Backbone, swal, moment,
            ModelPanelTemplate, BasePanel, ModelFormView, MikehdModel,MikehdStatusModel, PyCurrentMover) {
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

            this.retrieveHDStatus();
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

        updateModel: function() {
            var name = this.$('#name').val();
            webgnome.model.set('name', name);

            var lake = this.$('#lake').val();
            webgnome.model.set('lake', lake);

            var start_time = moment(this.$('.datetime').val(),
                                    webgnome.config.date_format.moment);
                                    
            if (start_time.isAfter('1970-01-01')) {
                webgnome.model.set('start_time', start_time.format('YYYY-MM-DDTHH:mm:ss'));
            } else {
                this.edit();
            }
            // use || 0 to handle NaN coming from parseInt
            // no negative values allowed
            var days = Math.abs(parseInt(this.$('#days').val(), 10) || 0);
            var hours = Math.abs(parseInt(this.$('#hours').val(), 10) || 0);
            if (days === 0 & hours === 0) {
                hours = 1;
                this.$('#hours').val(1);
            }
            var duration = (((days * 24) + hours) * 60) * 60;

            webgnome.model.set('duration', duration);

            // no negative values allowed
            var time_step = Math.abs(parseInt(this.$('#time_step').val(), 10) || 1);
            time_step = time_step * 60;
            time_step = Math.min(Math.max(time_step, 60), duration);
            
            if (time_step <= 3600) {
                while (parseInt(3600/time_step,10) !== 3600/time_step) {
                    time_step = time_step - 1;
                }
            } else {
                while (parseInt(time_step/3600,10) !== time_step/3600) {
                    time_step = time_step - 1;
                }
                
            }

            webgnome.model.set('time_step', time_step);
            this.$('#time_step').val(time_step/60);
            
            
            var uncertain = this.$('#uncertain:checked').val();
            webgnome.model.set('uncertain', _.isUndefined(uncertain) ? false : true);

            webgnome.model.save(null, {
                validate: false
            });
        },

        runHD: function(){
            var lake = this.$('#lake').val();
            console.log('run hd');
            console.log(lake);

            var runhd = new MikehdModel();
            runhd.fetch({
                success: _.bind(function(response){
                    if(response.attributes.code === 0){
                        $('#model_status').text('HD Model is Running ...');
                        $('#model_status').show();
                        $('#run_hd').hide();
                        if (typeof(Worker) !== "undefined") {
                            // Yes! Web worker support!
                            if (typeof(webgnome.model.hdtimer) === "undefined") {
                                webgnome.model.hdtimer = new Worker("js/session_timer.js");
                                webgnome.model.hdtimer.onmessage = this.loadHD;
                                console.log('hd timer is started.');
                            }
                        }
                        else {
                          console.warning('Sorry, web workers not supported!');
                        }
                    }
                    else{
                        $('#model_status').text(response.attributes.description);
                        $('#model_status').show();
                    }
                }, this),
                error: _.bind(function(e){
                    console.error('MIKE HD Model Simulation can\'t be started');
                }, this)
            });
        },

        retrieveHDStatus: function(){
            var runhd = new MikehdStatusModel();
            runhd.fetch({
                success: _.bind(function(response){
                    if(response.attributes.status === 1){
                        $('#model_status').text('HD Model is Running ...');
                        $('#model_status').show();
                        $('#run_hd').hide();
                        if (typeof(Worker) !== "undefined") {
                            // Yes! Web worker support!
                            if (typeof(webgnome.model.hdtimer) === "undefined") {
                                webgnome.model.hdtimer = new Worker("js/session_timer.js");
                                webgnome.model.hdtimer.onmessage = this.loadHD;
                                console.log('hd timer is started.');
                            }
                        }
                        else {
                          console.warning('Sorry, web workers not supported!');
                        }
                    }
                }, this),
                error: _.bind(function(e){
                    console.error('HD status can\'t be retrieved.');
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
                        //use the netcdf filename to get the dfsu file name and set it to SpillJsonOutput and WeatheringOutput.
                        //the file name should follow a certain convension - the netcdf file and dfsu file is in the same folder. The dfsu file has name of 2D all.dfsu. 
                        //SpillJsonOutput is used for map display. The concentration is only calculated when the display of the spill is set as volumetric concentration.
                        //WeatheringOutput is used for graphing. This is not the best place but would would allow reuse of the UI components for table and chart display.
                        var depthDfsu = '2D all.dfsu';
                        var filename = json_response.current.data_file;
                        if(filename !== undefined && filename.includes("(") && filename.includes(")")){
                            var appendixNum = filename.split("(")[1].split(")")[0];
                            depthDfsu = '2D all '.concat("(",appendixNum,")",".dfsu")
                        }                            
                        
                        var output = (webgnome.model.get('outputters').findWhere({obj_type: 'gnome.outputters.json.SpillJsonOutput'}));
                        output.set('water_depth_dfsu_file', depthDfsu);

                        var output = (webgnome.model.get('outputters').findWhere({obj_type: 'gnome.outputters.weathering.WeatheringOutput'}));
                        output.set('surface_conc','kde')
                        output.set('water_depth_dfsu_file', depthDfsu);                        
                        
                        //add the mover                        
                        var existingMover = (webgnome.model.get('movers').findWhere({name: 'MIKE HD'}));
                        if(existingMover !== undefined){
                            webgnome.model.get('movers').remove(existingMover)
                        }

                        var existingCurrent = (webgnome.model.get('environment').findWhere({name: 'MIKE HD'}));
                        if(existingCurrent !== undefined){
                            webgnome.model.get('environment').remove(existingCurrent)
                        }
                        
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
                            $('#model_status').text('HD Model is Running ...');
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
                                console.log('hd timer is terminated.');
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
