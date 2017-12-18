define([
    'underscore',
    'jquery',
    'backbone',
    'model/base',
    'moment',
    'localforage',
], function(_, $, Backbone, BaseModel, moment, localforage){
    'use strict';
    var baseGridObj = BaseModel.extend({
        urlRoot: '/grid/',
        grid_cache : localforage.createInstance({name: 'Grid Object Data Cache',
                                                    }),

        initialize: function(attrs, options) {
            BaseModel.prototype.initialize.call(this, attrs, options);
            this.on('change', this.resetRequest, this);
            localforage.config({
                name: 'WebGNOME Cache',
                storeName: 'webgnome_cache'
            });
            this.getMetadata();
        },

        resetRequest: function(){
            this.requested = false;
        },

        getMetadata: function() {
            var url = this.urlRoot + this.id + '/metadata';
            $.get(url, null, _.bind(function(metadata){
                this.metadata = metadata
            }, this ));
        },

        getNodes: function(callback){
            /*
            Gets the nodes of the grid from the server. Until we add subclasses for the different grid types,
            the data received will always be a Nx2 array of points (lon0, lat0, lon1, lat1, ..., lonN, latN)
            */
            this.grid_cache.getItem(this.id + 'nodes').then(_.bind(function(value){
                if(value) {
                    console.log(this.id + ' nodes found in store');
                    this.requested_nodes = true;
                    this.nodes = value;
                    if (callback) {
                        callback(this.nodes);
                    }
                    return this.nodes;
                } else {
                    if(!this.requesting && !this.requested_nodes){
                        this.requesting = true;
                        var ur = this.urlRoot + this.id + '/nodes';
                        $.ajax({url: ur,
                                type: "GET",
                                dataType: "binary",
                                responseType:"arraybuffer",
                                processData:"false",
                                headers: {
                                    'Accept' : 'application/octet-stream',
                                    'Access-Control-Allow-Request-Method': 'GET',
                                    'Content-Type': 'binary',
                                },
                                xhrFields:{
                                    withCredentials: true
                                },
                                success: _.bind(function(nodes, sts, response){
                            this.requesting = false;
                            this.requested_nodes = true;
                            var dtype = Float32Array;
                            var dtl = dtype.BYTES_PER_ELEMENT;
                            var num_nodes = nodes.byteLength / (2*dtl);
                            this.nodes = new dtype(nodes);
                            this.grid_cache.setItem(this.id + 'nodes', this.nodes);
                            if(callback) {
                                callback(this.nodes);
                            }
                            return this.nodes;
                        }, this )});
                    }
                }
            },this)).catch(function(err) {
                console.log(err);
            });
        },

        getCenters: function(callback){
            /*
            Gets the centers of the grid from the server. Until we add subclasses for the different grid types,
            the data received will always be a Nx2 array of points (lon0, lat0, lon1, lat1, ..., lonN, latN)
            */
            this.grid_cache.getItem(this.id + 'centers').then(_.bind(function(value){
                if(value) {
                    console.log(this.id + ' centers found in store');
                    this.requested_centers = true;
                    this.centers = value;
                    if (callback) {
                        callback(this.centers);
                    }
                    return this.centers;
                } else {
                    if(!this.requesting && !this.requested_centers){
                        this.requesting = true;
                        var ur = this.urlRoot + this.id + '/centers';
                        $.ajax({url: ur,
                                type: "GET",
                                dataType: "binary",
                                responseType:"arraybuffer",
                                processData:"false",
                                headers: {
                                    'Accept' : 'application/octet-stream',
                                    'Access-Control-Allow-Request-Method': 'GET',
                                    'Content-Type': 'binary',
                                },
                                xhrFields:{
                                    withCredentials: true
                                },
                                success: _.bind(function(centers, sts, response){
                            this.requesting = false;
                            this.requested_centers = true;
                            var dtype = Float32Array;
                            var dtl = dtype.BYTES_PER_ELEMENT;
                            var num_centers = centers.byteLength / (2*dtl);
                            this.centers = new dtype(centers);
                            this.grid_cache.setItem(this.id + 'centers', this.centers);
                            if(callback) {
                                callback(this.centers);
                            }
                            return this.centers;
                        }, this )});
                    }
                }
            },this)).catch(function(err) {
                console.log(err);
            });
        },

        getLines: function(callback){
            /*
            Gets the lines of the grid from the server. Use the 'num_lengths' header to split the response into
            two ArrayBuffers. The first array is of integer line lengths that sequentially index
            the second array, which are lon/lat pairs that form points of a line. When all such lines are
            drawn, the grid image is complete. Do not override this function; all grids must provide line data
            in this format to be drawn on the Cesium canvas.
            */
            this.grid_cache.getItem(this.id + 'lines').then(_.bind(function(lineData){
                if(lineData) {
                    console.log(this.id + ' lines found in store');
                    this.requesting = false;
                    this.requested_lines = true;
                    var num_lengths = lineData[1];
                    var lines = lineData[0];
                    var lenDtype = Int32Array;
                    var lenDtl = lenDtype.BYTES_PER_ELEMENT;
                    this._lineLengths = new lenDtype(lines, 0, num_lengths);
                    var lineDtype = Float32Array;
                    this._lines = new lineDtype(lines, num_lengths*lenDtl);
                    if (callback) {
                        callback([this._lineLengths, this._lines]);
                    }
                    return [this._lineLengths, this._lines];
                } else {
                    if(!this.requesting && !this.requested_lines){
                        var ur = this.urlRoot + this.id + '/lines';
                        this.requesting = true;
                        $.ajax({url: ur,
                                type: "GET",
                                dataType: "binary",
                                responseType:"arraybuffer",
                                processData:"false",
                                headers: {
                                    'Accept' : 'application/octet-stream',
                                    'Access-Control-Allow-Request-Method': 'GET',
                                    'Content-Type': 'binary',
                                },
                                xhrFields:{
                                    withCredentials: true
                                },
                                success: _.bind(
                            function(lines, sts, response){
                                this.requesting = false;
                                this.requested_lines = true;
                                var num_lengths = parseInt(response.getResponseHeader('num_lengths'));
                                var lenDtype = Int32Array;
                                var lenDtl = lenDtype.BYTES_PER_ELEMENT;
                                this._lineLengths = new lenDtype(lines, 0, num_lengths);
                                var lineDtype = Float32Array;
                                this._lines = new lineDtype(lines, num_lengths*lenDtl)
                                this.grid_cache.setItem(this.id + 'lines', [lines, num_lengths]);
                                if (callback) {
                                    callback([this._lineLengths, this._lines]);
                                }
                                return [this._lineLengths, this._lines];
                            }, 
                            this)
                        });
                    }
                }
            },this)).catch(function(err) {
                console.log(err);
            });
        },
    });
    return baseGridObj;
});