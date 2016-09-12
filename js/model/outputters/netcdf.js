define([
    'underscore',
    'backbone',
    'model/outputters/file_outputter'
], function(_, Backbone, FileOutputterModel){
    'use strict';
    var netCDFOutputter = FileOutputterModel.extend({
        urlRoot: '/outputter/',

        defaults: function() {
            return _.defaults({
                'obj_type': 'gnome.outputters.netcdf.NetCDFOutput',
                'name': 'Model.nc',
                'netcdf_filename': 'Model.nc',
                'output_timestep': 900
            }, FileOutputterModel.prototype.defaults);
        },

        toTree: function(){
            return '';
        }
    });

    return netCDFOutputter;
});