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
	'ol',
	'moment',
	'jqueryDatetimepicker'
], function($, _, Backbone, FormModal, FormTemplate, SpillModel, OilLibraryView, SpillMapView, geolib, ol, moment){
	var baseSpillForm = FormModal.extend({

		mapShown: false,

		events: function(){
			return _.defaults({
				'click .oilSelect': 'elementSelect',
				'click .locationSelect': 'locationSelect',
				'click #spill-form-map': 'update',
				'blur .geo-info': 'locationSelect'
			}, FormModal.prototype.events);
		},

		initialize: function(options, spillModel){
			FormModal.prototype.initialize.call(this, options);
			if (!_.isUndefined(options.model)){
				this.model = options.model;
			} else {
				this.model = spillModel;
			}
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

			FormModal.prototype.render.call(this, options);

			var geoCoords = this.model.get('release').get('start_position');

			if (this.model.get('release').get('start_position')[0] === 0 && this.model.get('release').get('start_position')[1] === 0) {
				this.$('.map').hide();
			} else {
				this.locationSelect(null, [geoCoords[0], geoCoords[1]]);
			}

			this.$('#datetime').datetimepicker({
				format: 'Y/n/j G:i',
			});

		},

		update: function(){

			if(!this.model.isValid()){
				this.error('Error!', this.model.validationError);
			} else {
				this.clearError();
			}
		},

		rerenderForm: function(){
			this.render();
			this.delegateEvents();
			this.on('save', _.bind(function(){
				webgnome.model.get('spills').add(this.model);
				webgnome.model.save();
			}, this));
		},

		elementSelect: function(){
			//FormModal.prototype.hide.call(this);
            this.hide();
			var oilLibraryView = new OilLibraryView();
			oilLibraryView.render();
			oilLibraryView.on('save', _.bind(this.show, this));
			oilLibraryView.on('hidden', _.bind(this.show, this));
		},

		locationSelect: function(e, pastCoords){
			if (!this.mapShown){
                this.$('.map').show();
                this.source = new ol.source.Vector();
                this.layer = new ol.layer.Vector({
                    source: this.source,
                    style: new ol.style.Style({
                        image: new ol.style.Icon({
                            anchor: [0.5, 1.0],
                            src: '/img/map-pin.png',
                            size: [32, 40]
                        })
                    })
                });

                var startPosition = this.model.get('release').get('start_position');

                if (_.isArray(startPosition)){
                    var feature = new ol.Feature(new ol.geom.Point(_.initial(startPosition)));
                    var coords = new ol.proj.transform(startPosition, 'EPSG:4326', 'EPSG:3857');
                    this.source.addFeature(feature);
                }
                this.spillMapView = new SpillMapView({
                    id: 'spill-form-map',
                    zoom: 2,
                    center: [-128.6, 42.7],
                    layers: [
                        new ol.layer.Tile({
                            source: new ol.source.MapQuest({layer: 'osm'})
                        }),
                        this.layer
                    ]
                });
				this.spillMapView.render();
                window.map = this.spillMapView.map;
				this.spillMapView.map.on('click', _.bind(function(e){
					this.source.forEachFeature(function(feature){
						this.source.removeFeature(feature);
					}, this);
					var feature = new ol.Feature(new ol.geom.Point(e.coordinate));
					var coords = new ol.proj.transform(e.coordinate, 'EPSG:3857', 'EPSG:4326');
					this.spillCoords = {lat: coords[1], lon: coords[0]};
				}, this));
			}
			this.mapShown = true;
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
            if (!_.isUndefined(this.spillMapView)){
                this.spillMapView.close();
            }
			FormModal.prototype.close.call(this);
		}

	});

	return baseSpillForm;
});