describe('AxisAlignedBoundingBox', function() {
  var MARGIN_OF_ERROR = 0.000001;

  var a, b;
  beforeEach(function() {
    a = new p5.AxisAlignedBoundingBox(new p5.Vector(0, 0), 10, 10);
    b = new p5.AxisAlignedBoundingBox(new p5.Vector(0, 0), 10, 10);
  });

  it('stores properties', function() {
    var a = new p5.AxisAlignedBoundingBox(new p5.Vector(3, 4), 1, 2);
    expect(a.width).to.equal(1);
    expect(a.height).to.equal(2);
    expect(a.center.x).to.equal(3);
    expect(a.center.y).to.equal(4);
  });

  it('detects no collision when separated', function() {
    var testPositionsForB = [
      new p5.Vector(10, 0),
      new p5.Vector(0, 10),
      new p5.Vector(10, 10),
      new p5.Vector(-10, 0)
    ];

    testPositionsForB.forEach(function(position) {
      b.center = position;
      var displacement = a.collide(b);
      expect(displacement.x).to.equal(0);
      expect(displacement.y).to.equal(0);
    });
  });

  it('detects overlap when b to the right', function() {
    b.center = new p5.Vector(9, 0);
    var displacement = a.collide(b);
    expect(displacement.x).to.equal(-1);
    expect(displacement.y).to.equal(0);
  });

  it('detects overlap when b to the left', function() {
    b.center = new p5.Vector(-9, 0);
    var displacement = a.collide(b);
    expect(displacement.x).to.equal(1);
    expect(displacement.y).to.equal(0);
  });

  it('detects overlap when b is above', function() {
    b.center = new p5.Vector(0, -9);
    var displacement = a.collide(b);
    expect(displacement.x).to.be.closeTo(0, MARGIN_OF_ERROR);
    expect(displacement.y).to.be.closeTo(1, MARGIN_OF_ERROR);
  });

  it('detects overlap when b is below', function() {
    b.center = new p5.Vector(0, 9);
    var displacement = a.collide(b);
    expect(displacement.x).to.be.closeTo(0, MARGIN_OF_ERROR);
    expect(displacement.y).to.be.closeTo(-1, MARGIN_OF_ERROR);
  });

  it('picks smallest overlap when overlap occurs on both axes', function() {
    // Here the y-axis overlap is smaller, so that should be our exit vector
    b.center = new p5.Vector(8, 9);
    var displacement = a.collide(b);
    expect(displacement.x).to.be.closeTo(0, MARGIN_OF_ERROR);
    expect(displacement.y).to.be.closeTo(-1, MARGIN_OF_ERROR);
  });
});
