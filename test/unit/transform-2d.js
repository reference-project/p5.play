describe('Transform2D', function() {
  var MARGIN_OF_ERROR = 0.000001;

  it('constructs an identity matrix by default', function() {
    var t = new p5.Transform2D();
    expect(t.equals([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ])).to.be.true;
  });

  describe('equals', function() {
    it('detects equality with transforms', function() {
      var t1 = new p5.Transform2D();
      var t2 = new p5.Transform2D([
        1, 0, 0,
        0, 1, 0,
        0, 0, 1
      ]);
      expect(t1.equals(t2)).to.be.true;
    });

    it('detects equality with arrays', function() {
      var t1 = new p5.Transform2D([
        2, 1, 0,
        1, 2, 0,
        0, 0, 1
      ]);
      expect(t1.equals([
        2, 1, 0,
        1, 2, 0,
        0, 0, 1
      ])).to.be.true;
    });
  });

  describe('mult', function() {
    it('multiplies correctly', function() {
      var t1 = new p5.Transform2D([
        1, 2, 3,
        4, 5, 6,
        7, 8, 9
      ]);

      var result = t1.mult(t1);
      expect(result.equals([
        30, 36, 42,
        66, 81, 96,
        102, 126, 150
      ])).to.be.true;
    });
  });

  describe('translate', function() {
    it('can translate a vector', function() {
      var t = new p5.Transform2D().translate(2, 3);
      var v = new p5.Vector(4, 5);
      v.transform(t);
      expect(v.x).to.equal(6);
      expect(v.y).to.equal(8);
    });
  });

  describe('scale', function() {
    it('can scale a vector', function() {
      var t = new p5.Transform2D().scale(2);
      var v = new p5.Vector(4, 5);
      v.transform(t);
      expect(v.x).to.equal(8);
      expect(v.y).to.equal(10);
    });
  });

  describe('rotate', function() {
    it('can rotate a vector', function() {
      var t = new p5.Transform2D().rotate(Math.PI / 2);
      var v = new p5.Vector(4, 5);
      v.transform(t);
      expect(v.x).to.equal(-5);
      expect(v.y).to.equal(4);
    });
  });

  it('can compose transforms', function() {
    var t = new p5.Transform2D()
      .translate(2, 3)
      .scale(2);
    var v = new p5.Vector(4, 5);
    v.transform(t);
    expect(v.x).to.equal(12);
    expect(v.y).to.equal(16);

    // Transforms are applied in the order they are chained together
    t = new p5.Transform2D()
      .scale(2)
      .translate(2, 3);
    v = new p5.Vector(4, 5);
    v.transform(t);
    expect(v.x).to.equal(10);
    expect(v.y).to.equal(13);
  });

  it('can apply transforms sequentially', function() {
    var translate = new p5.Transform2D()
      .translate(2, 3);
    var scale = new p5.Transform2D()
      .scale(2);
    var v = new p5.Vector(4, 5);
    v.transform(translate)
      .transform(scale);
    expect(v.x).to.equal(12);
    expect(v.y).to.equal(16);

    // Trying reverse order
    v = new p5.Vector(4, 5);
    v.transform(scale).transform(translate);
    expect(v.x).to.equal(10);
    expect(v.y).to.equal(13);
  });

  it('scale and rotation have no effect on a 0,0 vector', function() {
    var t = new p5.Transform2D()
      .scale(2)
      .rotate(Math.PI / 3)
      .translate(2, 3);
    var v = new p5.Vector(0, 0);
    v.transform(t);
    expect(v.x).to.equal(2);
    expect(v.y).to.equal(3);
  });

  describe('extracting components from matrix', function() {
    [
      [4, 5, 1, 1, 0], // Translate only
      [0, 0, 10, 12, 0], // Scale only
      [0, 0, 1, 1, Math.PI], // Rotate only
      [2, 3, 4, 5, -1],
      [0, 1, 2, 3, 2]
    ].forEach(function(values) {

      describe('test case ' + values, function() {
        var tX = values[0];
        var tY = values[1];
        var sX = values[2];
        var sY = values[3];
        var r = values[4];
        var transform;

        beforeEach(function() {
          transform = new p5.Transform2D()
            .scale(sX, sY)
            .rotate(r)
            .translate(tX, tY);
        });

        it('extracts translation', function() {
          expect(transform.getTranslation().x).to.equal(tX);
          expect(transform.getTranslation().y).to.equal(tY);
        });

        it('extracts scale', function() {
          expect(transform.getScale().x).to.be.closeTo(sX, MARGIN_OF_ERROR);
          expect(transform.getScale().y).to.be.closeTo(sY, MARGIN_OF_ERROR);
        });
      });
    });
  });
});
