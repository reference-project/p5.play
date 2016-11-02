describe('CollisionShape interface', function() {
  //var MARGIN_OF_ERROR = 0.000001;

  // We run this suite of tests for every type that extends from CollisionShape,
  // to ensure that none of them break these assumptions.
  [
    'CollisionPoint',
    'CollisionCircle',
    'AxisAlignedBoundingBox',
    'OrientedBoundingBox'
  ].forEach(function(typeName) {
    describe('as implemented by ' + typeName, function() {
      var ShapeType = p5[typeName];

      it('can construct with no arguments', function() {
        var shape = new ShapeType();
        expect(shape.center.x).to.eq(0);
        expect(shape.center.y).to.eq(0);
        expect(shape.rotation).to.eq(0);
      });

      it('can construct with a center vector', function() {
        var shape = new ShapeType(new p5.Vector(2, 3));
        expect(shape.center.x).to.eq(2);
        expect(shape.center.y).to.eq(3);
        expect(shape.rotation).to.eq(0);
      });

      it('can modify shape center', function() {
        var shape = new ShapeType(new p5.Vector(2, 3));
        expect(shape.center.x).to.eq(2);
        expect(shape.center.y).to.eq(3);
        expect(shape.rotation).to.eq(0);

        shape.center = new p5.Vector(4, 5);
        expect(shape.center.x).to.eq(4);
        expect(shape.center.y).to.eq(5);
        expect(shape.rotation).to.eq(0);
      });

      it('can modify shape rotation', function() {
        var shape = new ShapeType(new p5.Vector(2, 3));
        expect(shape.center.x).to.eq(2);
        expect(shape.center.y).to.eq(3);
        expect(shape.rotation).to.eq(0);

        shape.rotation = 2;
        expect(shape.center.x).to.eq(2);
        expect(shape.center.y).to.eq(3);
        expect(shape.rotation).to.eq(2);
      });
    });
  });
});
