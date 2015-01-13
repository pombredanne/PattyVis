'use strict';

/**
 * @description This is main app module
 */
angular
  .module('pattyApp', [
    'ngAnimate',
    'ngSanitize',
    'ngTouch',
    'pattyApp.searchbox',
    'pattyApp.minimap'
  ])
  .config(function () {

  });

angular.module('pattyApp.core', []);
angular.module('pattyApp.searchbox', ['pattyApp.core']);
angular.module('pattyApp.minimap', ['pattyApp.core'])
       .factory('ol', function($window) {
         return $window.ol;
       })
       .factory('proj4', function($window) {
         return $window.proj4;
       });
