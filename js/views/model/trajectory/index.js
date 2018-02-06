define([
    'jquery',
    'underscore',
    'backbone',
    'views/base',
    'module',
    'moment',
    'text!templates/model/trajectory/controls.html',
    'views/default/map',
    'cesium',
    'model/spill',
    'views/form/spill/continue',
    'text!templates/model/trajectory/trajectory_no_map.html',
    'model/step',
    'mousetrap',
    'html2canvas',
    'ccapture',
    'model/map/graticule',
    'views/model/trajectory/layers',
    'views/model/trajectory/controls',
    'gif',
    'gifworker',
    'whammy',
], function($, _, Backbone, BaseView, module, moment, ControlsTemplate, OlMapView, Cesium, GnomeSpill, SpillForm, NoTrajMapTemplate, GnomeStep, Mousetrap, html2canvas, CCapture, Graticule, LayersView, ControlsView){    'use strict';
    var trajectoryView = BaseView.extend({
        className: function() {
            var str;
            if (webgnome.model.get('mode') !== 'adios') {
                str = 'trajectory-view map ';
            } else {
                str = 'trajectory-view no-map';
            }

            return str;
        },
        events: {
            'click .view-gnome-mode': 'viewGnomeMode',
            'click .view-weathering': 'viewWeathering',
        },
        id: 'map',
        spillToggle: false,
        spillCoords: [],
        state: 'loading',
        frame: 0,
        contracted: false,
        fps: 30,
        rframe: 0,

        initialize: function(options){
            this.module = module;
            BaseView.prototype.initialize.call(this, options);
            if (webgnome.model.get('mode') !== 'adios'){
                this.listenTo(webgnome.cache, 'rewind', this.rewind);
                this.modelMode = 'gnome';
            } else {
                this.modelMode = 'adios';
            }
            this.$el.appendTo('body');
            this.state = 'stopped';
            this.render();
        },

        render: function(){
            BaseView.prototype.render.call(this);
            if (this.modelMode !== 'adios') {
                this.renderTrajectory();
            } else {
                this.renderNoTrajectory();
            }
        },

        renderNoTrajectory: function() {
            this.$el.html(_.template(NoTrajMapTemplate));
        },

        renderTrajectory: function() {
            this.controls = new ControlsView();
            this.controlsListeners();

            this.controls.$el.appendTo(this.$el);
            // add a 250ms timeout to the map render to give js time to add the compiled
            // to the dom before trying to draw the map.
            setTimeout(_.bind(function() {
                this.renderCesiumMap();
                this.layersPanel = new LayersView();
                this.layersListeners();
                this.layersPanel.render();
                this.layersPanel.$el.appendTo(this.$el);
            }, this), 250);
        },

        layersListeners: function(){
            this.listenTo(this.layersPanel.layers, 'add', this.addLayer);
            this.listenTo(this.layersPanel.layers, 'remove', this.removeLayer);
        },
        controlsListeners: function() {
            this.listenTo(this.controls, 'play', this.play);
            this.listenTo(this.controls, 'pause', this.pause);
            this.listenTo(this.controls, 'record', this.record);
            this.listenTo(this.controls, 'stoprecord', this.stoprecord);
            this.listenTo(this.controls, 'stop', this.stop);
            this.listenTo(this.controls, 'back', this.prev);
            this.listenTo(this.controls, 'next', this.goToStep);
            this.listenTo(this.controls, 'rewind', this.rewindClick);
            this.listenTo(this.controls, 'seek', this.goToStep);
            this.listenTo(this.controls, 'loop', this.goToStep);
        },

        mapListener: function(){
            this.listenTo(webgnome.model.get('map'), 'change', this.resetMap);
        },

        spillListeners: function(){
            this.listenTo(webgnome.model.get('spills'), 'add change remove', this.resetSpills);
        },

        viewGnomeMode: function() {
            webgnome.model.set('mode', 'gnome');
            webgnome.model.save(null, {
                success: function(){
                    webgnome.router.navigate('config', true);
                }
            });
        },

        viewWeathering: function() {
            webgnome.router.navigate('fate', true);
        },

        createTooltipObject: function(title) {
            return {
                "title": title,
                "container": "body",
                "placement": "bottom"
            };
        },

        addLayer: function(lay) {
            if (!lay.id) {
                console.error('Layer must have id attribute');
            }
            if (lay.type === 'cesium') {
                if (lay.parentEl === 'primitive') {
                    this.layers[lay.id] = this.viewer.scene.primitives.add(lay.visObj);
                } else if (lay.parentEl === 'entity') {
                    this.layers[lay.id] = this.viewer.entities.add(lay.visObj);
                } else if (lay.parentEl === 'imageryLayer') {
                    this.layers[lay.id] = this.viewer.imageryLayers.addImageryProvider(lay.visObj);
                } else if (lay.parentEl === 'dataSource') {
                    this.viewer.dataSources.add(lay.visObj);
                    this.layers[lay.id] = lay.visObj;
                } else {
                    console.error('Tried to add an entity with invalid parentEl: ', lay.parentEl);
                }
            } else {
                console.error('Tried to add an entity with invalid type: ', lay.type);
            }
            // If adding a map layer, fly to it
            if (lay.id === webgnome.model.get('map').get('id')) {
                this._flyTo = true;
                this.show();
            }
        },

        removeLayer: function(lay) {
            if (!lay.id) {
                console.error('Layer must have id attribute');
            }
            if (lay.type === 'cesium') {
                if (lay.parentEl === 'primitive') {
                    if(this.viewer.scene.primitives.remove(this.layers[lay.id])) {
                        this.layers[lay.id] = undefined;
                    } else {
                        console.warn('Failed to remove primitive layer id: ', lay.id);
                    }
                } else if (lay.parentEl === 'entity') {
                    if(this.viewer.entities.remove(this.layers[lay.id])) {
                        this.layers[lay.id] = undefined;
                    } else {
                        console.warn('Failed to remove entity layer id: ', lay.id);
                    }
                } else if (lay.parentEl === 'imageryLayer') {
                    if(this.viewer.imageryLayers.remove(this.layers[lay.id])) {
                        this.layers[lay.id] = undefined;
                    } else {
                        console.warn('Failed to remove imagery layer id: ', lay.id);
                    }
                } else if (lay.parentEl === 'dataSource') {
                    if(this.viewer.dataSources.remove(this.layers[lay.id])) {
                        this.layers[lay.id] = undefined;
                    } else {
                        console.warn('Failed to remove datasource layer id: ', lay.id);
                    }
                } else {
                    console.error('Tried to remove an entity with invalid parentEl: ', lay.parentEl);
                }
            } else {
                console.error('Tried to remove an entity with invalid type: ', lay.type);
            }
        },

        show: function() {
            this.$el.show();
            if (this._flyTo) {
                var map_id = webgnome.model.get('map').id;
                this.viewer.flyTo(this.layers[map_id], {duration: 0.25});
                this._flyTo = false;
            }
        },

        renderCesiumMap: function(){
            if(!this.layers){
                this.layers = {};
            }

            // Cesium.BingMapsApi.defaultKey = 'Ai5E0iDKsjSUSXE9TvrdWXsQ3OJCVkh-qEck9iPsEt5Dao8Ug8nsQRBJ41RBlOXM';
            // var image_providers = Cesium.createDefaultImageryProviderViewModels();
            // var default_image = new Cesium.ProviderViewModel({
                // name: 'No imagery selected',
                // tooltip: '',
                // iconUrl: '/img/no_basemap.png',
                // creationFunction: function(){
                    // return new Cesium.SingleTileImageryProvider({
                        // url: '/img/globe.png'
                    // });
                // },
            // });
            // image_providers.unshift(default_image);

            this.viewer = new Cesium.Viewer('map', {
                animation: false,
                baseLayerPicker: false,
                vrButton: false,
                geocoder: false,
                homeButton: false,
                timeline: false,
                sceneModePicker: false,
                targetFrameRate: 60,
                navigationHelpButton: false,
                navigationInstructionsInitiallyVisible: false,
                skyAtmosphere: false,
                sceneMode: Cesium.SceneMode.SCENE2D,
                mapProjection: new Cesium.WebMercatorProjection(),
                //selectedImageryProviderViewModel: default_image,
                //imageryProviderViewModels: image_providers,
                imageryProvider : new Cesium.SingleTileImageryProvider({
                    url: '/img/globe.png'
                }),
                creditContainer: 'map',
                clockViewModel: new Cesium.ClockViewModel(new Cesium.Clock({
                   canAnimate: false,
                  shouldAnimate: false
                })),
                contextOptions: {
                    webgl:{
                        preserveDrawingBuffer:true,
                    },
                },
            });
            $('.cesium-widget-credits').hide();
            this.graticule = new Graticule(true, this.viewer.scene, 10, '.cesium-widget');
            this.graticule.activate();
            this.viewer.scene.fog.enabled = false;
            this.viewer.scene.fxaa = false;
            this.load();
/*
            this.renderSpills();

            this.layers.map = new Cesium.GeoJsonDataSource();
            this.layers.map.clampToGround = false;
            webgnome.model.get('map').getGeoJSON(_.bind(function(geojson){
                var loading = this.viewer.dataSources.add(this.layers.map.load(geojson, {
                    strokeWidth: 0,
                    stroke: Cesium.Color.WHITE.withAlpha(0),
                    //fill: Cesium.Color.GREEN.withAlpha(0.4)
                }));
                var bounds;
                if(webgnome.model.get('map').get('obj_type') !== 'gnome.map.GnomeMap'){
                    bounds = webgnome.model.get('map').get('map_bounds');
                    this.viewer.flyTo(loading, {
                        duration: 0.25
                    });
                    this.load();
                } else {
                    // fly to a gridded current instead
                    bounds = webgnome.model.get('map').get('map_bounds');
                    this.viewer.flyTo(loading, {
                        duration: 0.25
                    });
                }
            }, this));
*/
        },

        load: function(){
            this.listenTo(webgnome.cache, 'step:buffered', this.updateProgress);
            this.listenTo(webgnome.cache, 'step:failed', this.stop);

            if(localStorage.getItem('autorun') === 'true'){
                localStorage.setItem('autorun', '');
                this.play();
            }

            var entity = this.viewer.entities.add({
                label : {
                    show : false,
                    showBackground : true,
                    font : '14px monospace',
                    horizontalOrigin : Cesium.HorizontalOrigin.LEFT,
                    verticalOrigin : Cesium.VerticalOrigin.TOP,
                    pixelOffset : new Cesium.Cartesian2(15, 0),
                    eyeOffset : new Cesium.Cartesian3(0,0,-2),
                }
            });

            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            this.viewer.scene.pickTranslucentDepth = true;
            this.handler.setInputAction(_.bind(function(movement) {
                var pickedObject = this.viewer.scene.pick(movement.position);
                if (pickedObject) {
                    console.log(pickedObject, pickedObject.id);
                    var dir = Cesium.Math.toDegrees(Cesium.Math.zeroToTwoPi(-pickedObject.primitive.dir)).toFixed(2);
                    entity.position = pickedObject.primitive.position;
                    entity.pickedObject = pickedObject;
                    entity.label.show = true;
                    entity.label.text = new Cesium.CallbackProperty(_.bind(function(){
                                                                        var dir = Cesium.Math.toDegrees(Cesium.Math.zeroToTwoPi(-entity.pickedObject.primitive.dir)).toFixed(2);
                                                                        return 'Mag: ' + ('   ' + entity.pickedObject.primitive.mag.toFixed(2)).slice(-7) + 'm/s' +
                                                                            '\nDir: ' + ('   ' + dir).slice(-7) + '\u00B0';
                                                                    }, entity), false);

                } else {
                    entity.label.show = false;
                }

            }, this), Cesium.ScreenSpaceEventType.LEFT_CLICK);
        },

        goToStep: function(s) {
            if (this.state === 'paused') {
                this.state = 'next';
                this.frame = s.step;
            }
            this.loop();
        },

        loop: function(){
            if(this.state === 'playing' && this.frame < webgnome.model.get('num_time_steps') - 1 ||
               this.state === 'next' && this.frame < webgnome.model.get('num_time_steps') - 1){
                if (webgnome.cache.length > this.controls.getSliderValue() && webgnome.cache.length !== 0){
                    // the cache has the step, just render it
                        this.rframe = setTimeout(
                            _.bind(this.renderStep, this),
                            1000/this.fps,
                            {step:this.controls.getSliderValue()}
                        );
                } else  {
                    this.controls.updateProgress();
                    if(webgnome.cache.isHalted){
                        webgnome.cache.resume();
                    }
                    if (webgnome.cache.length === this.controls.getSliderValue()) {
                        this.listenTo(webgnome.cache, 'step:received', this.renderStep);
                        //webgnome.cache.on('step:received', this.renderStep, this);
                    }
                    if (!webgnome.cache.streaming) {
                        webgnome.cache.getSteps();
                    } else {
                        this.rframe = setTimeout(
                            _.bind(this.renderStep, this),
                            1000/this.fps,
                            {step:this.controls.getSliderValue()}
                        );
                    }
                }
                if(this.state === 'next'){
                    this.pause();
                }
            } else {
                this.pause();
            }
        },

        getCaptureOpts: function() {
            var paramObj = {format: 'gif',
                            framerate:6,
                            verbose:true,
                            motionBlurFrames:0,
                            workersPath: 'js/lib/ccapture.js/src/'};
                $.each($('.recordmenu form').serializeArray(), function(_, kv) {
                    if (kv.name === 'framerate' || kv.name === 'skip') {
                        paramObj[kv.name] = parseInt(kv.value,10);
                    } else {
                        paramObj[kv.name] = kv.value;
                    }
            });
            paramObj.workersPath = 'js/lib/ccapture.js/src/';
            return paramObj;
        },

        record: function() {
            if($('.modal:visible').length === 0){
                this.state = 'playing';
                this.is_recording = true;
                this.capture_opts = this.getCaptureOpts();
                this.meta_canvas = document.createElement('canvas');
                this.meta_canvas.width = this.viewer.canvas.width;
                this.meta_canvas.height = this.viewer.canvas.height;
                this.meta_canvas_ctx = this.meta_canvas.getContext('2d', {preserveDrawingBuffer: true});
                this.capturer = new CCapture(_.clone(this.capture_opts));
                this.capturer.start();
                this.capturer.skipped = 0;
                //this.recorder.resume();
                this.loop();
            }
        },

        stoprecord: function() {
            if($('.modal:visible').length === 0){
                this.pause();
                this.is_recording = false;
                this.capturer.stop();
                this.capturer.save(_.bind(function(blob){
                    this.controls.trigger('recording_saved');
                    webgnome.invokeSaveAsDialog(blob, this.capture_opts.name+'.'+this.capture_opts.format);
                }, this));
            }
        },

        play: function(){
            if($('.modal:visible').length === 0){
                if (webgnome.cache.length === this.controls.controls.seek.slider('value') || !webgnome.cache.isAsync) {
                    this.listenTo(webgnome.cache, 'step:received', this.renderStep);
                    //webgnome.cache.on('step:received', this.renderStep, this);
                }
                this.state = 'playing';
                this.loop();
            }
        },

        pause: function(){
            if($('.modal:visible').length === 0){
                this.stopListening(webgnome.cache, 'step:received', this.renderStep);
                //webgnome.cache.off('step:received', this.renderStep, this);
                this.state = 'paused';
            }
        },

        stop: function() {
            if($('.modal:visible').length === 0){
                this.pause();
                if(webgnome.cache && webgnome.cache.streaming){
                    webgnome.cache.sendHalt();
                }
                this.state = 'stopped';
            }
        },

        rewind: function(){
            if (this.state !== 'stopped'){
                this.stop();
            }
            this.frame = 0;
            clearTimeout(this.rframe);
            if(this.layersPanel) {
                this.layersPanel.resetSpills();
            }
        },

        rewindClick: function(e){
            if (this.state !== 'stopped'){
                this.stop();
            }
            this.frame = 0;
            clearTimeout(this.rframe);
            setTimeout(_.bind(function(){
                webgnome.cache.rewind();
            }, this), 20);
        },

        updateLayers: function(step){
            for(var i = 0; i < this.layers.length; i++) {
                this.layers[i].update(step);
            }
        },

        renderStep: _.debounce(function(source){
            var step;
            if(_.has(source, 'step')){
                step = webgnome.cache.inline[source.step];
                this.drawStep(step);
                //this.drawStep(step);
                webgnome.cache.at(source.step, _.bind(function(err, step){
                    if(!err){
                    }
                }, this));

            } else {
                step = source;
                this.drawStep(step);
            }
        },16),

        drawStep: function(step){
            if(!step){ return; }
            this.renderSpill(step);
            this.renderVisLayers(step);

            var time = moment(step.get('SpillJsonOutput').time_stamp.replace('T', ' ')).format('MM/DD/YYYY HH:mm');

            this.controls.controls.date.text(time);
            this.frame = step.get('step_num');
            if(this.frame < webgnome.model.get('num_time_steps') && this.state === 'playing'){
                this.controls.controls.seek.slider('value', this.frame + 1);
            } else {
                this.pause();
                this.controls.pause();
            }
            this.$('.tooltip-inner').text(time);
            //this.viewer.scene.render();

            this.renderSlider();
            if(this.is_recording){
                if(this.capturer.skipped < this.capture_opts.skip) {
                    this.capturer.skipped++;
                } else {
                    this.capturer.capture(this.meta_canvas);
                    this.capturer.skipped = 0;
                }
            }
        },

        renderSlider: function() {
            var ctrls = $('.seek');
            //$('.buttons', ctrls).hide();
            //$('.gnome-help', ctrls).hide();
            var ctx = this.meta_canvas_ctx;
            var cesiumCanvas = this.viewer.canvas;

            if(this.is_recording) {
                html2canvas(ctrls, {
                    //height:550,
                    onrendered: function(canvas) {
                        ctx.drawImage(cesiumCanvas,0,0);
                        ctx.drawImage(canvas,65,0);
                    }
                });
            }
        },

        renderSpill: function(step){
            var spills = webgnome.model.get('spills').models;
            for (var s = 0; s < spills.length; s++) {
                spills[s].update(step);
            }
        },

        renderCurrent: function(step){
            if(step.get('CurrentJsonOutput') && this.checked_currents && this.checked_currents.length > 0 && this.layers.uv){
                // hardcode to the first indexed id, because the ui only supports a single current being selected at the moment
                var id = this.checked_currents[0];
                var data = step.get('CurrentJsonOutput')[id];
                if(data && this.current_arrow[id]){
                    for(var uv = data.direction.length; uv--;){
                        this.layers.uv[id].get(uv).show = true;
                        if(this.layers.uv[id].get(uv).rotation !== data.direction[uv]){
                            this.layers.uv[id].get(uv).rotation = data.direction[uv];
                        }
                        if(this.layers.uv[id].get(uv).image !== this.uvImage(data.magnitude[uv], id)){
                            this.layers.uv[id].get(uv).image = this.uvImage(data.magnitude[uv], id);
                        }
                        this.layers.uv[id].get(uv).dir = data.direction[uv];
                        this.layers.uv[id].get(uv).mag = data.magnitude[uv];
                    }
                } else if(this.layers.uv[id]){
                    for(var h = this.layers.uv[id].length; h--;){
                        this.layers.uv[id].get(h).show = false;
                    }
                }
            }
        },

        renderVisLayers: function(step){
            // select only layers prepended with 'uv-' and appearance is on
            var lays = this.layersPanel.layers.filter(function(l) {
                return l.id.includes('uv-') && l.appearance.get('on');
            });
            for(var i = 0; i < lays.length; i++){
                    lays[i].model.update(step);
            }
        },

        uvImage: function(magnitude, id){
            return this.current_arrow[id][Math.round(Math.abs(magnitude)*10)/10];
        },

        // renderIceImage: function(step){
        //     var source;
        //     var ice_data = this.$('.ice-tc input[type="radio"]:checked').val();

        //     if(step && step.get('IceImageOutput') && this.tc_ice && this.tc_ice.length > 0){
        //         var image = step.get('IceImageOutput')[ice_data + '_image'];
        //         var bb = step.get('IceImageOutput').bounding_box;
        //         var coords = [[bb[0], [bb[0][0], bb[1][1]], bb[1], [bb[1][0], bb[0][1]]]];
        //         var poly = new ol.geom.Polygon(coords).transform('EPSG:4326', 'EPSG:3857');
        //         source = new ol.source.ImageStatic({
        //             url: image,
        //             imageSize: [1000, 1000],
        //             imageExtent: poly.getExtent(),
        //             projection: step.get('IceImageOutput').projection,
        //             imageLoadFunction: function(imageTile, src){
        //                 var imageElement = imageTile.getImage();
        //                 imageElement.src = src;
        //             }
        //         });
        //     } else {
        //         source = new ol.source.ImageStatic({
        //             url: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        //             imageSize: [1, 1],
        //             imageExtent: [-20000000000, -2000000000, 2000000000, 20000000],
        //             imageLoadFunction: function(imageTile, src){
        //                 var imageElement = imageTile.getImage();
        //                 imageElement.src = src;
        //             }
        //         });
        //     }

        //     this.IceImageLayer.setSource(source);
        // },

        renderIce: function(step){
            var outputter = webgnome.model.get('outputters').findWhere({obj_type: 'gnome.outputters.json.IceJsonOutput'});
            if(step && step.get('IceJsonOutput') && outputter.get('ice_movers').length > 0 && this.ice_grid){
                var mover = outputter.get('ice_movers').at(0);
                var data = step.get('IceJsonOutput').data[mover.get('id')];
                if(!data){ return null; }

                var vis = $('.ice-tc input[type="radio"]:checked').val();
                var colorBuffer = new Uint8Array(4);
                colorBuffer[2] = 255;

                if(data[vis].length > 0){
                    // update existing grid with color data
                    for(var cell = data[vis].length; cell--;){
                        this.iceValueToAlpha(vis, data[vis][cell], colorBuffer);
                        if(colorBuffer[3] !== this.ice_grid[cell].color[3]){
                            this.ice_grid[cell].color[3] = colorBuffer[3];
                            this.ice_grid[cell].color = this.ice_grid[cell].color;
                        }
                    }
                }
            }
        },

        iceValueToAlpha: function(name, value, colorBuffer){
            if(name[0] === 'c'){
                colorBuffer[3] = ~~(value * 255);
            } else {
                colorBuffer[3] = ~~((value * 0.1666666667) * 255);
            }
        },

        toggleGrid: function(e){
            if(!this.grids){
                this.grids = {};
            }
            var existing_grids = _.keys(this.grids);
            for(var grid = 0; grid < existing_grids.length; grid++){
                for(var prims = this.grids[existing_grids[grid]].length; prims--;){
                    this.grids[existing_grids[grid]][prims].show = false;
                }
            }

            var id = this.$(e.currentTarget).attr('id').replace('grid-', '');
            if(_.has(this.grids, id)){
                // need to hide the entire set of grids.
                for(var active_prim = this.grids[id].length; active_prim--;){
                    this.grids[id][active_prim].show = true;
                }
            } else if(id !== 'none-grid'){
                var current = webgnome.model.get('movers').findWhere({id: id});
                current.getGrid(_.bind(function(data){
                    var color = Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.PINK.withAlpha(0.3));
                    this.grids[current.get('id')]  = [];
                    var batch = 3000;
                    var batch_limit = Math.ceil(data.length / batch);
                    var segment = 0;
                    for(var b = 0; b < batch_limit; b++){
                        // setup the new batch
                        var geo = [];

                        // build the batch
                        var limit = segment + batch;
                        for(var cell = segment; cell < limit; cell++){
                            if(data[cell]){
                                geo.push(new Cesium.GeometryInstance({
                                    geometry: new Cesium.SimplePolylineGeometry({
                                        positions: Cesium.Cartesian3.fromDegreesArray(data[cell])
                                    }),
                                    attributes: {
                                        color: color
                                    },
                                    allowPicking: false
                                }));
                            }
                        }

                        segment += batch;

                        // send the batch to the gpu/cesium
                        this.grids[current.get('id')].push(this.viewer.scene.primitives.add(new Cesium.Primitive({
                            geometryInstances: geo,
                            appearance: new Cesium.PerInstanceColorAppearance({
                                flat: true,
                                translucent: false
                            })
                        })));
                    }

                }, this));
            }
        },

        toggleUV: function(e){
            var checked = this.$('.current-uv input:checked, .ice-uv input:checked');
            var current_outputter = webgnome.model.get('outputters').findWhere({obj_type: 'gnome.outputters.json.CurrentJsonOutput'});

            var uv_layers = _.keys(this.layers.uv);
            for(var l = 0; l < uv_layers.length; l++){
                for(var bb = this.layers.uv[uv_layers[l]].length; bb--;){
                    this.layers.uv[uv_layers[l]].get(bb).show = false;
                }
            }

            var id = $(checked[0]).attr('id').replace('uv-', '');
            if (checked.length > 0 && id !== 'none-uv'){
                current_outputter.get('current_movers').reset();
                this.checked_currents = [];

                this.$('.current-uv input:checked, .ice-uv input:checked').each(_.bind(function(i, input){
                    var current = webgnome.model.get('movers').get(id);
                    current.getCenters(_.bind(function(centers){
                        if(!this.layers.uv){
                            this.layers.uv = {};
                        }

                        if(!this.layers.uv[id]){
                            this.layers.uv[id] = new Cesium.BillboardCollection();
                            this.viewer.scene.primitives.add(this.layers.uv[id]);
                            this.generateUVTextures(this.layers.uv[id], id);
                        }

                        var layer = this.layers.uv[id];

                        // update the positions of any existing centers
                        var existing_length = this.layers.uv[id].length;
                        for(var existing = 0; existing < existing_length; existing++){
                            layer.get(existing).position = Cesium.Cartesian3.fromDegrees(centers[existing][0], centers[existing][1]);
                            layer.get(existing).show = false;
                        }

                        var create_length = centers.length;
                        for(var c = existing_length; c < create_length; c++){
                            layer.add({
                                show: false,
                                position: Cesium.Cartesian3.fromDegrees(centers[c][0], centers[c][1]),
                                image: this.current_arrow[id][0]
                            });
                        }
                    }, this));

                    this.checked_currents.push(id);
                    current_outputter.get('current_movers').add(current);
                }, this));
            } else {
                current_outputter.get('current_movers').reset();
                this.checked_currents = [];
            }
            if(this.state === 'pause'){
                this.renderStep({step: this.frame});
            }

            current_outputter.save();
        },

        generateUVTextures: function(layer, id){
            if(!this.current_arrow){
                this.current_arrow = {};
            }
            if(!this.current_arrow[id]){
                this.current_arrow[id] = {};
                // generate a canvas based texture for each size arrow we want
                // 0.0, 0.1, 0.2, etc...

                var canvas = document.createElement('canvas');
                canvas.width = 7;
                canvas.height = 7;
                var ctx = canvas.getContext('2d');
                ctx.beginPath();
                ctx.arc(1, 1, 0.5, 0, 2 * Math.PI);
                ctx.strokeStyle = 'rgba(204, 0, 204, 1)';
                ctx.stroke();
                this.current_arrow[id][0] = layer.add({
                    image: canvas,
                    show: false,
                    id: 0,
                }).image;

                var angle = Math.PI/5;
                var width = 45;
                var center = width / 2;

                for(var a = 0.1; a < 3.0; a += 0.1){
                    var s_a = Math.round(a*10)/10;
                    canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = s_a * 80;
                    ctx = canvas.getContext('2d');

                    var len = Math.abs(canvas.height / Math.log(canvas.height));
                    var rad = Math.PI / 2;

                    var arr_left = [(center + len * Math.cos(rad - angle)), (0 + len * Math.sin(rad - angle))];
                    var arr_right =[(center + len * Math.cos(rad + angle)), (0 + len * Math.sin(rad + angle))];

                    ctx.moveTo(center, canvas.height/2);
                    ctx.lineTo(center, 0);
                    ctx.lineTo(arr_right[0], arr_right[1]);
                    ctx.moveTo(arr_left[0], arr_left[1]);
                    ctx.lineTo(center, 0);
                    ctx.strokeStyle = 'rgba(204, 0, 204, 1)';
                    ctx.stroke();

                    this.current_arrow[id][s_a] = layer.add({
                        image: canvas,
                        show: false,
                    }).image;
                }
            }
        },

        toggleIceTC: function(e){
            var checked = this.$('.ice-tc input[type="checkbox"]:checked');
            // var current_outputter = webgnome.model.get('outputters').findWhere({obj_type: 'gnome.outputters.geo_json.IceGeoJsonOutput'});
            var current_outputter = webgnome.model.get('outputters').findWhere({obj_type: 'gnome.outputters.json.IceJsonOutput'});
            if (checked.length > 0){
                current_outputter.get('ice_movers').reset();

                this.$('.ice-tc input[type="checkbox"]:checked').each(_.bind(function(i, input){
                    var id = input.id.replace('tc-', '');
                    var current = webgnome.model.get('movers').get(id);
                    current.getGrid(_.bind(function(grid){
                        if(!this.layers.ice){
                            var ice = [];
                            for(var cell = grid.length; cell--;){
                                ice.push(new Cesium.GeometryInstance({
                                    geometry: new Cesium.PolygonGeometry({
                                        polygonHierarchy: {
                                            positions: Cesium.Cartesian3.fromDegreesArray(grid[cell])
                                        },
                                        vertextFormat: Cesium.VertexFormat.POSITION_AND_COLOR
                                    }),
                                    'id': cell,
                                    attributes: {
                                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.BLUE.withAlpha(0))
                                    }
                                }));
                            }
                            if(ice.length > 0){
                                this.layers.ice = this.viewer.scene.primitives.add(new Cesium.Primitive({
                                    geometryInstances: ice,
                                    appearance: new Cesium.PerInstanceColorAppearance({
                                        flat: true,
                                        translucent: true
                                    })
                                }));
                                this.layers.ice.readyPromise.then(_.bind(function(){
                                    this.ice_grid = [];
                                    for(cell = grid.length; cell--;){
                                        this.ice_grid.push(this.layers.ice.getGeometryInstanceAttributes(cell));
                                    }
                                    this.ice_grid.reverse();
                                }, this));
                            }
                        } else {
                            this.layers.ice.show = true;
                        }
                    }, this));
                    current_outputter.get('ice_movers').add(current);
                }, this));
            } else {
                current_outputter.get('ice_movers').reset();
                this.layers.ice.show = false;
            }

            if(this.state === 'pause'){
                this.renderStep({step: this.frame});
            }
            current_outputter.save();
        },

        toggleIceData: function(e){
            this.renderStep({step: this.frame});
        },

        showHelp: function(){
            this.$('.help-button').show();
        },

        helpBlur: function(e){
            e.target.blur();
        },

        blur: function(e, ui){
            ui.handle.blur();
        },

        close: function(){
            this.pause();
            this.$el.hide();
            // this.remove();
        }
    });

    return trajectoryView;
});