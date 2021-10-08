define([
    'underscore',
    'jquery',
    'cesium',
    'model/map/bna',
    'views/modal/form',
    'views/cesium/cesium',
    'views/cesium/tools/rectangle_tool',
    'text!templates/form/map/goods.html',
    'model/resources/shorelines'
], function(_, $, Cesium, MapBNAModel, FormModal, CesiumView, RectangleTool, GoodsTemplate, ShorelineResource){
    var goodsMapForm = FormModal.extend({
        title: 'GOODS Map Generator',
        className: 'modal form-modal goods-map',

        initialize: function(options){
            this.on('hidden', this.close);
            FormModal.prototype.initialize.call(this, options);
            this.goods = new ShorelineResource();
        },

        render: function(){
            this.body = _.template(GoodsTemplate)();
            FormModal.prototype.render.call(this);
            this.map = new CesiumView({
                baseLayerPicker: true,
                toolboxOptions:{defaultToolType: RectangleTool}
            });
            this.$('#shoreline-goods-map').append(this.map.$el);
            this.map.render();

            var spills = webgnome.model.get('spills').models;
            for (var i = 0; i < spills.length; i++){
                this.map.viewer.dataSources.add(spills[i].get('release').generateVis());
            }
        },

        save: function() {
            console.log('hi');
            var points = this.map.toolbox.currentTool.activePoints;
            var bounds = Cesium.Rectangle.fromCartesianArray(points);
            var northLat = Cesium.Math.toDegrees(Cesium.Math.clampToLatitudeRange(bounds.north));
            var southLat = Cesium.Math.toDegrees(Cesium.Math.clampToLatitudeRange(bounds.south));
            var westLon = Cesium.Math.toDegrees(Cesium.Math.convertLongitudeRange(bounds.west));
            var eastLon = Cesium.Math.toDegrees(Cesium.Math.convertLongitudeRange(bounds.east));
            var xDateline = 0;
            if (westLon > eastLon || westLon < -180){
                //probably crossing dateline
                xDateline = 1;
            }
            $.post(webgnome.config.api+'/goods',
                {err_placeholder:'',
                 NorthLat: northLat,
                 WestLon: westLon,
                 EastLon: eastLon,
                 SouthLat: southLat,
                 xDateline: xDateline,
                 resolution: this.$('#resolution').val(),
                 submit: 'Get Map',
                }
            ).done(_.bind(function(fileList, name){
                    $.post(webgnome.config.api + '/map/upload',
                        {'file_list': JSON.stringify(fileList),
                         'obj_type': MapBNAModel.prototype.defaults().obj_type,
                         'name': name,
                         'session': localStorage.getItem('session')
                        }
                    ).done(_.bind(function(response) {
                        var map = new MapBNAModel(JSON.parse(response));
                        webgnome.model.save('map', map, {'validate':false});
                        this.hide();
                    }, this)
                    ).fail( 
                        _.bind(function(resp, a, b, c){
                            //error func for map creation
                            console.log(resp, a, b, c);
                        },this)
                    ).always(
                        _.bind(function(){
                            this.$('.save').prop('disabled', false);
                            this.$('cancel').prop('disabled', false);
                        },this)
                    );
                 }, this)
            ).fail(_.bind(function(resp, a, b, c){
                     //error func for /goods/ POST
                    console.error(a);
                    this.$('.save').prop('disabled', false);
                    this.$('cancel').prop('disabled', false);
                 }, this)
            );
            this.$('.save').prop('disabled', true);
            this.$('cancel').prop('disabled', true);
        }
    });

    return goodsMapForm;
});