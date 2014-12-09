define([
    'jquery',
    'underscore',
    'backbone',
    'views/model/tree',
    'views/model/trajectory',
    'views/model/fate',
    'text!templates/model/index.html'
], function($, _, Backbone, TreeView, TrajectoryView, FateView, IndexTemplate){
    var modelView = Backbone.View.extend({
        className: 'page model',

        initialize: function(){
            this.render();
            $(window).on('resize', _.bind(function(){
                this.updateHeight();
            }, this));
        },

        events: {
            'click .view-toggle .toggle': 'switchView',
            'click .view-toggle label': 'switchView'
        },

        render: function(){
            this.$el.append(IndexTemplate);
            $('body').append(this.$el);
            var view = localStorage.getItem('view');
            var prediction = localStorage.getItem('prediction');
            
            if(!_.isNull(prediction) && prediction == 'both'){
                this.$('.switch').addClass('trajectory');
                localStorage.setItem('view', 'trajectory');
                view = 'trajectory';
            } else {
                this.$('.switch').addClass(prediction);
                localStorage.setItem('view', prediction);
                view = prediction;
            }

            if (view == 'fate') {
                this.renderFate();
            } else {
                this.renderTrajectory();
                this.updateHeight();
            }
        },

        renderTrajectory: function(){
            this.TreeView = new TreeView();
            this.TrajectoryView = new TrajectoryView();
            this.TreeView.on('toggle', this.TrajectoryView.toggle, this.TrajectoryView);
            this.$el.append(this.TreeView.$el).append(this.TrajectoryView.$el);
        },

        renderFate: function(){
            this.FateView = new FateView();
            this.$el.append(this.FateView.$el);
        },

        switchView: function(){
            var view = localStorage.getItem('view');
            if(view == 'fate') {
                this.$('.switch').removeClass('fate').addClass('trajectory');
                localStorage.setItem('view', 'trajectory');
                view = 'trajectory';
            } else {
                this.$('.switch').removeClass('trajectory').addClass('fate');
                localStorage.setItem('view', 'fate');
                view = 'fate';
            }

            this.reset();
            if(view == 'fate'){
                this.renderFate();
            } else {
                this.renderTrajectory();
                this.updateHeight();
            }

        },

        reset: function(){
            if(this.TreeView){
                this.TreeView.close();
            }
            if(this.TrajectoryView){
                this.TrajectoryView.close();
            }
            if(this.FateView){
                this.FateView.close();
            }
        },

        updateHeight: function(){
            var view = localStorage.getItem('view');
            if(view == 'trajectory'){
                var win = $(window).height();
                var height = win - 94 - 52;
                this.$el.css('height', height + 'px');
            }
        },

        close: function(){
            if(this.TreeView){
                this.TreeView.close();
            }

            if(this.TrajectoryView){
                this.TrajectoryView.close();
            }
            
            if(this.FateView){
                this.FateView.close();
            }

            this.remove();
            if (this.onClose){
                this.onClose();
            }
        }
    });

    return modelView;
});