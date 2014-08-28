define([
    'jquery',
    'underscore',
    'backbone',
    'views/default/index',
    'views/default/menu',
    'views/default/gnome',
    'views/default/notfound',
    'views/location/index',
    'views/model/index',
    'views/tests/index',
    'views/default/adios'
], function($, _, Backbone,
    IndexView, MenuView, GnomeView, NotFoundView, LocationsView,
    ModelView, TestView, AdiosView) {
    var Router = Backbone.Router.extend({
        views: [],
        name: 'Main',
        routes: {
            '': 'index',

            'gnome/': 'gnome',
            'gnome/model': 'gnomeModel',
            'gnome/locations': 'locations',
            'gnome/test': 'test',

            'adios/': 'adios',

            '*actions': 'notfound'
        },

        execute: function(callback, args){
            for(var view in this.views){
                $('.tooltip').remove();
                this.views[view].close();
            }
            this.views = [];
            if(callback) callback.apply(this, args);
        },

        index: function(){
            this.views.push(new IndexView());
        },

        gnome: function(){
            if(!webgnome.hasModel()){
                this.views.push(new MenuView());
                this.views.push(new GnomeView());
            } else {
                this.navigate('gnome/model', true);
            }
        },

        test: function(){
            // if this isn't the development environment ignore the test request.
            if(window.location.href.indexOf('0.0.0.0') == -1){
                this.navigate('', true, false);
            }
            this.views.push(new TestView());
        },

        notfound: function(actions){
            this.views.push(new MenuView());
            this.views.push(new NotFoundView());
            console.log('Not found:', actions);
        },

        locations: function(){
            this.views.push(new MenuView());
            this.views.push(new LocationsView());
        },

        gnomeModel: function(){
            if(webgnome.hasModel()){
                this.views.push(new MenuView());
                this.views.push(new ModelView());
            } else {
                this.navigate('gnome/', true);
            }
        },

        adios: function(){
            this.views.push(new MenuView());
            this.views.push(new AdiosView());
        }
    });

    return Router;
});
