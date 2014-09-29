define([
    'jquery',
    'underscore',
    'backbone',
    'views/modal/form',
    'text!templates/form/spill/instant.html',
    'model/spill',
    'views/form/oil/library',
    'views/default/map',
    'geolib',
    'jqueryDatetimepicker',
    'moment'
], function($, _, Backbone, FormModal, FormTemplate, SpillModel, OilLibraryView, SpillMapView, geolib){
    var instantSpillForm = FormModal.extend({
        title: 'Instantaneous Release',
        className: 'modal fade form-modal instantspill-form',

        initialize: function(options, spillModel){
            FormModal.prototype.initialize.call(this, options);
            if (!_.isUndefined(options.model)){
                this.model = options.model;
            } else {
                this.model = spillModel;
            }
        },

        events: function(){
            return _.defaults({
                'click .oilSelect': 'elementSelect',
                'click .locationSelect': 'locationSelect'
            }, FormModal.prototype.events);
        },

        render: function(options){
            if (this.model.get('name') === 'Spill'){
                var spillsArray = webgnome.model.get('spills').models;
                for (var i = 0; i < spillsArray.length; i++){
                    if (spillsArray[i].get('id') === this.model.get('id')){
                        var nameStr = 'Spill #' + (i + 1);
                        this.model.set('name', nameStr);
                        break;
                    }
                }
            }
            this.body = _.template(FormTemplate, {
                name: this.model.get('name'),
                amount: this.model.get('amount'),
                time: moment(this.model.get('release').get('release_time')).format('YYYY/M/D H:mm')
            });
            FormModal.prototype.render.call(this, options);
            this.$('#map').hide();

            this.$('#datetime').datetimepicker({
                format: 'Y/n/j G:i',
            });

            this.$('.slider').slider({
                min: 0,
                max: 5,
                value: 0,
                create: _.bind(function(){
                    this.$('.ui-slider-handle').html('<div class="tooltip top slider-tip"><div class="tooltip-arrow"></div><div class="tooltip-inner">' + this.model.get('amount') + '</div></div>');
                }, this),
                slide: _.bind(function(e, ui){
                    this.updateConstantSlide(ui);
                }, this)
            });
        },

        update: function(){
            var name = this.$('#name').val();
            this.model.set('name', name);
            // if (name === 'Spill'){
            //     var spillsArray = webgnome.model.get('spills').models;
            //     for (var i = 0; i < spillsArray.length; i++){
            //         if (spillsArray[i].get('id') === this.model.get('id')){
            //             var nameStr = 'Spill #' + (i + 1);
            //             this.model.set('name', nameStr);
            //             break;
            //         }
            //     }
            // }
            var amount = parseInt(this.$('#amountreleased').val(), 10);
            var units = this.$('#units').val();
            var release = this.model.get('release');
            var releaseTime = moment(this.$('#datetime').val(), 'YYYY/M/D H:mm').format('YYYY-MM-DDTHH:mm:ss');
            var latitude = this.$('#latitude').val();
            var longitude = this.$('#longitude').val();

            if (latitude.indexOf('°') !== -1){
                latitude = geolib.sexagesimal2decimal(latitude);
            }

            if (longitude.indexOf('°') !== -1){
                longitude = geolib.sexagesimal2decimal(longitude);
            }

            var start_position = [parseFloat(longitude), parseFloat(latitude), 0];

            release.set('release_time', releaseTime);
            release.set('end_release_time', releaseTime);
            release.set('start_position', start_position);
            this.model.set('name', name);
            this.model.set('release', release);
            this.model.set('units', units);
            this.model.set('amount', amount);
            this.updateConstantSlide();

            if(!this.model.isValid()){
                this.error('Error!', this.model.validationError);
            } else {
                this.clearError();
            }
        },

        updateConstantSlide: function(ui){
            var value;
            if(!_.isUndefined(ui)){
                value = ui.value;
            } else {
                value = this.$('.slider').slider('value');
            }
            if(this.model.get('amount')){
                var amount = this.model.get('amount');
                if(value === 0){
                    this.$('.tooltip-inner').text(amount);
                } else {
                    var bottom = amount - value;
                    if (bottom < 0) {
                        bottom = 0;
                    }
                    var top = parseInt(amount, 10) + parseInt(value, 10);
                    this.$('.tooltip-inner').text(bottom + ' - ' + top);
                }
            }
            
        },

        elementSelect: function(){
            FormModal.prototype.hide.call(this);
            var oilLibraryView = new OilLibraryView({}, this.model);
            oilLibraryView.render();
            oilLibraryView.on('save', _.bind(function(){
                this.render();
                this.delegateEvents();
                this.on('save', _.bind(function(){
                    webgnome.model.get('spills').add(this.model);
                    webgnome.model.save(); 
                }, this));   
            }, this));
        },

        locationSelect: function(){
            if (!this.$('#map').is(':visible')){
                this.$('#map').show();
                this.spillMapView = new SpillMapView();
                this.spillMapView.render();
            }
        },

        next: function(){
            $('.xdsoft_datetimepicker:last').remove();
            FormModal.prototype.next.call(this);
        },

        back: function(){
            $('.xdsoft_datetimepicker:last').remove();
            FormModal.prototype.back.call(this);
        },

        close: function(){
            $('.xdsoft_datetimepicker:last').remove();
            FormModal.prototype.close.call(this);
        }

    });

    return instantSpillForm;
});