// set up the app
require([
    'app',
], function(App){
    'use strict';
    window.webgnome = App;
    webgnome.config();
    webgnome.initialize();
});