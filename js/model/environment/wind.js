define([
    'underscore',
    'backbone',
    'moment',
    'nucos',
    'model/base'
], function(_, Backbone, moment, nucos, BaseModel){
    'use strict';
    var windModel = BaseModel.extend({
        urlRoot: '/environment/',

        defaults: function(){
            var default_date;
            if(webgnome.hasModel()){
                default_date = webgnome.model.get('start_time');
            } else {
                default_date = moment().format('YYYY-MM-DDTHH:mm:00');
            }
            return {
                timeseries: [[default_date, [0, 0]]],
                units: 'knots',
                obj_type: 'gnome.environment.wind.Wind',
                speed_uncertainty_scale: 0
            };
        },

        speedLimit: {
            mag: 50,
            units: 'knots'
        },

        initialize: function(attrs, options) {
            BaseModel.prototype.initialize.call(this, attrs, options);
            this.on('change:timeseries', this.convertTimeSeries, this);
        },

        checkWindSpeed: function() {
            var timeseries = this.get('timeseries');
            for (var i = 0; i < timeseries.length; i++) {
                
            }
        },

        applySpeedUncertainty: function(wind){
            var uncertainty = this.get('speed_uncertainty_scale');
            var speed = this.get('timeseries')[0][1][0];
            if(uncertainty === 0){
                return speed;
            }

            var ranger = nucos.rayleighDist().rangeFinder(speed, uncertainty);
            return (ranger.low.toFixed(1) + ' - ' + ranger.high.toFixed(1));
        },

        convertTimeSeries: function() {
            if (this.get('timeseries').length > 1) {
                _.each(this.get('timeseries'), function(el, i, ts) {
                    var timeString = el[0].replace(/[+-]\d\d:\d\d/, '');
                    el[0] = moment(timeString).format("YYYY-MM-DDTHH:mm:ss");
                });
            }
            this.sortTimeseries();
        },

        validate: function(attrs, options){
            if(!_.isUndefined(attrs.timeseries)) {
                var msg;
                attrs.speedLimit = this.speedLimit;
                var upperLimit = Math.floor(nucos.convert("Velocity", attrs.speedLimit.units, attrs.units, attrs.speedLimit.mag));
                _.each(attrs.timeseries, function(el, ind, arr){
                    var speed = nucos.convert("Velocity", attrs.units, attrs.speedLimit.units, el[1][0]);
                    var prevIndex = ind - 1;

                    if (prevIndex >= 0 && el[0] === arr[prevIndex][0]) {
                        msg = 'Duplicate entries with the start time: ';
                        msg += moment(el[0]).format(webgnome.config.date_format.moment);
                    }

                    if(speed < 0){
                        msg = 'Speed must be greater than or equal to 0 ' + attrs.units + '!';
                    }
                    if(speed > attrs.speedLimit.mag){
                        msg = 'Speed must be less than or equal to ' + upperLimit + ' ' + attrs.units + '!';
                    }

                    if(el[1][1] < 0 || el[1][1] > 360){
                        msg = 'Direction must be between 0 and 360 degrees';
                    }

                    if(_.isNull(el[1][1])){
                        msg = 'Enter a valid direction!';
                    }
                });
                if (msg) {
                    return msg;
                }
            }

            if (_.isUndefined(attrs.units)) {
                return 'Speed unit definition is required.';
            }
        },

        sortTimeseries: function(){
            var ts = _.sortBy(this.get('timeseries'), function(entry){
                return moment(entry[0]).unix();
            });
            this.set('timeseries', ts);
        },

        determineTimeInterval: function(index, boundingIndex, boundingInterval) {
            var ts = this.get('timeseries');
            var tsLength = ts.length;
            var timeInterval;

            if (boundingIndex >= tsLength || boundingIndex < 0) {
                timeInterval = boundingInterval * 60;
            } else {
                var prevEntry = moment(ts[index][0]);
                var boundingEntry = moment(ts[boundingIndex][0]);
                timeInterval = Math.abs(prevEntry.diff(boundingEntry, 'minutes') / 2);
            }

            if (boundingIndex - index < 0) {
                timeInterval *= -1;
            }

            return timeInterval;
        },

        addTimeseriesRow: function(index, opts) {
            var prevEntry = this.get('timeseries')[index];
            var boundingIndex;

            if (opts.add === 'above') {
                boundingIndex = index - 1;
            } else if (opts.add === 'below') {
                boundingIndex = index + 1;
            }

            var newInterval = this.determineTimeInterval(index, boundingIndex, opts.interval);

            var newDate = moment(prevEntry[0]).add(newInterval, 'm').format("YYYY-MM-DDTHH:mm:ss");

            var newEntry = [newDate, prevEntry[1]];
            this.get('timeseries').splice(index, 0, newEntry);
            this.sortTimeseries();
        },

        toTree: function(){
            var units = this.get('units');
            var timeseries = this.get('timeseries');
            var attrs = [];

            switch (units) {
                case 'mph':
                    units = 'miles / hour';
                    break;
                case 'm/s':
                    units = 'meters / sec';
                    break;
                default:
                    units = units;
            }
            var arrayOfStrings = [];
            for (var i = 0; i < timeseries.length; i++){
                var arrayString = '[' + moment(timeseries[i][0]).format('lll') + ', Speed: ' + timeseries[i][1][0] + ', Direction: ' + timeseries[i][1][1] + ']';
                arrayOfStrings.push({title: arrayString});
            }
            attrs.push({title: 'Timeseries: [...]', expanded: false, children: arrayOfStrings});

            attrs.push({title: 'Units: ' + units, key: 'Units',
                         obj_type: this.get('units'), action: 'edit', object: this});

            return attrs;
        }
    });

    return windModel;
});