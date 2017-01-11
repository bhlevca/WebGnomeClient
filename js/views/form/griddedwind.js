define([
    'underscore',
    'jquery',
    'views/modal/form',
    'model/movers/grid_wind',
    'text!templates/form/griddedwind.html',
    'dropzone',
    'text!templates/default/dropzone.html'
], function(_, $, FormModal, GridWindMover, GriddedWindTemplate, Dropzone, DropzoneTemplate){
    var griddedWindForm = FormModal.extend({
        className: 'modal form-modal griddedwind-form',
        title: 'Load Wind Mover',

        events: function(){
            return _.defaults({
                'click .gridwind': 'gridwind',
            }, FormModal.prototype.events);
        },

        initialize: function(options){
            FormModal.prototype.initialize.call(this, options);
            this.body = _.template(GriddedWindTemplate);
            this.buttons = null;
        },

        render: function(){
            FormModal.prototype.render.call(this);
            this.$('.step2').hide();
        },

        nextStep: function(){
            this.$('.step1').hide();
            this.$('.step2').show();
            this.setupUpload();
        },

        setupUpload: function(){
            this.dropzone = new Dropzone('.dropzone', {
                url: webgnome.config.api + '/mover/upload',
                previewTemplate: _.template(DropzoneTemplate)(),
                paramName: 'new_mover',
                maxFiles: 1,
                //acceptedFiles: '.nc, .cur',
                dictDefaultMessage: 'Drop file here to upload (or click to navigate)' //<code>.nc, .cur, etc</code> 
            });
            this.dropzone.on('error', _.bind(this.reset, this));
            this.dropzone.on('uploadprogress', _.bind(this.progress, this));
            this.dropzone.on('success', _.bind(this.loaded, this));
            this.dropzone.on('sending', _.bind(this.sending, this));
        },

        gridwind: function(){
            this.model = new GridWindMover();
            this.nextStep();
        },

        sending: function(e, xhr, formData){
            formData.append('session', localStorage.getItem('session'));
        },

        reset: function(file){
            setTimeout(_.bind(function(){
                this.$('.dropzone').removeClass('dz-started');
                this.dropzone.removeFile(file);
            }, this), 10000);
        },

        progress: function(e, percent){
            if(percent === 100){
                this.$('.dz-preview').addClass('dz-uploaded');
                this.$('.dz-loading').fadeIn();
            }
        },

        loaded: function(e, response){
            var json_response = JSON.parse(response);
            this.model.set('filename', json_response.filename);
            this.model.set('name', json_response.filename.split('/').pop());
            this.model.save(null, {
                success: _.bind(function(){
                    this.trigger('save', this.model);
                    this.hide();
                }, this)
            });
        },

        close: function(){
            if(this.dropzone){
                this.dropzone.disable();
                $('input.dz-hidden-input').remove();
            }
            FormModal.prototype.close.call(this);
        }
    });
    return griddedWindForm;
});