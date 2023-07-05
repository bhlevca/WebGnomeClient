define([
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'module',
    'd3',
    'views/modal/form',
    'text!templates/form/concentration/map.html',
    'views/cesium/cesium'
], function($, _, Backbone, Cesium, module, d3, FormModal, MapViewTemplate, CesiumView) {
    'use strict';
    var mapSpillView = FormModal.extend({

        title: 'Concentration Time-Series Location',
        className: 'modal form-modal map-modal-form',
        size: 'lg',

        events: function() {
            return _.defaults({
                'click input': 'switchCoordFormat',
            }, FormModal.prototype.events);
        },

        initialize: function(options, concentration) {
            this.module = module;
            FormModal.prototype.initialize.call(this, options);

            if (!_.isUndefined(options.model)) {
                this.model = options.model;
            } else {
                this.model = concentration;
            }

            this.placeMode = 'point';
            this.heldPin = null;
            this.invalidPinLocation = false;
            this.origModel = this.model;
            this.mouseTool = null;
        },

        render: function(options) {
            var cid = this.model.cid;
            this.body = _.template(MapViewTemplate)({
                cid: cid
            });
            FormModal.prototype.render.call(this, options);
            this.mapView = new CesiumView({
                baseLayerPicker: true
            });
            this.$('#spill-form-map-' + this.model.cid).append(this.mapView.$el);
            this.mapView.render();

            this.mouseTool = this.mapView.toolbox.defaultTool;
            if (this.mouseTool.toolName !== 'baseMapTool') {
                console.error('incorrect mouse tool enabled. this form will not work!');
            }

            //add map polygons
            var map = webgnome.model.get('map');
            map.getGeoJSON().then(_.bind(function(data){
                map.processMap(data, null, this.mapView.viewer.scene.primitives);
            }, this));
            //add Map Bounds
            var bnds = map.genBnd(this.mapView.viewer);
            bnds.show = true;
            //add Spillable area
            var sa = map.genSA(this.mapView.viewer);
            sa.show = true;
            
            this.mapView.resetCamera(map);

            //add concentration visualization, and allowing it to be movable
            var ds = this.model.generateVis({movable: true});
            this.mapView.viewer.dataSources.add(ds);
            this._spillPins = ds.entities.concentrationPoints;

            //add other release visualizations
            //use it for multiple location selection
            // var spills = webgnome.model.get('spills').models;
            // for (var i = 0; i < spills.length; i++){
            //     if (spills[i].get('release') !== this.model){
            //         var billboardOpts = {billboard: {
            //             image: '/img/spill-pin.png',
            //             verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            //             horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
            //             color: Cesium.Color.YELLOW
            //             }
            //         };
            //         this.mapView.viewer.dataSources.add(spills[i].get('release').generateVis(billboardOpts));
            //     }
            // }

            //listen to CesiumView to handle entity movement events.
            this.listenTo(this.mapView, 'pickupEnt', _.bind(this.pickupPinHandler, this));
            this.listenTo(this.mapView, 'droppedEnt', _.bind(this.droppedPinHandler, this));
            this.listenTo(this.mapView, 'resetEntPickup', _.bind(this.resetPinPickupHandler, this));

            var positions = this.model.get('locations');
            var samePositions = _.every(positions, function(pos) {return _.isEqual(pos, positions[0]);});
            if (!samePositions) {
                this.enableLineMode();
                _.each(this._spillPins, function(sp){sp.show = true;});
                if (_.isEqual(positions[0], [0,0,0])) {
                    this.mouseTool.pickupEnt(null, this._spillPins[0]);
                }
            } else {
                this.enablePointMode();
            }

            //this.renderSpillFeature();
            //this.toggleSpill();
        },

        pickupPinHandler: function (ent) {
            if (this.placeMode === 'point' && !this.$('.fixed').hasClass('on')) {
                this.$('.fixed').addClass('on');
                this.$('.fixed').tooltip('show');
            } else if (this.placeMode === 'line' && !this.$('.moving').hasClass('on')){
                this.$('.moving').addClass('on');
                this.$('.moving').tooltip('show');
            }
        },

        droppedPinHandler: function(ent, coords) {
            //this context should always be the Form object
            var prev = this.model.get(ent.model_attr);
            var map = webgnome.model.get('map');
            var nswe = map.getBoundingRectangle_nswe();
            if (nswe[3] > 180 && coords[0]<0 && nswe[2] !== -360) {
                coords[0] = coords[0] + 360;
            }            
            var SATest = this.model.testVsSpillableArea(coords, map);
            var MBTest = this.model.testVsMapBounds(coords, map);
            if (!MBTest) {
                //spill outside map bounds
                this.error('Start or end position outside map bounds. Some or all particles may disapear immediately on release');
                this.model.set(ent.model_attr, [coords]);
            } else {
                if (SATest) {
                    //all is good
                    this.model.set(ent.model_attr, [coords]);
                    this.clearError();
                    return;
                } else {
                    var spill_on_land = false; // stub for future if we do spill land detection in client
                    if (spill_on_land) {
                        this.error('Placement error! Start or End position are on land');
                        this.invalidPinLocation = true;
                    } else {
                        this.model.set(ent.model_attr, [coords]);
                        this.error('Start or end position outside supported area. Some or all particles may disappear immediately on release');
                    }
                }
            } 
        },

        resetPinPickupHandler: function(ent) {
            //this context should always be the Form object
            var btn_name;
            if (ent) {
                if (this.invalidPinLocation) {
                    //pickup entity again
                    this.invalidPinLocation = false;
                    this.mouseTool.pickupEnt(null, ent);
                    return;
                }
                if (this.placeMode === 'point') {
                    btn_name = '.fixed';
                    _.each(this._spillPins, _.bind(function(sp) {sp.position.setValue(this._spillPins[0].position.getValue(Cesium.Iso8601.MINIMUM_VALUE));}, this));
                } else {
                    btn_name = '.moving';
                    var nextIdx = ent.index+1;
                    ent.label.show = false;
                    if (nextIdx < this._spillPins.length) {
                        this._spillPins[nextIdx].label.show = true;
                        this.mouseTool.pickupEnt(null, this._spillPins[nextIdx]);
                        return;
                    }
                }
            }
        },

        enablePointMode: function(e) {
            if (!_.isNull(this.mouseTool.heldEnt)) {
                this.mouseTool.cancelEnt(null, this.mouseTool.heldEnt);
            }
            this.placeMode = 'point';
            this.$('.moving').removeClass('on');
            this.$('.moving').tooltip('hide');
            var bt = this.$('.fixed');
            _.each(this._spillPins, function(sp){sp.show = false;});
            this._spillPins[0].show = true;
            this.mouseTool.pickupEnt(null, this._spillPins[0]);
        },

        switchCoordFormat: function(e) {
            _.each(this._spillPins, function(p){p.coordFormat = e.currentTarget.getAttribute('value');});
        },

        save: function() {
            this.clearError();
            this.trigger('save');
            this.hide();
            // var err = this.model.validateLocation();
            // if (err) {
            //     this.error("Placement error!", err);
            // } else {
            // }
        },

        wizardclose: function() {
            this.model = this.origModel;
            this.trigger('wizardclose');
        },

        close: function(){
            if (!_.isUndefined(this.spillMapView)){
                this.spillMapView.close();
            }
            
            FormModal.prototype.close.call(this);
        }
    });

    return mapSpillView;
});
