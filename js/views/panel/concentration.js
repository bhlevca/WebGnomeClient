define([
    'underscore',
    'jquery',
    'backbone',
    'views/panel/base',
    'views/form/concentration/concentration',
    'text!templates/panel/concentration.html',
    'model/concentration'
], function(_, $, Backbone, BasePanel, ConcentrationForm, ConcentrationPanelTemplate, ConcentrationModel){
    var waterPanel = BasePanel.extend({
        className: 'col-md-3 water object panel-view',

        initialize: function(options){
            BasePanel.prototype.initialize.call(this, options);
        },

        render: function(){
            compiled = _.template(ConcentrationPanelTemplate)();
            this.$el.html(compiled);
            this.$('.panel').removeClass('complete');
            this.$('.panel-body').hide().html('');

            BasePanel.prototype.render.call(this);
        },

        new: function(){
            var concentration = webgnome.model.get('concentration');
            if(!concentration){
                concentration = new ConcentrationModel();
            }
            var concentrationForm = new ConcentrationForm(null, concentration);
            concentrationForm.on('hidden', concentrationForm.close);
            concentrationForm.on('save', _.bind(function(){
                webgnome.model.save(null, {validate: false});
            }, this));
            concentrationForm.render();
        }

    });

    return waterPanel;
});