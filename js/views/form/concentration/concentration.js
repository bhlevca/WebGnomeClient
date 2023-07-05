define([
    'jquery',
    'underscore',
    'backbone',
    'module',
    'nucos',
    'views/modal/form',
    'views/form/concentration/map',
    'text!templates/form/concentration/concentration.html',
    'text!templates/panel/concentration-location-single.html',
    // 'model/concentration',
], function($, _, Backbone, module, nucos,
            FormModal, MapFormView, ConcentrationTemplate, ConcentrationLocationTemplate, ConcentrationModel) {
    'use strict';
    var waterForm = FormModal.extend({
        className: 'modal form-modal model-form water-form',
        title: 'Concentration Time-Series',

        events: function() {
            return _.defaults({
                'click .map-modal': 'initMapModal'
            }, FormModal.prototype.events);
        },

        initialize: function(options, model) {
            this.module = module;
            FormModal.prototype.initialize.call(this, options);
            
            if (!_.isUndefined(model)) {
                this.model = model;
            }
            else {
                this.model = new ConcentrationModel();
            }
        },

        render: function(options) {
            this.body = _.template(ConcentrationTemplate)();

            FormModal.prototype.render.call(this, options);

            this.renderPositionInfo();
        },

        renderPositionInfo: function(e) {            
            var compiled;

            var lat_formats = "64.5011N<br/>(decimal degrees)<br/>64 30.066N<br/>(degrees decimal minutes) <br/>64 30 3.96N<br/>(degrees minutes seconds)";
            var lon_formats = '165.4064W<br/>(decimal degrees)<br/>165 24.384W<br/>(degrees decimal minutes)<br/>165 24 23.04W<br/>(degrees minutes seconds)';

            compiled = _.template(ConcentrationLocationTemplate)({
                    lat: this.model.get('locations')[0][1],
                    lon: this.model.get('locations')[0][0],
                    lat_formats: lat_formats,
                    lon_formats: lon_formats
                });

            this.$('#positionInfo').html('');
            this.$('#positionInfo').html(compiled);

            this.$('.position input[name="lat"]').tooltip({
                trigger: 'focus',
                html: true,
                width: 200,
                placement: 'top',
                viewport: 'body'
            });

            this.$('.position input[name="lng"]').tooltip({
                trigger: 'focus',
                html: true,
                width: 200,
                placement: 'top',
                viewport: 'body'
            });
        },

        initMapModal: function() {
            this.mapModal = new MapFormView({size: 'xl'}, this.model);
            this.mapModal.render();

            this.mapModal.on('hidden', _.bind(function() {
                this.mapModal.close();
            }, this));

            this.mapModal.on('save', this.setManualFields, this);
        },

        setManualFields: function() {
            var startPoint = this.model.get('locations')[0];
            this.renderPositionInfo();
            this.clearError();

            this.$('#start-lat').val(startPoint[1]);
            this.$('#start-lon').val(startPoint[0]);
        }
    });

    return waterForm;
});
