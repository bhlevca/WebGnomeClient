define([
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'views/base',
    'module',
    'text!templates/default/legend.html',
    'moment',
], function ($, _, Backbone, Cesium, BaseView, module, LegendTemplate, moment) {
    "use strict";
    var legendView = BaseView.extend({
        className: 'legend',
        events: {
            'click .title': 'toggleLegendPanel',
            'click .legend-edit-btn': 'render'
        },

        initialize: function(options){
            this.module = module;
            this.listedItems = [];
            BaseView.prototype.initialize.call(this, options);
            this.render();
            if(webgnome.hasModel() && this.modelMode !== 'adios'){
                this.modelListeners();
            }
        },

        render: function() {
            //Render HTML
            this.$el.html(_.template(LegendTemplate,
                                     {model: webgnome.model,
                                      legend: this
                                     }
            ));
        },

        rerender: function() {
            this.$el.html('');
            for (var i = 0; i < this.listedItems.length; i++) {
                this.stopListening(this.listedItems[i]);
            }
            this.listedItems = [];
            this.render();
        },

        toggleLegendPanel: function(){
            this.$el.toggleClass('expanded');
        },

        modelListeners: function(){
            this.listenTo(webgnome.model.get('movers'), 'change', this.render);
            this.listenTo(webgnome.model.get('environment'), 'change', this.render);
            this.listenTo(webgnome.model.get('spills'), 'change', this.render);
            this.listenTo(webgnome.model, 'change', this.render);
        },

        genSpillLegendItem(spill) {
            var item = $('<tr></tr>');
            var row = $('<tr></tr>');
            var appearance = spill.get('_appearance');
            var colormap = appearance.get('colormap');
            var numberDomain = colormap.get('numberScaleDomain').slice();
            var colorDomain = colormap.get('colorScaleDomain').slice();
            var numColors = 1;
            if (colormap.get('map_type') === 'discrete') {
                numColors = colormap.get('colorScaleRange').length;
            }
            row.append($('<th class="spill-row-name" rowspan=' + numColors + '>'+ spill.get('name') +'<br><span>(' + colormap.get('units') + ')</span></th>'));
            var color = colormap.get('colorScaleRange')[0];
            var stops = _.clone(numberDomain);
            var p1, p2;
            var args = [1, 0].concat(colorDomain);
            Array.prototype.splice.apply(stops, args);
            var label = colormap.get('colorBlockLabels')[0];
            if (label === '') { //&nbsp;
                p1 = Number(colormap.toDisplayConversionFunc(stops[0])).toPrecision(4);
                p2 = Number(colormap.toDisplayConversionFunc(stops[1])).toPrecision(4);
                label = '<' + p1 + ' - ' + p2;
                if (numColors === 1) {
                    label = label + '+';
                }
            }
            row.append($('<td class="spill-color-bucket" style="background-color: '+ color +'"><span>'+ label +'</span></td>'));
            item.append(row);
            for (var i = 1; i < numColors; i++) {
                label = colormap.get('colorBlockLabels')[i];
                if (label === '') { //&nbsp;
                    p1 = Number(colormap.toDisplayConversionFunc(stops[i])).toPrecision(4);
                    p2 = Number(colormap.toDisplayConversionFunc(stops[i+1])).toPrecision(4);
                    label = p1 + ' - ' + p2;
                    if (i === numColors - 1) {
                        label = label + '+';
                    }
                }
                color = colormap.get('colorScaleRange')[i];
                item.append($('<tr><td class="spill-color-bucket" style="background-color: '+ color +'"><span>'+ label +'</span></td></tr>'));
            }
            this.listenTo(colormap, 'change', this.rerender);
            //this.listenTo(colormap, 'change:colorBlockLabels', this.rerender);
            //this.listenTo(colormap, 'change:colorScaleRange', this.rerender);
            //this.listenTo(colormap, 'change:units', this.rerender);
            //this.listenTo
            this.listedItems.push(colormap);
            return item[0].outerHTML;
        }

    });
    return legendView;
});