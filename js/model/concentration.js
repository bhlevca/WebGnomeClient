define([
    'underscore',
    'backbone',
    'd3',
    'model/base',
    'moment',
    'cesium',
    'model/visualization/graticule'
], function(_, Backbone, d3, BaseModel, moment, Cesium, Graticule) {
    'use strict';
    var concentration = BaseModel.extend({
        urlRoot: '/concentration/',

        defaults: {
            'obj_type': 'gnome.concentration.concentration_location.ConcentrationLocation',
            'locations': [[0, 0]]
        },

        initialize: function(options) {
            BaseModel.prototype.initialize.call(this, options);

            this._visObj = this.generateVis();
        },

        generateVis: function(addOpts) {
            //Generates a CustomDataSource that represent release attributes so it may
            //be displayed in a Cesium viewer
            //addOpts are params to replace the default pin parameters below (such as 'movable')
            if (_.isUndefined(addOpts)) {
                addOpts = {};
            }
            var ds = new Cesium.CustomDataSource(this.get('id') + '_points');
            var coll = ds.entities;
            coll.concentrationPoints = [];
            var positions = this.get('locations');
            var num_points = positions.length;

            var textPropFuncGen = function(newPin) {
                return new Cesium.CallbackProperty(
                    _.bind(function(){
                        var loc = Cesium.Ellipsoid.WGS84.cartesianToCartographic(this.position._value);
                        var lon, lat;
                        if (this.coordFormat === 'dms') {
                            lon = Graticule.prototype.genDMSLabel('lon', loc.longitude);
                            lat = Graticule.prototype.genDMSLabel('lat', loc.latitude);
                        } else {
                            lon = Graticule.prototype.genDegLabel('lon', loc.longitude);
                            lat = Graticule.prototype.genDegLabel('lat', loc.latitude);
                        }
                        var ttstr;
                        ttstr = 'Lon: ' + ('\t' + lon) +
                                '\nLat: ' + ('\t' + lat);

                        return ttstr;
                    }, newPin),
                    true
                );
            };
            for (var i = 0; i < num_points; i++) {
                var newPt = coll.add(_.extend({
                    position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(positions[i][0], positions[i][1])),
                    billboard: {
                        image: '/img/spill-pin.png',
                        verticalOrigin: Cesium.VerticalOrigin.CENTER,
                        horizontalOrigin: Cesium.HorizontalOrigin.CENTER
                    },
                    show: true,
                    gnomeModel: this,
                    model_attr : 'locations',
                    coordFormat: 'dms',
                    index: i,
                    movable: false,
                    hoverable: true,
                    label : {
                        show : false,
                        showBackground : true,
                        backgroundColor: new Cesium.Color(0.165, 0.165, 0.165, 0.7),
                        font : '14px monospace',
                        horizontalOrigin : Cesium.HorizontalOrigin.LEFT,
                        verticalOrigin : Cesium.VerticalOrigin.TOP,
                        pixelOffset : new Cesium.Cartesian2(2, 0),
                        eyeOffset : new Cesium.Cartesian3(0,0,-5),
                    }
                }, addOpts));
                newPt.label.text = textPropFuncGen(newPt);
                coll.concentrationPoints.push(newPt);
            }
            return ds;
        },

        testVsSpillableArea: function(point, map) {
            var sa = map.get('spillable_area');
            if (_.isNull(sa) || _.isUndefined(sa)) {
                // no SA, so all locations are permitted
                return true;
            }
            if (sa[0].length !== 2) { //multiple SA polygons
                for (var i = 0; i < sa.length; i++) {
                    if (d3.polygonContains(sa[i], point)) {
                        return true;
                    }
                }
                return false;
            } else {
                return d3.polygonContains(sa, point);
            }
        },

        testVsMapBounds: function(point, map) {
            var mb = map.get('map_bounds');
            if (_.isNull(mb) || _.isUndefined(mb)) {
                return true;
            }
            return d3.polygonContains(mb, point);
        }

    });

    return concentration;

});
