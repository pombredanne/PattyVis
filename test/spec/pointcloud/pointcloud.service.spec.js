'use strict';

describe('pointcloud.service', function() {

  // load the module
  beforeEach(module('pattyApp.pointcloud'));

  var PointcloudService;
  var Potree;
  beforeEach(function() {
    inject(function(_PointcloudService_, _Potree_) {
      PointcloudService = _PointcloudService_;
      Potree = _Potree_;
    });
  });


  describe('initial state', function() {
    it('should have settings', function() {

      var expected = {
        pointCountTarget: 1.0,
        pointSize: 0.2,
        opacity: 1,
        showSkybox: true,
        interpolate: false,
        pointSizeType: Potree.PointSizeType.ATTENUATED,
        pointSizeTypes: Potree.PointSizeType,
        pointColorType: Potree.PointColorType.RGB,
        pointColorTypes: Potree.PointColorType,
        pointShapes: Potree.PointShape,
        pointShape: Potree.PointShape.SQUARE,
        showStats: false
      };

      expect(PointcloudService.settings).toEqual(expected);
    });
  });

});
