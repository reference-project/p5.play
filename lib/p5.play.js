/*
p5.play
by Paolo Pedercini/molleindustria, 2015
http://molleindustria.org/
*/

(function(root, factory) {
if (typeof define === 'function' && define.amd)
define('p5.play', ['p5'], function(p5) { (factory(p5)); });
else if (typeof exports === 'object')
factory(require('../p5'));
else
factory(root.p5);
}(this, function(p5) {
/**
 * p5.play is a library for p5.js to facilitate the creation of games and gamelike
 * projects.
 *
 * It provides a flexible Sprite class to manage visual objects in 2D space
 * and features such as animation support, basic collision detection
 * and resolution, mouse and keyboard interactions, and a virtual camera.
 *
 * p5.play is not a box2D-derived physics engine, it doesn't use events, and it's
 * designed to be understood and possibly modified by intermediate programmers.
 *
 * See the examples folder for more info on how to use this library.
 *
 * @module p5.play
 * @submodule p5.play
 * @for p5.play
 * @main
 */

// =============================================================================
//                         initialization
// =============================================================================

// This is the new way to initialize custom p5 properties for any p5 instance.
// The goal is to migrate lazy P5 properties over to this method.
// @see https://github.com/molleindustria/p5.play/issues/46
p5.prototype.registerMethod('init', function p5PlayInit() {
  /**
   * The sketch camera automatically created at the beginning of a sketch.
   * A camera facilitates scrolling and zooming for scenes extending beyond
   * the canvas. A camera has a position, a zoom factor, and the mouse
   * coordinates relative to the view.
   *
   * In p5.js terms the camera wraps the whole drawing cycle in a
   * transformation matrix but it can be disabled anytime during the draw
   * cycle, for example to draw interface elements in an absolute position.
   *
   * @property camera
   * @type {camera}
   */
  this.camera = new Camera(this, 0, 0, 1);
  this.camera.init = false;
});

// This provides a way for us to lazily define properties that
// are global to p5 instances.
//
// Note that this isn't just an optimization: p5 currently provides no
// way for add-ons to be notified when new p5 instances are created, so
// lazily creating these properties is the *only* mechanism available
// to us. For more information, see:
//
// https://github.com/processing/p5.js/issues/1263
function defineLazyP5Property(name, getter) {
  Object.defineProperty(p5.prototype, name, {
    configurable: true,
    enumerable: true,
    get: function() {
      var context = (this instanceof p5 && !this._isGlobal) ? this : window;

      if (typeof(context._p5PlayProperties) === 'undefined') {
        context._p5PlayProperties = {};
      }
      if (!(name in context._p5PlayProperties)) {
        context._p5PlayProperties[name] = getter.call(context);
      }
      return context._p5PlayProperties[name];
    }
  });
}

// This returns a factory function, suitable for passing to
// defineLazyP5Property, that returns a subclass of the given
// constructor that is always bound to a particular p5 instance.
function boundConstructorFactory(constructor) {
  if (typeof(constructor) !== 'function')
    throw new Error('constructor must be a function');

  return function createBoundConstructor() {
    var pInst = this;

    function F() {
      var args = Array.prototype.slice.call(arguments);

      return constructor.apply(this, [pInst].concat(args));
    }
    F.prototype = constructor.prototype;

    return F;
  };
}

// This is a utility that makes it easy to define convenient aliases to
// pre-bound p5 instance methods.
//
// For example:
//
//   var pInstBind = createPInstBinder(pInst);
//
//   var createVector = pInstBind('createVector');
//   var loadImage = pInstBind('loadImage');
//
// The above will create functions createVector and loadImage, which can be
// used similar to p5 global mode--however, they're bound to specific p5
// instances, and can thus be used outside of global mode.
function createPInstBinder(pInst) {
  return function pInstBind(methodName) {
    var method = pInst[methodName];

    if (typeof(method) !== 'function')
      throw new Error('"' + methodName + '" is not a p5 method');
    return method.bind(pInst);
  };
}

// These are utility p5 functions that don't depend on p5 instance state in
// order to work properly, so we'll go ahead and make them easy to
// access without needing to bind them to a p5 instance.
var abs = p5.prototype.abs;
var radians = p5.prototype.radians;
var degrees = p5.prototype.degrees;

// =============================================================================
//                         p5 extensions
// TODO: It'd be nice to get these accepted upstream in p5
// =============================================================================

/**
 * Projects a vector onto the line parallel to a second vector, giving a third
 * vector which is the orthogonal projection of that vector onto the line.
 * @see https://en.wikipedia.org/wiki/Vector_projection
 * @method project
 * @for p5.Vector
 * @static
 * @param {p5.Vector} a - vector being projected
 * @param {p5.Vector} b - vector defining the projection target line.
 * @return {p5.Vector} projection of a onto the line parallel to b.
 */
p5.Vector.project = function(a, b) {
  return p5.Vector.mult(b, p5.Vector.dot(a, b) / p5.Vector.dot(b, b));
};

/**
 * Ask whether a vector is parallel to this one.
 * @method isParallel
 * @for p5.Vector
 * @param {p5.Vector} v2
 * @return {boolean}
 */
p5.Vector.prototype.isParallel = function(v2) {
  return (this.x === 0 && v2.x === 0) ||
    (this.y === 0 && v2.y === 0) ||
    (this.x / v2.x === this.y / v2.y);
};

// =============================================================================
//                         p5 additions
// =============================================================================

/**
* A Group containing all the sprites in the sketch.
*
* @property allSprites
* @for p5.play
* @type {Group}
*/

defineLazyP5Property('allSprites', function() {
  return new p5.prototype.Group();
});

p5.prototype.spriteUpdate = true;

/**
   * A Sprite is the main building block of p5.play:
   * an element able to store images or animations with a set of
   * properties such as position and visibility.
   * A Sprite can have a collider that defines the active area to detect
   * collisions or overlappings with other sprites and mouse interactions.
   *
   * Sprites created using createSprite (the preferred way) are added to the
   * allSprites group and given a depth value that puts it in front of all
   * other sprites.
   *
   * @method createSprite
   * @param {Number} x Initial x coordinate
   * @param {Number} y Initial y coordinate
   * @param {Number} width Width of the placeholder rectangle and of the
   *                       collider until an image or new collider are set
   * @param {Number} height Height of the placeholder rectangle and of the
   *                       collider until an image or new collider are set
   * @return {Object} The new sprite instance
   */

p5.prototype.createSprite = function(x, y, width, height) {
  var s = new Sprite(this, x, y, width, height);
  s.depth = this.allSprites.maxDepth()+1;
  this.allSprites.add(s);
  return s;
};


/**
   * Removes a Sprite from the sketch.
   * The removed Sprite won't be drawn or updated anymore.
   * Equivalent to Sprite.remove()
   *
   * @method removeSprite
   * @param {Object} sprite Sprite to be removed
*/
p5.prototype.removeSprite = function(sprite) {
  sprite.remove();
};

/**
* Updates all the sprites in the sketch (position, animation...)
* it's called automatically at every draw().
* It can be paused by passing a parameter true or false;
* Note: it does not render the sprites.
*
* @method updateSprites
* @param {Boolean} updating false to pause the update, true to resume
*/
p5.prototype.updateSprites = function(upd) {

  if(upd === false)
    this.spriteUpdate = false;
  if(upd === true)
    this.spriteUpdate = true;

  if(this.spriteUpdate)
  for(var i = 0; i<this.allSprites.size(); i++)
  {
    this.allSprites.get(i).update();
  }
};

/**
* Returns all the sprites in the sketch as an array
*
* @method getSprites
* @return {Array} Array of Sprites
*/
p5.prototype.getSprites = function() {

  //draw everything
  if(arguments.length===0)
  {
    return this.allSprites.toArray();
  }
  else
  {
    var arr = [];
    //for every tag
    for(var j=0; j<arguments.length; j++)
    {
      for(var i = 0; i<this.allSprites.size(); i++)
      {
        if(this.allSprites.get(i).isTagged(arguments[j]))
          arr.push(this.allSprites.get(i));
      }
    }

    return arr;
  }

};

/**
* Displays a Group of sprites.
* If no parameter is specified, draws all sprites in the
* sketch.
* The drawing order is determined by the Sprite property "depth"
*
* @method drawSprites
* @param {Group} [group] Group of Sprites to be displayed
*/
p5.prototype.drawSprites = function(group) {
  // If no group is provided, draw the allSprites group.
  group = group || this.allSprites;

  if (typeof group.draw !== 'function')
  {
    throw('Error: with drawSprites you can only draw all sprites or a group');
  }

  group.draw();
};

/**
* Displays a Sprite.
* To be typically used in the main draw function.
*
* @method drawSprite
* @param {Sprite} sprite Sprite to be displayed
*/
p5.prototype.drawSprite = function(sprite) {
  if(sprite)
  sprite.display();
};

/**
* Loads an animation.
* To be typically used in the preload() function of the sketch.
*
* @method loadAnimation
* @param {Sprite} sprite Sprite to be displayed
*/
p5.prototype.loadAnimation = function() {
  return construct(this.Animation, arguments);
};

/**
 * Loads a Sprite Sheet.
 * To be typically used in the preload() function of the sketch.
 *
 * @method loadSpriteSheet
 */
p5.prototype.loadSpriteSheet = function() {
  return construct(this.SpriteSheet, arguments);
};

/**
* Displays an animation.
*
* @method animation
* @param {Animation} anim Animation to be displayed
* @param {Number} x X coordinate
* @param {Number} y Y coordinate
*
*/
p5.prototype.animation = function(anim, x, y) {
  anim.draw(x, y);
};

//variable to detect instant presses
defineLazyP5Property('_p5play', function() {
  return {
    keyStates: {},
    mouseStates: {}
  };
});

var KEY_IS_UP = 0;
var KEY_WENT_DOWN = 1;
var KEY_IS_DOWN = 2;
var KEY_WENT_UP = 3;

/**
* Detects if a key was pressed during the last cycle.
* It can be used to trigger events once, when a key is pressed or released.
* Example: Super Mario jumping.
*
* @method keyWentDown
* @param {Number|String} key Key code or character
* @return {Boolean} True if the key was pressed
*/
p5.prototype.keyWentDown = function(key) {
  return this._isKeyInState(key, KEY_WENT_DOWN);
};


/**
* Detects if a key was released during the last cycle.
* It can be used to trigger events once, when a key is pressed or released.
* Example: Spaceship shooting.
*
* @method keyWentUp
* @param {Number|String} key Key code or character
* @return {Boolean} True if the key was released
*/
p5.prototype.keyWentUp = function(key) {
  return this._isKeyInState(key, KEY_WENT_UP);
};

/**
* Detects if a key is currently pressed
* Like p5 keyIsDown but accepts strings and codes
*
* @method keyDown
* @param {Number|String} key Key code or character
* @return {Boolean} True if the key is down
*/
p5.prototype.keyDown = function(key) {
  return this._isKeyInState(key, KEY_IS_DOWN);
};

/**
 * Detects if a key is in the given state during the last cycle.
 * Helper method encapsulating common key state logic; it may be preferable
 * to call keyDown or other methods directly.
 *
 * @private
 * @method _isKeyInState
 * @param {Number|String} key Key code or character
 * @param {Number} state Key state to check against
 * @return {Boolean} True if the key is in the given state
 */
p5.prototype._isKeyInState = function(key, state) {
  var keyCode;
  var keyStates = this._p5play.keyStates;

  if(typeof key === 'string')
  {
    keyCode = this._keyCodeFromAlias(key);
  }
  else
  {
    keyCode = key;
  }

  //if undefined start checking it
  if(keyStates[keyCode]===undefined)
  {
    if(this.keyIsDown(keyCode))
      keyStates[keyCode] = KEY_IS_DOWN;
    else
      keyStates[keyCode] = KEY_IS_UP;
  }

  return (keyStates[keyCode] === state);
};

/**
* Detects if a mouse button is currently down
* Combines mouseIsPressed and mouseButton of p5
*
* @method mouseDown
* @param {Number} [buttonCode] Mouse button constant LEFT, RIGHT or CENTER
* @return {Boolean} True if the button is down
*/
p5.prototype.mouseDown = function(buttonCode) {
  return this._isMouseButtonInState(buttonCode, KEY_IS_DOWN);
};

/**
* Detects if a mouse button is currently up
* Combines mouseIsPressed and mouseButton of p5
*
* @method mouseUp
* @param {Number} [buttonCode] Mouse button constant LEFT, RIGHT or CENTER
* @return {Boolean} True if the button is up
*/
p5.prototype.mouseUp = function(buttonCode) {
  return this._isMouseButtonInState(buttonCode, KEY_IS_UP);
};

/**
 * Detects if a mouse button was released during the last cycle.
 * It can be used to trigger events once, to be checked in the draw cycle
 *
 * @method mouseWentUp
 * @param {Number} [buttonCode] Mouse button constant LEFT, RIGHT or CENTER
 * @return {Boolean} True if the button was just released
 */
p5.prototype.mouseWentUp = function(buttonCode) {
  return this._isMouseButtonInState(buttonCode, KEY_WENT_UP);
};


/**
 * Detects if a mouse button was pressed during the last cycle.
 * It can be used to trigger events once, to be checked in the draw cycle
 *
 * @method mouseWentDown
 * @param {Number} [buttonCode] Mouse button constant LEFT, RIGHT or CENTER
 * @return {Boolean} True if the button was just pressed
 */
p5.prototype.mouseWentDown = function(buttonCode) {
  return this._isMouseButtonInState(buttonCode, KEY_WENT_DOWN);
};

/**
 * Detects if a mouse button is in the given state during the last cycle.
 * Helper method encapsulating common mouse button state logic; it may be
 * preferable to call mouseWentUp, etc, directly.
 *
 * @private
 * @method _isMouseButtonInState
 * @param {Number} [buttonCode] Mouse button constant LEFT, RIGHT or CENTER
 * @param {Number} state
 * @return {boolean} True if the button was in the given state
 */
p5.prototype._isMouseButtonInState = function(buttonCode, state) {
  var mouseStates = this._p5play.mouseStates;

  if(buttonCode === undefined)
    buttonCode = this.LEFT;

  //undefined = not tracked yet, start tracking
  if(mouseStates[buttonCode]===undefined)
  {
  if(this.mouseIsPressed && this.mouseButton === buttonCode)
    mouseStates[buttonCode] = KEY_IS_DOWN;
  else
    mouseStates[buttonCode] = KEY_IS_UP;
  }

  return (mouseStates[buttonCode] === state);
};


/**
 * An object storing all useful keys for easy access
 * Key.tab = 9
 *
 * @private
 * @property KEY
 * @type {Object}
 */
p5.prototype.KEY = {
    'BACKSPACE': 8,
    'TAB': 9,
    'ENTER': 13,
    'SHIFT': 16,
    'CTRL': 17,
    'ALT': 18,
    'PAUSE': 19,
    'CAPS_LOCK': 20,
    'ESC': 27,
    'SPACE': 32,
    ' ': 32,
    'PAGE_UP': 33,
    'PAGE_DOWN': 34,
    'END': 35,
    'HOME': 36,
    'LEFT_ARROW': 37,
    'LEFT': 37,
    'UP_ARROW': 38,
    'UP': 38,
    'RIGHT_ARROW': 39,
    'RIGHT': 39,
    'DOWN_ARROW': 40,
    'DOWN': 40,
    'INSERT': 45,
    'DELETE': 46,
    '0': 48,
    '1': 49,
    '2': 50,
    '3': 51,
    '4': 52,
    '5': 53,
    '6': 54,
    '7': 55,
    '8': 56,
    '9': 57,
    'A': 65,
    'B': 66,
    'C': 67,
    'D': 68,
    'E': 69,
    'F': 70,
    'G': 71,
    'H': 72,
    'I': 73,
    'J': 74,
    'K': 75,
    'L': 76,
    'M': 77,
    'N': 78,
    'O': 79,
    'P': 80,
    'Q': 81,
    'R': 82,
    'S': 83,
    'T': 84,
    'U': 85,
    'V': 86,
    'W': 87,
    'X': 88,
    'Y': 89,
    'Z': 90,
    '0NUMPAD': 96,
    '1NUMPAD': 97,
    '2NUMPAD': 98,
    '3NUMPAD': 99,
    '4NUMPAD': 100,
    '5NUMPAD': 101,
    '6NUMPAD': 102,
    '7NUMPAD': 103,
    '8NUMPAD': 104,
    '9NUMPAD': 105,
    'MULTIPLY': 106,
    'PLUS': 107,
    'MINUS': 109,
    'DOT': 110,
    'SLASH1': 111,
    'F1': 112,
    'F2': 113,
    'F3': 114,
    'F4': 115,
    'F5': 116,
    'F6': 117,
    'F7': 118,
    'F8': 119,
    'F9': 120,
    'F10': 121,
    'F11': 122,
    'F12': 123,
    'EQUAL': 187,
    'COMMA': 188,
    'SLASH': 191,
    'BACKSLASH': 220
};

/**
 * An object storing deprecated key aliases, which we still support but
 * should be mapped to valid aliases and generate warnings.
 *
 * @private
 * @property KEY_DEPRECATIONS
 * @type {Object}
 */
p5.prototype.KEY_DEPRECATIONS = {
  'MINUT': 'MINUS',
  'COMA': 'COMMA'
};

/**
 * Given a string key alias (as defined in the KEY property above), look up
 * and return the numeric JavaScript key code for that key.  If a deprecated
 * alias is passed (as defined in the KEY_DEPRECATIONS property) it will be
 * mapped to a valid key code, but will also generate a warning about use
 * of the deprecated alias.
 *
 * @private
 * @method _keyCodeFromAlias
 * @param {!string} alias - a case-insensitive key alias
 * @return {number|undefined} a numeric JavaScript key code, or undefined
 *          if no key code matching the given alias is found.
 */
p5.prototype._keyCodeFromAlias = function(alias) {
  alias = alias.toUpperCase();
  if (this.KEY_DEPRECATIONS[alias]) {
    this._warn('Key literal "' + alias + '" is deprecated and may be removed ' +
      'in a future version of p5.play. ' +
      'Please use "' + this.KEY_DEPRECATIONS[alias] + '" instead.');
    alias = this.KEY_DEPRECATIONS[alias];
  }
  return this.KEY[alias];
};

//pre draw: detect keyStates
p5.prototype.readPresses = function() {
  var keyStates = this._p5play.keyStates;
  var mouseStates = this._p5play.mouseStates;

  for (var key in keyStates) {
    if(this.keyIsDown(key)) //if is down
    {
      if(keyStates[key] === KEY_IS_UP)//and was up
        keyStates[key] = KEY_WENT_DOWN;
      else
        keyStates[key] = KEY_IS_DOWN; //now is simply down
    }
    else //if it's up
    {
      if(keyStates[key] === KEY_IS_DOWN)//and was up
        keyStates[key] = KEY_WENT_UP;
      else
        keyStates[key] = KEY_IS_UP; //now is simply down
    }
  }

  //mouse
  for (var btn in mouseStates) {

    if(this.mouseIsPressed && this.mouseButton === btn) //if is down
    {
      if(mouseStates[btn] === KEY_IS_UP)//and was up
        mouseStates[btn] = KEY_WENT_DOWN;
      else
        mouseStates[btn] = KEY_IS_DOWN; //now is simply down
    }
    else //if it's up
    {
      if(mouseStates[btn] === KEY_IS_DOWN)//and was up
        mouseStates[btn] = KEY_WENT_UP;
      else
        mouseStates[btn] = KEY_IS_UP; //now is simply down
    }
  }

};

/**
* Turns the quadTree on or off.
* A quadtree is a data structure used to optimize collision detection.
* It can improve performance when there is a large number of Sprites to be
* checked continuously for overlapping.
*
* p5.play will create and update a quadtree automatically.
*
* @method useQuadTree
* @param {Boolean} use Pass true to enable, false to disable
*/
p5.prototype.useQuadTree = function(use) {

  if(this.quadTree !== undefined)
  {
    if(use === undefined)
      return this.quadTree.active;
    else if(use)
      this.quadTree.active = true;
    else
      this.quadTree.active = false;
  }
  else
    return false;
};

//the actual quadTree
defineLazyP5Property('quadTree', function() {
  return new Quadtree({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  }, 4);
});

/*
//framerate independent delta, doesn't really work
p5.prototype.deltaTime = 1;

var now = Date.now();
var then = Date.now();
var INTERVAL_60 = 0.0166666; //60 fps

function updateDelta() {
then = now;
now = Date.now();
deltaTime = ((now - then) / 1000)/INTERVAL_60; // seconds since last frame
}
*/

/**
   * A Sprite is the main building block of p5.play:
   * an element able to store images or animations with a set of
   * properties such as position and visibility.
   * A Sprite can have a collider that defines the active area to detect
   * collisions or overlappings with other sprites and mouse interactions.
   *
   * To create a Sprite, use
   * {{#crossLink "p5.play/createSprite:method"}}{{/crossLink}}.
   *
   * @class Sprite
   */

// For details on why these docs aren't in a YUIDoc comment block, see:
//
// https://github.com/molleindustria/p5.play/pull/67
//
// @param {Number} x Initial x coordinate
// @param {Number} y Initial y coordinate
// @param {Number} width Width of the placeholder rectangle and of the
//                       collider until an image or new collider are set
// @param {Number} height Height of the placeholder rectangle and of the
//                        collider until an image or new collider are set
function Sprite(pInst, _x, _y, _w, _h) {
  var pInstBind = createPInstBinder(pInst);

  var createVector = pInstBind('createVector');
  var color = pInstBind('color');
  var random = pInstBind('random');
  var print = pInstBind('print');
  var push = pInstBind('push');
  var pop = pInstBind('pop');
  var colorMode = pInstBind('colorMode');
  var noStroke = pInstBind('noStroke');
  var rectMode = pInstBind('rectMode');
  var ellipseMode = pInstBind('ellipseMode');
  var imageMode = pInstBind('imageMode');
  var translate = pInstBind('translate');
  var scale = pInstBind('scale');
  var rotate = pInstBind('rotate');
  var stroke = pInstBind('stroke');
  var strokeWeight = pInstBind('strokeWeight');
  var line = pInstBind('line');
  var noFill = pInstBind('noFill');
  var fill = pInstBind('fill');
  var textAlign = pInstBind('textAlign');
  var textSize = pInstBind('textSize');
  var text = pInstBind('text');
  var rect = pInstBind('rect');
  var cos = pInstBind('cos');
  var sin = pInstBind('sin');
  var atan2 = pInstBind('atan2');

  var quadTree = pInst.quadTree;
  var camera = pInst.camera;


  // These are p5 constants that we'd like easy access to.
  var RGB = p5.prototype.RGB;
  var CENTER = p5.prototype.CENTER;
  var LEFT = p5.prototype.LEFT;
  var BOTTOM = p5.prototype.BOTTOM;

  /**
  * The sprite's position of the sprite as a vector (x,y).
  * @property position
  * @type {p5.Vector}
  */
  this.position = createVector(_x, _y);

  /**
  * The sprite's position at the beginning of the last update as a vector (x,y).
  * @property previousPosition
  * @type {p5.Vector}
  */
  this.previousPosition = createVector(_x, _y);

  /*
  The sprite's position at the end of the last update as a vector (x,y).
  Note: this will differ from position whenever the position is changed
  directly by assignment.
  */
  this.newPosition = createVector(_x, _y);

  //Position displacement on the x coordinate since the last update
  this.deltaX = 0;
  this.deltaY = 0;

  /**
  * The sprite's velocity as a vector (x,y)
  * Velocity is speed broken down to its vertical and horizontal components.
  *
  * @property velocity
  * @type {p5.Vector}
  */
  this.velocity = createVector(0, 0);

  /**
  * Set a limit to the sprite's scalar speed regardless of the direction.
  * The value can only be positive. If set to -1, there's no limit.
  *
  * @property maxSpeed
  * @type {Number}
  * @default -1
  */
  this.maxSpeed = -1;

  /**
  * Friction factor, reduces the sprite's velocity.
  * The friction should be close to 0 (eg. 0.01)
  * 0: no friction
  * 1: full friction
  *
  * @property friction
  * @type {Number}
  * @default 0
  */
  this.friction = 0;

  /**
  * The sprite's current collider.
  * It can either be an Axis Aligned Bounding Box (a non-rotated rectangle)
  * or a circular collider.
  * If the sprite is checked for collision, bounce, overlapping or mouse events the
  * collider is automatically created from the width and height
  * of the sprite or from the image dimension in case of animate sprites
  *
  * You can set a custom collider with Sprite.setCollider
  *
  * @property collider
  * @type {Object}
  */
  this.collider = undefined;

  //internal use
  //"default" - no image or custom collider is specified, use the shape width / height
  //"custom" - specified with setCollider
  //"image" - no collider is set with setCollider and an image is added
  this.colliderType = 'none';

  /**
  * Object containing information about the most recent collision/overlapping
  * To be typically used in combination with Sprite.overlap or Sprite.collide
  * functions.
  * The properties are touching.left, touching.right, touching.top,
  * touching.bottom and are either true or false depending on the side of the
  * collider.
  *
  * @property touching
  * @type {Object}
  */
  this.touching = {};
  this.touching.left = false;
  this.touching.right = false;
  this.touching.top = false;
  this.touching.bottom = false;

  /**
  * The mass determines the velocity transfer when sprites bounce
  * against each other. See Sprite.bounce
  * The higher the mass the least the sprite will be affected by collisions.
  *
  * @property mass
  * @type {Number}
  * @default 1
  */
  this.mass = 1;

  /**
  * If set to true the sprite won't bounce or be displaced by collisions
  * Simulates an infinite mass or an anchored object.
  *
  * @property immovable
  * @type {Boolean}
  * @default false
  */
  this.immovable = false;

  //Coefficient of restitution - velocity lost in the bouncing
  //0 perfectly inelastic , 1 elastic, > 1 hyper elastic

  /**
  * Coefficient of restitution. The velocity lost after bouncing.
  * 1: perfectly elastic, no energy is lost
  * 0: perfectly inelastic, no bouncing
  * less than 1: inelastic, this is the most common in nature
  * greater than 1: hyper elastic, energy is increased like in a pinball bumper
  *
  * @property restitution
  * @type {Number}
  * @default 1
  */
  this.restitution = 1;

  /**
  * Rotation in degrees of the visual element (image or animation)
  * Note: this is not the movement's direction, see getDirection.
  *
  * @property rotation
  * @type {Number}
  * @default 0
  */
  Object.defineProperty(this, 'rotation', {
    enumerable: true,
    get: function() {
      return this._rotation;
    },
    set: function(value) {
      this._rotation = value;
      if (this.rotateToDirection) {
        this.setSpeed(this.getSpeed(), value);
      }
    }
  });

  /**
  * Internal rotation variable (expressed in degrees).
  * Note: external callers access this through the rotation property above.
  *
  * @private
  * @property _rotation
  * @type {Number}
  * @default 0
  */
  this._rotation = 0;

  /**
  * Rotation change in degrees per frame of thevisual element (image or animation)
  * Note: this is not the movement's direction, see getDirection.
  *
  * @property rotationSpeed
  * @type {Number}
  * @default 0
  */
  this.rotationSpeed = 0;


  /**
  * Automatically lock the rotation property of the visual element
  * (image or animation) to the sprite's movement direction and vice versa.
  *
  * @property rotateToDirection
  * @type {Boolean}
  * @default false
  */
  this.rotateToDirection = false;


  /**
  * Determines the rendering order within a group: a sprite with
  * lower depth will appear below the ones with higher depth.
  *
  * Note: drawing a group before another with drawSprites will make
  * its members appear below the second one, like in normal p5 canvas
  * drawing.
  *
  * @property depth
  * @type {Number}
  * @default One more than the greatest existing sprite depth, when calling
  *          createSprite().  When calling new Sprite() directly, depth will
  *          initialize to 0 (not recommended).
  */
  this.depth = 0;

  /**
  * Determines the sprite's scale.
  * Example: 2 will be twice the native size of the visuals,
  * 0.5 will be half. Scaling up may make images blurry.
  *
  * @property scale
  * @type {Number}
  * @default 1
  */
  this.scale = 1;

  var dirX = 1;
  var dirY = 1;

  /**
  * The sprite's visibility.
  *
  * @property visible
  * @type {Boolean}
  * @default true
  */
  this.visible = true;

  /**
  * If set to true sprite will track its mouse state.
  * the properties mouseIsPressed and mouseIsOver will be updated.
  * Note: automatically set to true if the functions
  * onMouseReleased or onMousePressed are set.
  *
  * @property mouseActive
  * @type {Boolean}
  * @default false
  */
  this.mouseActive = false;

  /**
  * True if mouse is on the sprite's collider.
  * Read only.
  *
  * @property mouseIsOver
  * @type {Boolean}
  */
  this.mouseIsOver = false;

  /**
  * True if mouse is pressed on the sprite's collider.
  * Read only.
  *
  * @property mouseIsPressed
  * @type {Boolean}
  */
  this.mouseIsPressed = false;

  /*
  * Width of the sprite's current image.
  * If no images or animations are set it's the width of the
  * placeholder rectangle.
  * Used internally to make calculations and draw the sprite.
  *
  * @private
  * @property _internalWidth
  * @type {Number}
  * @default 100
  */
  this._internalWidth = _w;

  /*
  * Height of the sprite's current image.
  * If no images or animations are set it's the height of the
  * placeholder rectangle.
  * Used internally to make calculations and draw the sprite.
  *
  * @private
  * @property _internalHeight
  * @type {Number}
  * @default 100
  */
  this._internalHeight = _h;

  /*
   * _internalWidth and _internalHeight are used for all p5.play
   * calculations, but width and height can be extended. For example,
   * you may want users to always get and set a scaled width:
      Object.defineProperty(this, 'width', {
        enumerable: true,
        configurable: true,
        get: function() {
          return this._internalWidth * this.scale;
        },
        set: function(value) {
          this._internalWidth = value / this.scale;
        }
      });
   */

  /**
  * Width of the sprite's current image.
  * If no images or animations are set it's the width of the
  * placeholder rectangle.
  *
  * @property width
  * @type {Number}
  * @default 100
  */
  Object.defineProperty(this, 'width', {
    enumerable: true,
    configurable: true,
    get: function() {
      return this._internalWidth;
    },
    set: function(value) {
      this._internalWidth = value;
    }
  });

  if(_w === undefined)
    this.width = 100;
  else
    this.width = _w;

  /**
  * Height of the sprite's current image.
  * If no images or animations are set it's the height of the
  * placeholder rectangle.
  *
  * @property height
  * @type {Number}
  * @default 100
  */
  Object.defineProperty(this, 'height', {
    enumerable: true,
    configurable: true,
    get: function() {
      return this._internalHeight;
    },
    set: function(value) {
      this._internalHeight = value;
    }
  });

  if(_h === undefined)
    this.height = 100;
  else
    this.height = _h;

  /**
  * Unscaled width of the sprite
  * If no images or animations are set it's the width of the
  * placeholder rectangle.
  *
  * @property originalWidth
  * @type {Number}
  * @default 100
  */
  this.originalWidth = this._internalWidth;

  /**
  * Unscaled height of the sprite
  * If no images or animations are set it's the height of the
  * placeholder rectangle.
  *
  * @property originalHeight
  * @type {Number}
  * @default 100
  */
  this.originalHeight = this._internalHeight;

  /**
  * True if the sprite has been removed.
  *
  * @property removed
  * @type {Boolean}
  */
  this.removed = false;

  /**
  * Cycles before self removal.
  * Set it to initiate a countdown, every draw cycle the property is
  * reduced by 1 unit. At 0 it will call a sprite.remove()
  * Disabled if set to -1.
  *
  * @property life
  * @type {Number}
  * @default -1
  */
  this.life = -1;

  /**
  * If set to true, draws an outline of the collider, the depth, and center.
  *
  * @property debug
  * @type {Boolean}
  * @default false
  */
  this.debug = false;

  /**
  * If no image or animations are set this is color of the
  * placeholder rectangle
  *
  * @property shapeColor
  * @type {color}
  */
  this.shapeColor = color(random(255), random(255), random(255));

  /**
  * Groups the sprite belongs to, including allSprites
  *
  * @property groups
  * @type {Array}
  */
  this.groups = [];

  var animations = {};

  //The current animation's label.
  var currentAnimation = '';

  /**
  * Reference to the current animation.
  *
  * @property animation
  * @type {Animation}
  */
  this.animation = undefined;

  /*
   * @private
   * Keep animation properties in sync with how the animation changes.
   */
  this._syncAnimationSizes = function(animations, currentAnimation) {
    //has an animation but the collider is still default
    //the animation wasn't loaded. if the animation is not a 1x1 image
    //it means it just finished loading
    if(this.colliderType === 'default' &&
      animations[currentAnimation].getWidth() !== 1 && animations[currentAnimation].getHeight() !== 1)
    {
      this.collider = this.getBoundingBox();
      this.colliderType = 'image';
      this._internalWidth = animations[currentAnimation].getWidth()*abs(this._getScaleX());
      this._internalHeight = animations[currentAnimation].getHeight()*abs(this._getScaleY());
      //quadTree.insert(this);
    }

    //update size and collider
    if(animations[currentAnimation].frameChanged || this.width === undefined || this.height === undefined)
    {
      //this.collider = this.getBoundingBox();
      this._internalWidth = animations[currentAnimation].getWidth()*abs(this._getScaleX());
      this._internalHeight = animations[currentAnimation].getHeight()*abs(this._getScaleY());
    }
  };

  /**
  * Updates the sprite.
  * Called automatically at the beginning of the draw cycle.
  *
  * @method update
  */
  this.update = function() {

    if(!this.removed)
    {
      //if there has been a change somewhere after the last update
      //the old position is the last position registered in the update
      if(this.newPosition !== this.position)
        this.previousPosition = createVector(this.newPosition.x, this.newPosition.y);
      else
        this.previousPosition = createVector(this.position.x, this.position.y);

      this.velocity.x *= 1 - this.friction;
      this.velocity.y *= 1 - this.friction;

      if(this.maxSpeed !== -1)
        this.limitSpeed(this.maxSpeed);

      if(this.rotateToDirection && this.velocity.mag() > 0)
        this._rotation = this.getDirection();

      this.rotation += this.rotationSpeed;

      this.position.x += this.velocity.x;
      this.position.y += this.velocity.y;

      this.newPosition = createVector(this.position.x, this.position.y);

      this.deltaX = this.position.x - this.previousPosition.x;
      this.deltaY = this.position.y - this.previousPosition.y;

      //if there is an animation
      if(animations[currentAnimation])
      {
        //update it
        animations[currentAnimation].update();

        this._syncAnimationSizes(animations, currentAnimation);
      }

      //a collider is created either manually with setCollider or
      //when I check this sprite for collisions or overlaps
      if (this.collider) {
        this.collider.updateFromSprite(this);
      }

      //mouse actions
      if (this.mouseActive)
      {
        //if no collider set it
          if(!this.collider)
            this.setDefaultCollider();

        this.mouseUpdate();
      }
      else
      {
        if (typeof(this.onMouseOver) === 'function' ||
            typeof(this.onMouseOut) === 'function' ||
            typeof(this.onMousePressed) === 'function' ||
            typeof(this.onMouseReleased) === 'function')
        {
          //if a mouse function is set
          //it's implied we want to have it mouse active so
          //we do this automatically
          this.mouseActive = true;

          //if no collider set it
          if(!this.collider)
            this.setDefaultCollider();

          this.mouseUpdate();
        }
      }

      //self destruction countdown
      if (this.life>0)
        this.life--;
      if (this.life === 0)
        this.remove();
    }
  };//end update

  /**
   * Creates a default collider matching the size of the
   * placeholder rectangle or the bounding box of the image.
   *
   * @method setDefaultCollider
   */
  this.setDefaultCollider = function() {
    if(animations[currentAnimation] && animations[currentAnimation].getWidth() === 1 && animations[currentAnimation].getHeight() === 1) {
      //animation is still loading
      return;
    }

    //if has animation get the animation bounding box
    //working only for preloaded images
    if(animations[currentAnimation]) {
      this.setCollider('rectangle');
      this._internalWidth = animations[currentAnimation].getWidth()*abs(this._getScaleX());
      this._internalHeight = animations[currentAnimation].getHeight()*abs(this._getScaleY());
      this.colliderType = 'image';
    } else {
      this.setCollider('rectangle');
      this.colliderType = 'default';
    }

    pInst.quadTree.insert(this);
  };

  /**
   * Updates the sprite mouse states and triggers the mouse events:
   * onMouseOver, onMouseOut, onMousePressed, onMouseReleased
   *
   * @method mouseUpdate
   */
  this.mouseUpdate = function() {
    var mouseWasOver = this.mouseIsOver;
    var mouseWasPressed = this.mouseIsPressed;

    this.mouseIsOver = false;
    this.mouseIsPressed = false;

    //rollover
    if(this.collider) {
      var mousePosition;

      if(camera.active)
        mousePosition = createVector(camera.mouseX, camera.mouseY);
      else
        mousePosition = createVector(pInst.mouseX, pInst.mouseY);

      this.mouseIsOver = this.collider.overlap(new CollisionPoint(mousePosition));

      //global p5 var
      if(this.mouseIsOver && pInst.mouseIsPressed)
        this.mouseIsPressed = true;

      //event change - call functions
      if(!mouseWasOver && this.mouseIsOver && this.onMouseOver !== undefined)
        if(typeof(this.onMouseOver) === 'function')
          this.onMouseOver.call(this, this);
        else
          print('Warning: onMouseOver should be a function');

      if(mouseWasOver && !this.mouseIsOver && this.onMouseOut !== undefined)
        if(typeof(this.onMouseOut) === 'function')
          this.onMouseOut.call(this, this);
        else
          print('Warning: onMouseOut should be a function');

      if(!mouseWasPressed && this.mouseIsPressed && this.onMousePressed !== undefined)
        if(typeof(this.onMousePressed) === 'function')
          this.onMousePressed.call(this, this);
        else
          print('Warning: onMousePressed should be a function');

      if(mouseWasPressed && !pInst.mouseIsPressed && !this.mouseIsPressed && this.onMouseReleased !== undefined)
        if(typeof(this.onMouseReleased) === 'function')
          this.onMouseReleased.call(this, this);
        else
          print('Warning: onMouseReleased should be a function');

    }
  };

  /**
  * Sets a collider for the sprite.
  *
  * In p5.play a Collider is an invisible circle or rectangle
  * that can have any size or position relative to the sprite and which
  * will be used to detect collisions and overlapping with other sprites,
  * or the mouse cursor.
  *
  * If the sprite is checked for collision, bounce, overlapping or mouse events
  * a collider is automatically created from the width and height parameter
  * passed at the creation of the sprite or the from the image dimension in case
  * of animated sprites.
  *
  * Often the image bounding box is not appropriate as the active area for
  * collision detection so you can set a circular or rectangular sprite with
  * different dimensions and offset from the sprite's center.
  *
  * There are four ways to call this method:
  *
  * 1. setCollider("rectangle")
  * 2. setCollider("rectangle", offsetX, offsetY, width, height)
  * 3. setCollider("circle")
  * 4. setCollider("circle", offsetX, offsetY, radius)
  *
  * @method setCollider
  * @param {String} type Either "rectangle" or "circle"
  * @param {Number} offsetX Collider x position from the center of the sprite
  * @param {Number} offsetY Collider y position from the center of the sprite
  * @param {Number} width Collider width or radius
  * @param {Number} height Collider height
  * @param {Number} rotation Collider rotation in degrees
  * @throws {TypeError} if given invalid parameters.
  */
  this.setCollider = function(type, offsetX, offsetY, width, height, rotation) {
    var _type = type.toLowerCase();
    if (_type === 'rectangle') {
      // Map 'rectangle' to AABB.  Change this if you want it to default to OBB.
      _type = 'aabb';
    }

    // Check correct arguments, provide context-sensitive usage message if wrong.
    if (!(_type === 'point' || _type === 'circle' || _type === 'obb' || _type === 'aabb')) {
      throw new TypeError('setCollider expects the first argument to be one of "point", "circle", "rectangle", "aabb" or "obb"');
    } else if (_type === 'point' && !(arguments.length === 1 || arguments.length === 3)) {
      throw new TypeError('Usage: setCollider("' + type + '"[, offsetX, offsetY])');
    } else if (_type === 'circle' && !(arguments.length === 1 || arguments.length === 3 || arguments.length === 4)) {
      throw new TypeError('Usage: setCollider("' + type + '"[, offsetX, offsetY[, radius]])');
    } else if (_type === 'aabb' && !(arguments.length === 1 || arguments.length === 3 || arguments.length === 5)) {
      throw new TypeError('Usage: setCollider("' + type + '"[, offsetX, offsetY[, width, height]])');
    } else if (_type === 'obb' && !(arguments.length === 1 || arguments.length === 3 || arguments.length === 5 || arguments.length === 6)) {
      throw new TypeError('Usage: setCollider("' + type + '"[, offsetX, offsetY[, width, height[, rotation]]])');
    }

    var center = this.position;
    if (width === undefined) {
      if (_type === 'circle') {
        width = Math.max(this.width, this.height);
      } else {
        width = this.width;
      }
    }
    if (height === undefined) {
      height = this.height;
    }
    var offset = createVector(offsetX, offsetY);
    this.colliderType = 'custom';

    if (_type === 'point') {
      this.collider = new CollisionPoint(center, offset);
    } else if (_type === 'circle') {
      this.collider = new CollisionCircle(Math.floor(width / 2), center, offset);
    } else if (_type === 'aabb') {
      this.collider = new AxisAlignedBoundingBox(width, height, center, offset);
    } else if (_type === 'obb') {
      if (rotation === undefined) {
        rotation = this.rotation;
      }
      this.collider = new OrientedBoundingBox(width, height, center, radians(rotation), offset);
    }

    quadTree.insert(this);
  };

  /**
   * Returns a the bounding box of the current image
   * @method getBoundingBox
   */
  this.getBoundingBox = function() {
    // TODO: Figure out how this is used, what can we replace it with?
    var w = animations[currentAnimation].getWidth()*abs(this._getScaleX());
    var h = animations[currentAnimation].getHeight()*abs(this._getScaleY());

    //if the bounding box is 1x1 the image is not loaded
    //potential issue with actual 1x1 images
    if(w === 1 && h === 1) {
      //not loaded yet
      return new AABB(pInst, this.position, createVector(w, h));
    }
    else {
      return new AABB(pInst, this.position, createVector(w, h));
    }
  };

  /**
  * Sets the sprite's horizontal mirroring.
  * If 1 the images displayed normally
  * If -1 the images are flipped horizontally
  * If no argument returns the current x mirroring
  *
  * @method mirrorX
  * @param {Number} dir Either 1 or -1
  * @return {Number} Current mirroring if no parameter is specified
  */
  this.mirrorX = function(dir) {
    if(dir === 1 || dir === -1)
      dirX = dir;
    else
      return dirX;
  };

  /**
  * Sets the sprite's vertical mirroring.
  * If 1 the images displayed normally
  * If -1 the images are flipped vertically
  * If no argument returns the current y mirroring
  *
  * @method mirrorY
  * @param {Number} dir Either 1 or -1
  * @return {Number} Current mirroring if no parameter is specified
  */
  this.mirrorY = function(dir) {
    if(dir === 1 || dir === -1)
      dirY = dir;
    else
      return dirY;
  };

  /*
   * Returns the value the sprite should be scaled in the X direction.
   * Used to calculate rendering and collisions.
   * @private
   */
  this._getScaleX = function()
  {
    return this.scale;
  };

  /*
   * Returns the value the sprite should be scaled in the Y direction.
   * Used to calculate rendering and collisions.
   * @private
   */
  this._getScaleY = function()
  {
    return this.scale;
  };

  /**
   * Manages the positioning, scale and rotation of the sprite
   * Called automatically, it should not be overridden
   * @private
   * @final
   * @method display
   */
  this.display = function()
  {
    if (this.visible && !this.removed)
    {
      push();
      colorMode(RGB);

      noStroke();
      rectMode(CENTER);
      ellipseMode(CENTER);
      imageMode(CENTER);

      translate(this.position.x, this.position.y);
      scale(this._getScaleX()*dirX, this._getScaleY()*dirY);
      if (pInst._angleMode === pInst.RADIANS) {
        rotate(radians(this.rotation));
      } else {
        rotate(this.rotation);
      }
      this.draw();
      //draw debug info
      pop();


      if(this.debug)
      {
        push();
        //draw the anchor point
        stroke(0, 255, 0);
        strokeWeight(1);
        line(this.position.x-10, this.position.y, this.position.x+10, this.position.y);
        line(this.position.x, this.position.y-10, this.position.x, this.position.y+10);
        noFill();

        //depth number
        noStroke();
        fill(0, 255, 0);
        textAlign(LEFT, BOTTOM);
        textSize(16);
        text(this.depth+'', this.position.x+4, this.position.y-2);

        noFill();
        stroke(0, 255, 0);

        // Draw collision shape
        if(this.collider) {
          this.collider.draw(pInst);
        }
        pop();
      }

    }
  };


  /**
  * Manages the visuals of the sprite.
  * It can be overridden with a custom drawing function.
  * The 0,0 point will be the center of the sprite.
  * Example:
  * sprite.draw = function() { ellipse(0,0,10,10) }
  * Will display the sprite as circle.
  *
  * @method draw
  */
  this.draw = function()
  {
    if(currentAnimation !== '' && animations)
    {
      if(animations[currentAnimation])
        animations[currentAnimation].draw(0, 0, 0);
    }
    else
    {
      noStroke();
      fill(this.shapeColor);
      rect(0, 0, this._internalWidth, this._internalHeight);
    }
  };

  /**
   * Removes the Sprite from the sketch.
   * The removed Sprite won't be drawn or updated anymore.
   *
   * @method remove
   */
  this.remove = function() {
    this.removed = true;

    quadTree.removeObject(this);

    //when removed from the "scene" also remove all the references in all the groups
    while (this.groups.length > 0) {
      this.groups[0].remove(this);
    }
  };

  /**
  * Sets the velocity vector.
  *
  * @method setVelocity
  * @param {Number} x X component
  * @param {Number} y Y component
  */
  this.setVelocity = function(x, y) {
    this.velocity.x = x;
    this.velocity.y = y;
  };

  /**
  * Calculates the scalar speed.
  *
  * @method getSpeed
  * @return {Number} Scalar speed
  */
  this.getSpeed = function() {
    return this.velocity.mag();
  };

  /**
  * Calculates the movement's direction in degrees.
  *
  * @method getDirection
  * @return {Number} Angle in degrees
  */
  this.getDirection = function() {

    var direction = atan2(this.velocity.y, this.velocity.x);

    if(isNaN(direction))
      direction = 0;

    // Unlike Math.atan2, the atan2 method above will return degrees if
    // the current p5 angleMode is DEGREES, and radians if the p5 angleMode is
    // RADIANS.  This method should always return degrees (for now).
    // See https://github.com/molleindustria/p5.play/issues/94
    if (pInst._angleMode === pInst.RADIANS) {
      direction = degrees(direction);
    }

    return direction;
  };

  /**
  * Adds the sprite to an existing group
  *
  * @method addToGroup
  * @param {Object} group
  */
  this.addToGroup = function(group) {
    if(group instanceof Array)
      group.add(this);
    else
      print('addToGroup error: '+group+' is not a group');
  };

  /**
  * Limits the scalar speed.
  *
  * @method limitSpeed
  * @param {Number} max Max speed: positive number
  */
  this.limitSpeed = function(max) {

    //update linear speed
    var speed = this.getSpeed();

    if(abs(speed)>max)
    {
      //find reduction factor
      var k = max/abs(speed);
      this.velocity.x *= k;
      this.velocity.y *= k;
    }
  };

  /**
  * Set the speed and direction of the sprite.
  * The action overwrites the current velocity.
  * If direction is not supplied, the current direction is maintained.
  * If direction is not supplied and there is no current velocity, the current
  * rotation angle used for the direction.
  *
  * @method setSpeed
  * @param {Number}  speed Scalar speed
  * @param {Number}  [angle] Direction in degrees
  */
  this.setSpeed = function(speed, angle) {
    var a;
    if (typeof angle === 'undefined') {
      if (this.velocity.x !== 0 || this.velocity.y !== 0) {
        a = pInst.atan2(this.velocity.y, this.velocity.x);
      } else {
        if (pInst._angleMode === pInst.RADIANS) {
          a = radians(this._rotation);
        } else {
          a = this._rotation;
        }
      }
    } else {
      if (pInst._angleMode === pInst.RADIANS) {
        a = radians(angle);
      } else {
        a = angle;
      }
    }
    this.velocity.x = cos(a)*speed;
    this.velocity.y = sin(a)*speed;
  };

  /**
  * Pushes the sprite in a direction defined by an angle.
  * The force is added to the current velocity.
  *
  * @method addSpeed
  * @param {Number}  speed Scalar speed to add
  * @param {Number}  angle Direction in degrees
  */
  this.addSpeed = function(speed, angle) {
    var a;
    if (pInst._angleMode === pInst.RADIANS) {
      a = radians(angle);
    } else {
      a = angle;
    }
    this.velocity.x += cos(a) * speed;
    this.velocity.y += sin(a) * speed;
  };

  /**
  * Pushes the sprite toward a point.
  * The force is added to the current velocity.
  *
  * @method attractionPoint
  * @param {Number}  magnitude Scalar speed to add
  * @param {Number}  pointX Direction x coordinate
  * @param {Number}  pointY Direction y coordinate
  */
  this.attractionPoint = function(magnitude, pointX, pointY) {
    var angle = atan2(pointY-this.position.y, pointX-this.position.x);
    this.velocity.x += cos(angle) * magnitude;
    this.velocity.y += sin(angle) * magnitude;
  };


  /**
  * Adds an image to the sprite.
  * An image will be considered a one-frame animation.
  * The image should be preloaded in the preload() function using p5 loadImage.
  * Animations require a identifying label (string) to change them.
  * The image is stored in the sprite but not necessarily displayed
  * until Sprite.changeAnimation(label) is called
  *
  * Usages:
  * - sprite.addImage(label, image);
  * - sprite.addImage(image);
  *
  * If only an image is passed no label is specified
  *
  * @method addImage
  * @param {String|p5.Image} label Label or image
  * @param {p5.Image} [img] Image
  */
  this.addImage = function()
  {
    if(typeof arguments[0] === 'string' && arguments[1] instanceof p5.Image)
      this.addAnimation(arguments[0], arguments[1]);
    else if(arguments[0] instanceof p5.Image)
      this.addAnimation('normal', arguments[0]);
    else
      throw('addImage error: allowed usages are <image> or <label>, <image>');
  };

  /**
  * Adds an animation to the sprite.
  * The animation should be preloaded in the preload() function
  * using loadAnimation.
  * Animations require a identifying label (string) to change them.
  * Animations are stored in the sprite but not necessarily displayed
  * until Sprite.changeAnimation(label) is called.
  *
  * Usage:
  * - sprite.addAnimation(label, animation);
  *
  * Alternative usages. See Animation for more information on file sequences:
  * - sprite.addAnimation(label, firstFrame, lastFrame);
  * - sprite.addAnimation(label, frame1, frame2, frame3...);
  *
  * @method addAnimation
  * @param {String} label Animation identifier
  * @param {Animation} animation The preloaded animation
  */
  this.addAnimation = function(label)
  {
    var anim;

    if(typeof label !== 'string')
    {
      print('Sprite.addAnimation error: the first argument must be a label (String)');
      return -1;
    }
    else if(arguments.length < 2)
    {
      print('addAnimation error: you must specify a label and n frame images');
      return -1;
    }
    else if(arguments[1] instanceof Animation)
    {

      var sourceAnimation = arguments[1];

      var newAnimation = sourceAnimation.clone();

      animations[label] = newAnimation;

      if(currentAnimation === '')
      {
        currentAnimation = label;
        this.animation = newAnimation;
      }

      newAnimation.isSpriteAnimation = true;

      this._internalWidth = newAnimation.getWidth()*abs(this._getScaleX());
      this._internalHeight = newAnimation.getHeight()*abs(this._getScaleY());

      return newAnimation;
    }
    else
    {
      var animFrames = [];
      for(var i=1; i<arguments.length; i++)
        animFrames.push(arguments[i]);

      anim = construct(pInst.Animation, animFrames);
      animations[label] = anim;

      if(currentAnimation === '')
      {
        currentAnimation = label;
        this.animation = anim;
      }
      anim.isSpriteAnimation = true;

      this._internalWidth = anim.getWidth()*abs(this._getScaleX());
      this._internalHeight = anim.getHeight()*abs(this._getScaleY());

      return anim;
    }

  };

  /**
  * Changes the displayed image/animation.
  * Equivalent to changeAnimation
  *
  * @method changeImage
  * @param {String} label Image/Animation identifier
  */
  this.changeImage = function(label) {
    this.changeAnimation(label);
  };

   /**
  * Returns the label of the current animation
  *
  * @method getAnimationLabel
  * @return {String} label Image/Animation identifier
  */
  this.getAnimationLabel = function() {
    return currentAnimation;
  };

  /**
  * Changes the displayed animation.
  * See Animation for more control over the sequence.
  *
  * @method changeAnimation
  * @param {String} label Animation identifier
  */
  this.changeAnimation = function(label) {
    if(!animations[label])
      print('changeAnimation error: no animation labeled '+label);
    else
    {
      currentAnimation = label;
      this.animation = animations[label];
    }
  };

  /**
  * Checks if the given point corresponds to a transparent pixel
  * in the sprite's current image. It can be used to check a point collision
  * against only the visible part of the sprite.
  *
  * @method overlapPixel
  * @param {Number} pointX x coordinate of the point to check
  * @param {Number} pointY y coordinate of the point to check
  * @return {Boolean} result True if non-transparent
  */
  this.overlapPixel = function(pointX, pointY) {
    var point = createVector(pointX, pointY);

    var img = this.animation.getFrameImage();

    //convert point to img relative position
    point.x -= this.position.x-img.width/2;
    point.y -= this.position.y-img.height/2;

    //out of the image entirely
    if(point.x<0 || point.x>img.width || point.y<0 || point.y>img.height)
      return false;
    else if(this.rotation === 0 && this.scale === 1)
    {
      //true if full opacity
      var values = img.get(point.x, point.y);
      return values[3] === 255;
    }
    else
    {
      print('Error: overlapPixel doesn\'t work with scaled or rotated sprites yet');
      //offscreen printing to be implemented bleurch
      return false;
    }
  };

  /**
  * Checks if the given point is inside the sprite's collider.
  *
  * @method overlapPoint
  * @param {Number} pointX x coordinate of the point to check
  * @param {Number} pointY y coordinate of the point to check
  * @return {Boolean} result True if inside
  */
  this.overlapPoint = function(pointX, pointY) {
    if(!this.collider)
      this.setDefaultCollider();

    if(this.collider) {
      var point = new CollisionPoint(new p5.Vector(pointX, pointY));
      return this.collider.overlap(point);
    }
    return false;
  };


  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occours.
  * If the target is a group the function will be called for each single
  * sprite overlapping. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.overlap(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method overlap
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.overlap = function(target, callback) {
    return this.AABBops('overlap', target, callback);
  };

  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * If the overlap is positive the current sprite will be displace by
  * the colliding one in the closest non-overlapping position.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the collision occours.
  * If the target is a group the function will be called for each single
  * sprite colliding. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.collide(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method collide
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.collide = function(target, callback) {
    return this.AABBops('collide', target, callback);
  };

  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * If the overlap is positive the current sprite will displace
  * the colliding one to the closest non-overlapping position.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the collision occours.
  * If the target is a group the function will be called for each single
  * sprite colliding. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.displace(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method displace
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.displace = function(target, callback) {
    return this.AABBops('displace', target, callback);
  };

  /**
  * Checks if the the sprite is overlapping another sprite or a group.
  * If the overlap is positive the sprites will bounce affecting each
  * other's trajectories depending on their .velocity, .mass and .restitution
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the collision occours.
  * If the target is a group the function will be called for each single
  * sprite colliding. The parameter of the function are respectively the
  * current sprite and the colliding sprite.
  *
  * @example
  *     sprite.bounce(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method bounce
  * @param {Object} target Sprite or group to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  this.bounce = function(target, callback) {
    return this.AABBops('bounce', target, callback);
  };

  // Internal collision detection function. Do not use directly.
  this.AABBops = function(type, target, callback) {

    this.touching.left = false;
    this.touching.right = false;
    this.touching.top = false;
    this.touching.bottom = false;

    var result = false;

    //if single sprite turn into array anyway
    var others = [];

    if(target instanceof Sprite)
      others.push(target);
    else if(target instanceof Array)
    {
      if(quadTree !== undefined && quadTree.active)
        others = quadTree.retrieveFromGroup( this, target);

      if(others.length === 0)
        others = target;

    }
    else
      throw('Error: overlap can only be checked between sprites or groups');

    for(var i=0; i<others.length; i++) {
      if (this !== others[i] && !this.removed) //you can check collisions within the same group but not on itself
      {
        var other = others[i];

        if (this.collider === undefined)
          this.setDefaultCollider();

        if (other.collider === undefined)
          other.setDefaultCollider();


        if (!this.collider || !other.collider) {
          // Can't check this collision (yet); Continue.
        } else {
          var displacement = this.collider.collide(other.collider);
          if (displacement.x === 0 && displacement.y === 0) {
            // These sprites are not overlapping; Continue.
          } else {
            if (type === 'collide' || type === 'displace' || type === 'bounce') {
              if (type === 'displace' && !other.immovable) {
                other.position.sub(displacement);
              } else if ((type === 'collide' || type === 'bounce') && !this.immovable) {
                this.position.add(displacement);
                this.previousPosition = createVector(this.position.x, this.position.y);
                this.newPosition = createVector(this.position.x, this.position.y);
              }

              if (displacement.x > 0)
                this.touching.left = true;
              if (displacement.x < 0)
                this.touching.right = true;
              if (displacement.y < 0)
                this.touching.bottom = true;
              if (displacement.y > 0)
                this.touching.top = true;

              if (type === 'bounce') {
                var dx1 = displacement.copy();
                var dx2 = p5.Vector.mult(dx1, -1);
                var magnitude = dx1.magSq();
                var totalMass = this.mass + other.mass;
                var m1 = 0, m2 = 0;
                if (this.immovable) {
                  m2 = 2;
                } else if (other.immovable) {
                  m1 = 2;
                } else {
                  m1 = 2 * other.mass / totalMass;
                  m2 = 2 * this.mass / totalMass;
                }
                var newVel1 = dx1.mult(m1 * p5.Vector.sub(this.velocity, other.velocity).dot(dx1) / magnitude);
                var newVel2 = dx2.mult(m2 * p5.Vector.sub(other.velocity, this.velocity).dot(dx2) / magnitude);

                this.velocity.sub(newVel1.mult(this.restitution));
                other.velocity.sub(newVel2.mult(other.restitution));
              }
            }

            // Finally, for all collision types call the callback and record
            // that collision occurred.
            result = true;
            if (typeof callback === 'function') {
              callback.call(this, this, other);
            }
          }
        }
      }
    }

    return result;
  };
} //end Sprite class

defineLazyP5Property('Sprite', boundConstructorFactory(Sprite));

/**
   * A camera facilitates scrolling and zooming for scenes extending beyond
   * the canvas. A camera has a position, a zoom factor, and the mouse
   * coordinates relative to the view.
   * The camera is automatically created on the first draw cycle.
   *
   * In p5.js terms the camera wraps the whole drawing cycle in a
   * transformation matrix but it can be disable anytime during the draw
   * cycle for example to draw interface elements in an absolute position.
   *
   * @class Camera
   * @constructor
   * @param {Number} x Initial x coordinate
   * @param {Number} y Initial y coordinate
   * @param {Number} zoom magnification
   **/
function Camera(pInst, x, y, zoom) {
  /**
  * Camera position. Defines the global offset of the sketch.
  *
  * @property position
  * @type {p5.Vector}
  */
  this.position = pInst.createVector(x, y);

  /**
  * Camera zoom. Defines the global scale of the sketch.
  * A scale of 1 will be the normal size. Setting it to 2 will make everything
  * twice the size. .5 will make everything half size.
  *
  * @property zoom
  * @type {Number}
  */
  this.zoom = zoom;

  /**
  * MouseX translated to the camera view.
  * Offsetting and scaling the canvas will not change the sprites' position
  * nor the mouseX and mouseY variables. Use this property to read the mouse
  * position if the camera moved or zoomed.
  *
  * @property mouseX
  * @type {Number}
  */
  this.mouseX = pInst.mouseX;

  /**
  * MouseY translated to the camera view.
  * Offsetting and scaling the canvas will not change the sprites' position
  * nor the mouseX and mouseY variables. Use this property to read the mouse
  * position if the camera moved or zoomed.
  *
  * @property mouseY
  * @type {Number}
  */
  this.mouseY = pInst.mouseY;

  /**
  * True if the camera is active.
  * Read only property. Use the methods Camera.on() and Camera.off()
  * to enable or disable the camera.
  *
  * @property active
  * @type {Boolean}
  */
  this.active = false;

  /**
  * Activates the camera.
  * The canvas will be drawn according to the camera position and scale until
  * Camera.off() is called
  *
  * @method on
  */
  this.on = function() {
    if(!this.active)
    {
      cameraPush.call(pInst);
      this.active = true;
    }
  };

  /**
  * Deactivates the camera.
  * The canvas will be drawn normally, ignoring the camera's position
  * and scale until Camera.on() is called
  *
  * @method off
  */
  this.off = function() {
    if(this.active)
    {
      cameraPop.call(pInst);
      this.active = false;
    }
  };
} //end camera class

defineLazyP5Property('Camera', boundConstructorFactory(Camera));

//called pre draw by default
function cameraPush() {
  var pInst = this;
  var camera = pInst.camera;

  //awkward but necessary in order to have the camera at the center
  //of the canvas by default
  if(!camera.init && camera.position.x === 0 && camera.position.y === 0)
    {
    camera.position.x=pInst.width/2;
    camera.position.y=pInst.height/2;
    camera.init = true;
    }

  camera.mouseX = pInst.mouseX+camera.position.x-pInst.width/2;
  camera.mouseY = pInst.mouseY+camera.position.y-pInst.height/2;

  if(!camera.active)
  {
    camera.active = true;
    pInst.push();
    pInst.scale(camera.zoom);
    pInst.translate(-camera.position.x+pInst.width/2/camera.zoom, -camera.position.y+pInst.height/2/camera.zoom);
  }
}

//called postdraw by default
function cameraPop() {
  var pInst = this;

  if(pInst.camera.active)
  {
    pInst.pop();
    pInst.camera.active = false;
  }
}




/**
   * In p5.play groups are collections of sprites with similar behavior.
   * For example a group may contain all the sprites in the background
   * or all the sprites that "kill" the player.
   *
   * Groups are "extended" arrays and inherit all their properties
   * e.g. group.length
   *
   * Since groups contain only references, a sprite can be in multiple
   * groups and deleting a group doesn't affect the sprites themselves.
   *
   * Sprite.remove() will also remove the sprite from all the groups
   * it belongs to.
   *
   * @class Group
   * @constructor
   */
function Group() {

  //basically extending the array
  var array = [];

  /**
  * Gets the member at index i.
  *
  * @method get
  * @param {Number} i The index of the object to retrieve
  */
  array.get = function(i) {
    return array[i];
  };

  /**
  * Checks if the group contains a sprite.
  *
  * @method contains
  * @param {Sprite} sprite The sprite to search
  * @return {Number} Index or -1 if not found
  */
  array.contains = function(sprite) {
    return this.indexOf(sprite)>-1;
  };

  /**
   * Same as Group.contains
   * @method indexOf
   */
  array.indexOf = function(item) {
    for (var i = 0, len = array.length; i < len; ++i) {
      if (virtEquals(item, array[i])) {
        return i;
      }
    }
    return -1;
  };

  /**
  * Adds a sprite to the group.
  *
  * @method add
  * @param {Sprite} s The sprite to be added
  */
  array.add = function(s) {
    if(!(s instanceof Sprite)) {
      throw('Error: you can only add sprites to a group');
    }

    if (-1 === this.indexOf(s)) {
      array.push(s);
      s.groups.push(this);
    }
  };

  /**
   * Same as group.length
   * @method size
   */
  array.size = function() {
    return array.length;
  };

  /**
  * Removes all the sprites in the group
  * from the scene.
  *
  * @method removeSprites
  */
  array.removeSprites = function() {
    while (array.length > 0) {
      array[0].remove();
    }
  };

  /**
  * Removes all references to the group.
  * Does not remove the actual sprites.
  *
  * @method clear
  */
  array.clear = function() {
    array.length = 0;
  };

  /**
  * Removes a sprite from the group.
  * Does not remove the actual sprite, only the affiliation (reference).
  *
  * @method remove
  * @param {Sprite} item The sprite to be removed
  * @return {Boolean} True if sprite was found and removed
  */
  array.remove = function(item) {
    if(!(item instanceof Sprite)) {
      throw('Error: you can only remove sprites from a group');
    }

    var i, removed = false;
    for (i = array.length - 1; i >= 0; i--) {
      if (array[i] === item) {
        array.splice(i, 1);
        removed = true;
      }
    }

    if (removed) {
      for (i = item.groups.length - 1; i >= 0; i--) {
        if (item.groups[i] === this) {
          item.groups.splice(i, 1);
        }
      }
    }

    return removed;
  };

  /**
   * Returns a copy of the group as standard array.
   * @method toArray
   */
  array.toArray = function() {
    return array.slice(0);
  };

  /**
  * Returns the highest depth in a group
  *
  * @method maxDepth
  * @return {Number} The depth of the sprite drawn on the top
  */
  array.maxDepth = function() {
    if (array.length === 0) {
      return 0;
    }

    return array.reduce(function(maxDepth, sprite) {
      return Math.max(maxDepth, sprite.depth);
    }, -Infinity);
  };

  /**
  * Returns the lowest depth in a group
  *
  * @method minDepth
  * @return {Number} The depth of the sprite drawn on the bottom
  */
  array.minDepth = function() {
    if (array.length === 0) {
      return 99999;
    }

    return array.reduce(function(minDepth, sprite) {
      return Math.min(minDepth, sprite.depth);
    }, Infinity);
  };

  /**
  * Draws all the sprites in the group.
  *
  * @method draw
  */
  array.draw = function() {

    //sort by depth
    this.sort(function(a, b) {
      return a.depth - b.depth;
    });

    for(var i = 0; i<this.size(); i++)
    {
      this.get(i).display();
    }
  };

  //internal use
  function virtEquals(obj, other) {
    if (obj === null || other === null) {
      return (obj === null) && (other === null);
    }
    if (typeof (obj) === 'string') {
      return obj === other;
    }
    if (typeof(obj) !== 'object') {
      return obj === other;
    }
    if (obj.equals instanceof Function) {
      return obj.equals(other);
    }
    return obj === other;
  }

  /**
   * Collide each member of group against the target using the given collision
   * type.  Return true if any collision occurred.
   * Internal use
   *
   * @private
   * @method _groupCollide
   * @param {!string} type one of 'overlap', 'collide', 'displace', 'bounce'
   * @param {Object} target Group or Sprite
   * @param {Function} [callback] on collision.
   * @return {boolean} True if any collision/overlap occurred
   */
  function _groupCollide(type, target, callback) {
    var didCollide = false;
    for(var i = 0; i<this.size(); i++)
      didCollide = this.get(i).AABBops(type, target, callback) || didCollide;
    return didCollide;
  }

  /**
  * Checks if the the group is overlapping another group or sprite.
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occurs.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.overlap(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method overlap
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.overlap = _groupCollide.bind(array, 'overlap');


  /**
  * Checks if the the group is overlapping another group or sprite.
  * If the overlap is positive the sprites in the group will be displaced
  * by the colliding one to the closest non-overlapping positions.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occours.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.collide(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method collide
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.collide = _groupCollide.bind(array, 'collide');

  /**
  * Checks if the the group is overlapping another group or sprite.
  * If the overlap is positive the sprites in the group will displace
  * the colliding ones to the closest non-overlapping positions.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occurs.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.displace(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method displace
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.displace = _groupCollide.bind(array, 'displace');

  /**
  * Checks if the the group is overlapping another group or sprite.
  * If the overlap is positive the sprites will bounce affecting each
  * other's trajectories depending on their .velocity, .mass and .restitution.
  *
  * The check is performed using the colliders. If colliders are not set
  * they will be created automatically from the image/animation bounding box.
  *
  * A callback function can be specified to perform additional operations
  * when the overlap occours.
  * The function will be called for each single sprite overlapping.
  * The parameter of the function are respectively the
  * member of the current group and the other sprite passed as parameter.
  *
  * @example
  *     group.bounce(otherSprite, explosion);
  *
  *     function explosion(spriteA, spriteB) {
  *       spriteA.remove();
  *       spriteB.score++;
  *     }
  *
  * @method bounce
  * @param {Object} target Group or Sprite to check against the current one
  * @param {Function} [callback] The function to be called if overlap is positive
  * @return {Boolean} True if overlapping
  */
  array.bounce = _groupCollide.bind(array, 'bounce');

  return array;
}

p5.prototype.Group = Group;

/**
 * Collision Shape Base Class
 *
 * We have a set of collision shapes available that all conform to
 * a simple interface so that they can be checked against one another
 * using the Separating Axis Theorem.
 *
 * This base class implements all the required methods for a collision
 * shape and can be used as a collision point with no changes.
 * Other shapes should inherit from this and override most methods.
 *
 * @class CollisionShape
 * @constructor
 * @param {p5.Vector} center
 */
function CollisionShape(center) {
  /**
   * The center of the collision shape.
   * @property center
   * @type {p5.Vector}
   */
  this.center = center;
}
p5.CollisionShape = CollisionShape;

/**
 * Debug-draw this collider
 * @method draw
 * @param {p5} sketch instance to use for drawing
 */
CollisionShape.prototype.draw = function(sketch) {
  sketch.push();
  sketch.rectMode(sketch.CENTER);
  sketch.translate(this.center.x, this.center.y);
  sketch.noStroke();
  sketch.fill(0, 255, 0);
  sketch.ellipse(0, 0, 2, 2);
  sketch.pop();
};

/**
 * Update this collider's dimensions, position, rotation to match
 * the given sprite (probably one we're attached to) then recompute
 * if necessary.
 * @method updateFromSprite
 * @param {Sprite} sprite
 */
CollisionShape.prototype.updateFromSprite = function(sprite) {
  this.center = sprite.position;
};

/**
 * Compute the smallest movement needed to move this collision shape out of
 * another collision shape.  If the shapes are not overlapping, returns a
 * zero vector to indicate that no displacement is necessary.
 * @method collide
 * @param {CollisionShape} other
 * @return {p5.Vector}
 */
CollisionShape.prototype.collide = function(other) {
  var displacee = this, displacer = other;

  // Compute a displacement vector using the Separating Axis Theorem
  // (Valid only for convex shapes)
  //
  // If a line (axis) exists on which the two shapes' orthogonal projections
  // do not overlap, then the shapes do not overlap.  If the shapes'
  // projections do overlap on all candidate axes, the axis that had the
  // smallest overlap gives us the smallest possible displacement.
  //
  // @see http://www.dyn4j.org/2010/01/sat/
  var smallestOverlap = Infinity;
  var smallestOverlapAxis = null;

  // We speed things up with an additional assumption that all collision
  // shapes are centrosymmetric: Circles, ellipses, and rectangles
  // are OK.  This lets us only compare the shapes' radii to the
  // distance between their centers, even for non-circular shapes.
  // Other convex shapes, (triangles, pentagons) will require more
  // complex use of their projections' positions on the axis.
  var deltaOfCenters = p5.Vector.sub(displacer.center, displacee.center);

  // It turns out we only need to check a few axes, defined by the shapes
  // being checked.  For a polygon, the normal of each face is a possible
  // separating axis.
  var candidateAxes = deduplicateParallelVectors(displacee._getCandidateAxes(displacer).concat(displacer._getCandidateAxes(displacee)));
  var axis, deltaOfCentersOnAxis, distanceOfCentersOnAxis;
  for (var i = 0; i < candidateAxes.length; i++) {
    axis = candidateAxes[i];

    // If distance between the shape's centers as projected onto the
    // separating axis is larger than the combined radii of the shapes
    // projected onto the axis, the shapes do not overlap on this axis.
    deltaOfCentersOnAxis = p5.Vector.project(deltaOfCenters, axis);
    distanceOfCentersOnAxis = deltaOfCentersOnAxis.mag();
    var overlap = displacee._getRadiusOnAxis(axis) + displacer._getRadiusOnAxis(axis) - distanceOfCentersOnAxis;
    if (overlap <= 0) {
      // These shapes are separated along this axis.
      // Early-out, returning a zero-vector displacement.
      return new p5.Vector();
    } else if (overlap < smallestOverlap) {
      // This is the smallest overlap we've found so far - store some
      // information about it, which we can use to give the smallest
      // displacement when we're done.
      smallestOverlap = overlap;
      smallestOverlapAxis = deltaOfCentersOnAxis;
    }
  }

  // If we make it here, we overlap on all possible axes and we
  // can compute the smallest vector that will displace this out of other.
  return smallestOverlapAxis.setMag(-smallestOverlap);
};

/**
 * Check whether this shape overlaps another.
 * @method overlap
 * @param {CollisionShape} other
 * @return {boolean}
 */
CollisionShape.prototype.overlap = function(other) {
  var displacement = this.collide(other);
  return displacement.x !== 0 || displacement.y !== 0;
};

/*
 * Remove duplicate elements from an array without changing its order.
 * @param {Array.<p5.Vector>} array
 * @return {Array}
 */
function deduplicateParallelVectors(array) {
  return array.filter(function(item, itemPos) {
    return !array.some(function(other, otherPos) {
      return itemPos < otherPos && item.isParallel(other);
    });
  });
}

/**
 * Compute candidate separating axes relative to another object.
 * Override this method in subclasses to implement collision behavior.
 * @method _getCandidateAxes
 * @protected
 * @return {Array.<p5.Vector>}
 */
CollisionShape.prototype._getCandidateAxes = function() {
  return [];
};

/**
 * Get this shape's radius (half-width of its projection) along the given axis.
 * Override this method in subclasses to implement collision behavior.
 * @method _getRadiusOnAxis
 * @protected
 * @param {p5.Vector} axis
 * @return {number}
 */
CollisionShape.prototype._getRadiusOnAxis = function() {
  return 0;
};

/**
 * A point collision shape, used to detect overlap and displacement vectors
 * vs other collision shapes.
 * @class CollisionPoint
 * @constructor
 * @extends CollisionShape
 * @param {p5.Vector} center
 */
function CollisionPoint(center) {
  CollisionShape.call(this, center);
}
CollisionPoint.prototype = Object.create(CollisionShape.prototype);
p5.CollisionPoint = CollisionPoint;

/**
 * A Circle collision shape, used to detect overlap and displacement vectors
 * with other collision shapes.
 * @class CollisionCircle
 * @constructor
 * @extends CollisionShape
 * @param {number} radius
 * @param {p5.Vector} center
 */
function CollisionCircle(radius, center) {
  CollisionShape.call(this, center);

  /**
   * The radius of the circle collider.
   * @property radius
   * @type {number}
   */
  this.radius = radius;
}
CollisionCircle.prototype = Object.create(CollisionShape.prototype);
p5.CollisionCircle = CollisionCircle;

/**
 * Update this collider's dimensions and position to match the given sprite.
 * @method updateFromSprite
 * @param {Sprite} sprite
 */
CollisionCircle.prototype.updateFromSprite = function(sprite) {
  // TODO: Does this handle scale properly?
  // TODO: Let this collider store offsets, applied here.
  this.radius = Math.floor(abs(sprite.scale) * Math.max(sprite.width, sprite.height) / 2);
  this.center = sprite.position;
};

/**
 * Debug-draw this collision shape.
 * @method draw
 * @param {p5} sketch instance to use for drawing
 */
CollisionCircle.prototype.draw = function(sketch) {
  sketch.push();
  sketch.noFill();
  sketch.stroke(0, 255, 0);
  sketch.rectMode(sketch.CENTER);
  sketch.ellipse(this.center.x, this.center.y, this.radius*2, this.radius*2);
  sketch.pop();
};

/**
 * Compute candidate separating axes relative to another object.
 * @method _getCandidateAxes
 * @protected
 * @param {OrientedBoundingBox} other
 * @return {Array.<p5.Vector>}
 */
CollisionCircle.prototype._getCandidateAxes = function(other) {
  // A circle has infinite potential candidate axes, so the ones we pick
  // depend on what we're colliding against.

  // TODO: Could generalize these two cases to other.vertices.map(v => sub(v, this.center))
  if (other instanceof OrientedBoundingBox || other instanceof AxisAlignedBoundingBox) {
    // There are four possible separating axes with a box - one for each
    // of its vertices, through the center of the circle.
    // TODO: Can we optimize and only check the nearest vertex?
    var halfDiagonals = other.halfDiagonals;
    return [
      p5.Vector.sub(p5.Vector.add(other.center, halfDiagonals[0]), this.center),
      p5.Vector.sub(p5.Vector.add(other.center, halfDiagonals[1]), this.center),
      p5.Vector.sub(p5.Vector.sub(other.center, halfDiagonals[0]), this.center),
      p5.Vector.sub(p5.Vector.sub(other.center, halfDiagonals[1]), this.center)
    ];
  }

  // When checking against another circle or a point we only need to check the
  // axis through both shapes' centers.
  return [
    p5.Vector.sub(other.center, this.center)
  ];
};

/**
 * Get this shape's radius (half-width of its projection) along the given axis.
 * @method _getRadiusOnAxis
 * @protected
 * @return {number}
 */
CollisionCircle.prototype._getRadiusOnAxis = function() {
  // For a circle, this is _always_ just the radius.
  return this.radius;
};

/**
 * An Axis-Aligned Bounding Box (AABB) collision shape, used to detect overlap
 * and compute minimum displacement vectors with other collision shapes.
 * Cannot be rotated - hence the name.  You might use this in place of an
 * OBB because it simplifies some of the math and may improve performance.
 * @class AxisAlignedBoundingBox
 * @constructor
 * @extends CollisionShape
 * @param {number} width
 * @param {number} height
 * @param {p5.Vector} center
 */
function AxisAlignedBoundingBox(width, height, center) {
  CollisionShape.call(this, center);

  /* @private {number} Box width. */
  this._width = width;
  /* @private {number} Box height. */
  this._height = height;
  /* @private {Array.<p5.Vector>} Cached half-diagonals, for use computing a projected radius. */
  this._halfDiagonals = this._computeHalfDiagonals();

  Object.defineProperties(this, {

    /**
     * The unrotated width of the box collider.
     * Recomputes diagonals when set.
     * @property width
     * @type {number}
     */
    'width': {
      enumerable: true,
      get: function() {
        return this._width;
      }.bind(this),
      set: function(w) {
        this._width = w;
        this._halfDiagonals = this._computeHalfDiagonals();
      }.bind(this)
    },

    /**
     * The unrotated height of the box collider.
     * Recomputes diagonals when set.
     * @property height
     * @type {number}
     */
    'height': {
      enumerable: true,
      get: function() {
        return this._height;
      }.bind(this),
      set: function(h) {
        this._height = h;
        this._halfDiagonals = this._computeHalfDiagonals();
      }.bind(this)
    },

    /**
     * Two vectors representing adjacent half-diagonals of the box at its
     * current dimensions and orientation.
     * @property halfDiagonals
     * @readOnly
     * @type {Array.<p5.Vector>}
     */
    'halfDiagonals': {
      enumerable: true,
      get: function() {
        return this._halfDiagonals;
      }.bind(this)
    }
  });
}
AxisAlignedBoundingBox.prototype = Object.create(CollisionShape.prototype);
p5.AxisAlignedBoundingBox = AxisAlignedBoundingBox;

/**
 * @property WORLD_AXES
 * @type {Array.<p5.Vector>}
 * @static
 * @final
 */
AxisAlignedBoundingBox.WORLD_AXES = [
  new p5.Vector(1, 0),
  new p5.Vector(0, 1)
];

/**
 * Recompute this bounding box's half-diagonal vectors.
 * @method _computeHalfDiagonals
 * @private
 * @return {Array.<p5.Vector>}
 */
AxisAlignedBoundingBox.prototype._computeHalfDiagonals = function() {
  // For an axis-aligned rectangle this is the halfwidth vector x halfheight vector.
  var halfWidth = p5.Vector.mult(AxisAlignedBoundingBox.WORLD_AXES[0], this._width / 2);
  var halfHeight = p5.Vector.mult(AxisAlignedBoundingBox.WORLD_AXES[1], this._height / 2);
  return [
    p5.Vector.add(halfWidth, halfHeight),
    p5.Vector.sub(halfWidth, halfHeight)
  ];
};

/**
 * Update this collider's dimensions, position, rotation to match
 * the given sprite (probably one we're attached to) then recompute
 * if necessary.
 * @method updateFromSprite
 * @param {Sprite} sprite
 */
AxisAlignedBoundingBox.prototype.updateFromSprite = function(sprite) {
  // TODO: How do we handle the sprite scale property here?
  // TODO: Let this collider store offsets, applied here.
  // TODO: Handle rotated sprite - expand box to contain it.
  var oldWidth = this._width;
  var oldHeight = this._height;
  this._width = sprite.width;
  this._height = sprite.height;
  this.center = sprite.position;
  this._rotation = radians(sprite.rotation);
  if (this._width !== oldWidth || this._height !== oldHeight) {
    this._halfDiagonals = this._computeHalfDiagonals();
  }
};

/**
 * Debug-draw this collider.
 * @method draw
 * @param {p5} sketch - p5 instance to use for drawing
 */
AxisAlignedBoundingBox.prototype.draw = function(sketch) {
  sketch.push();
  sketch.rectMode(sketch.CENTER);
  sketch.translate(this.center.x, this.center.y);
  sketch.noFill();
  sketch.stroke(0, 255, 0);
  sketch.strokeWeight(1);
  sketch.rect(0, 0, this._width, this._height);
  sketch.pop();
};

/**
 * Compute candidate separating axes relative to another object.
 * @method _getCandidateAxes
 * @protected
 * @return {Array.<p5.Vector>}
 */
AxisAlignedBoundingBox.prototype._getCandidateAxes = function() {
  return AxisAlignedBoundingBox.WORLD_AXES;
};

/**
 * Get this shape's radius (half-width of its projection) along the given axis.
 * @method _getRadiusOnAxis
 * @protected
 * @param {p5.Vector} axis
 * @return {number}
 */
AxisAlignedBoundingBox.prototype._getRadiusOnAxis = function(axis) {
  // How to project a rect onto an axis:
  // Project the center-corner vectors for two adjacent corners (cached here)
  // onto the axis.  The larger magnitude of the two is your projection's radius.
  return Math.max(
    p5.Vector.project(this._halfDiagonals[0], axis).mag(),
    p5.Vector.project(this._halfDiagonals[1], axis).mag());
};

/**
 * An Oriented Bounding Box (OBB) collision shape, used to detect overlap and
 * compute minimum displacement vectors with other collision shapes.
 * @class OrientedBoundingBox
 * @constructor
 * @extends CollisionShape
 * @param {number} width of the rectangle (when not rotated)
 * @param {number} height of the rectangle (when not rotated)
 * @param {p5.Vector} center of the rectangle in world-space
 * @param {number} rotation about center, in radians
 */
function OrientedBoundingBox(width, height, center, rotation) {
  CollisionShape.call(this, center);

  /* @private {number} Unrotated box width. */
  this._width = width;
  /* @private {number} Unrotated box height. */
  this._height = height;
  /* @private {number} Box rotation in radians. */
  this._rotation = rotation;
  /* @private {Array.<p5.Vector>} Cached separating axes this shape contributes to a collision. */
  this._potentialAxes = this._computePotentialSeparatingAxes();
  /* @private {Array.<p5.Vector>} Cached half-diagonals, for use computing a projected radius. */
  this._halfDiagonals = this._computeHalfDiagonals();

  Object.defineProperties(this, {

    /**
     * The unrotated width of the box collider.
     * Recomputes diagonals when set.
     * @property width
     * @type {number}
     */
    'width': {
      enumerable: true,
      get: function() {
        return this._width;
      }.bind(this),
      set: function(w) {
        this._width = w;
        this._halfDiagonals = this._computeHalfDiagonals();
      }.bind(this)
    },

    /**
     * The unrotated height of the box collider.
     * Recomputes diagonals when set.
     * @property height
     * @type {number}
     */
    'height': {
      enumerable: true,
      get: function() {
        return this._height;
      }.bind(this),
      set: function(h) {
        this._height = h;
        this._halfDiagonals = this._computeHalfDiagonals();
      }.bind(this)
    },

    /**
     * The rotation of the box collider, in radians.
     * Recomputes diagonals and separating axes when set.
     * @property rotation
     * @type {number}
     */
    'rotation': {
      enumerable: true,
      get: function() {
        return this._rotation;
      }.bind(this),
      set: function(r) {
        this._rotation = r;
        this._halfDiagonals = this._computeHalfDiagonals();
        this._potentialAxes = this._computePotentialSeparatingAxes();
      }.bind(this)
    },

    /**
     * Two vectors representing adjacent half-diagonals of the box at its
     * current dimensions and orientation.
     * @property halfDiagonals
     * @readOnly
     * @type {Array.<p5.Vector>}
     */
    'halfDiagonals': {
      enumerable: true,
      get: function() {
        return this._halfDiagonals;
      }.bind(this)
    }
  });
}
OrientedBoundingBox.prototype = Object.create(CollisionShape.prototype);
p5.OrientedBoundingBox = OrientedBoundingBox;

/**
 * Recompute this bounding box's normals.
 * @method _computePotentialSeparatingAxes
 * @private
 * @return {Array.<p5.Vector>}
 */
OrientedBoundingBox.prototype._computePotentialSeparatingAxes = function() {
  // For a rect, its sides define separating axes.
  var widthAligned = p5.Vector.fromAngle(this._rotation);
  var heightAligned = new p5.Vector(widthAligned.y, -widthAligned.x);
  return [
    widthAligned,
    heightAligned
  ];
};

/**
 * Recompute this bounding box's half-diagonal vectors.
 * @method _computeHalfDiagonals
 * @private
 * @return {Array.<p5.Vector>}
 */
OrientedBoundingBox.prototype._computeHalfDiagonals = function() {
  // For a rectangle its projected radius can be determined by projecting two
  // adjacent diagonals (center-vertex) onto the axis and taking the larger
  // result.  Here we compute the diagonals, which don't change unless this
  // box changes.
  var halfWidth = p5.Vector.fromAngle(this._rotation).mult(this._width / 2);
  // Clockwise perpendicular rotation of <x, y> is <y, -x>
  // Should be faster than Vector.fromAngle because it requires no trig.
  var halfHeight = new p5.Vector(halfWidth.y, -halfWidth.x).setMag(this._height / 2);
  return [
    p5.Vector.add(halfWidth, halfHeight),
    p5.Vector.sub(halfWidth, halfHeight)
  ];
};

/**
 * Update this collider's dimensions, position, rotation to match
 * the given sprite (probably one we're attached to) then recompute
 * if necessary.
 * @method updateFromSprite
 * @param {Sprite} sprite
 */
OrientedBoundingBox.prototype.updateFromSprite = function(sprite) {
  // TODO: How do we handle the sprite scale property here?
  // TODO: Let this collider store offsets, applied here.
  var oldWidth = this._width;
  var oldHeight = this._height;
  var oldRotation = this._rotation;
  this._width = sprite.width;
  this._height = sprite.height;
  this.center = sprite.position;
  this._rotation = radians(sprite.rotation);
  if (this._rotation !== oldRotation) {
    this._potentialAxes = this._computePotentialSeparatingAxes();
    this._halfDiagonals = this._computeHalfDiagonals();
  } else if (this._width !== oldWidth || this._height !== oldHeight) {
    this._halfDiagonals = this._computeHalfDiagonals();
  }
};

/**
 * Debug-draw this collider.
 * @method draw
 * @param {p5} sketch - p5 instance to use for drawing
 */
OrientedBoundingBox.prototype.draw = function(sketch) {
  sketch.push();
  sketch.rectMode(sketch.CENTER);
  sketch.translate(this.center.x, this.center.y);
  if (sketch._angleMode === sketch.RADIANS) {
    sketch.rotate(this._rotation);
  } else {
    sketch.rotate(degrees(this._rotation));
  }
  sketch.noFill();
  sketch.stroke(0, 255, 0);
  sketch.strokeWeight(1);
  sketch.rect(0, 0, this._width, this._height);
  sketch.pop();
};

/**
 * Compute candidate separating axes relative to another object.
 * @method _getCandidateAxes
 * @protected
 * @return {Array.<p5.Vector>}
 */
OrientedBoundingBox.prototype._getCandidateAxes = function() {
  // An oriented bounding box always provides two of its face normals,
  // which we've precomputed.
  return this._potentialAxes;
};

/**
 * Get this shape's radius (half-width of its projection) along the given axis.
 * @method _getRadiusOnAxis
 * @protected
 * @param {p5.Vector} axis
 * @return {number}
 */
OrientedBoundingBox.prototype._getRadiusOnAxis = function(axis) {
  // How to project a rect onto an axis:
  // Project the center-corner vectors for two adjacent corners (cached here)
  // onto the axis.  The larger magnitude of the two is your projection's radius.
  return Math.max(
    p5.Vector.project(this._halfDiagonals[0], axis).mag(),
    p5.Vector.project(this._halfDiagonals[1], axis).mag());
};

/**
 * An Animation object contains a series of images (p5.Image) that
 * can be displayed sequentially.
 *
 * All files must be png images. You must include the directory from the sketch root,
 * and the extension .png
 *
 * A sprite can have multiple labeled animations, see Sprite.addAnimation
 * and Sprite.changeAnimation, however an animation can be used independently.
 *
 * An animation can be created either by passing a series of file names,
 * no matter how many or by passing the first and the last file name
 * of a numbered sequence.
 * p5.play will try to detect the sequence pattern.
 *
 * For example if the given filenames are
 * "data/file0001.png" and "data/file0005.png" the images
 * "data/file0003.png" and "data/file0004.png" will be loaded as well.
 *
 * @example
 *     var sequenceAnimation;
 *     var glitch;
 *
 *     function preload() {
 *       sequenceAnimation = loadAnimation("data/walking0001.png", "data/walking0005.png");
 *       glitch = loadAnimation("data/dog.png", "data/horse.png", "data/cat.png", "data/snake.png");
 *     }
 *
 *     function setup() {
 *       createCanvas(800, 600);
 *     }
 *
 *     function draw() {
 *       background(0);
 *       animation(sequenceAnimation, 100, 100);
 *       animation(glitch, 200, 100);
 *     }
 *
 * @class Animation
 * @constructor
 * @param {String} fileName1 First file in a sequence OR first image file
 * @param {String} fileName2 Last file in a sequence OR second image file
 * @param {String} [...fileNameN] Any number of image files after the first two
 */
function Animation(pInst) {
  var frameArguments = Array.prototype.slice.call(arguments, 1);
  var i;

  var CENTER = p5.prototype.CENTER;

  /**
  * Array of frames (p5.Image)
  *
  * @property images
  * @type {Array}
  */
  this.images = [];

  var frame = 0;
  var cycles = 0;
  var targetFrame = -1;

  this.offX = 0;
  this.offY = 0;

  /**
  * Delay between frames in number of draw cycles.
  * If set to 4 the framerate of the anymation would be the
  * sketch framerate divided by 4 (60fps = 15fps)
  *
  * @property frameDelay
  * @type {Number}
  * @default 2
  */
  this.frameDelay = 4;

  /**
  * True if the animation is currently playing.
  *
  * @property playing
  * @type {Boolean}
  * @default true
  */
  this.playing = true;

  /**
  * Animation visibility.
  *
  * @property visible
  * @type {Boolean}
  * @default true
  */
  this.visible = true;

  /**
  * If set to false the animation will stop after reaching the last frame
  *
  * @property looping
  * @type {Boolean}
  * @default true
  */
  this.looping = true;

  /**
  * True if frame changed during the last draw cycle
  *
  * @property frameChanged
  * @type {Boolean}
  */
  this.frameChanged = false;

  //is the collider defined manually or defined
  //by the current frame size
  this.imageCollider = false;


  //sequence mode
  if(frameArguments.length === 2 && typeof frameArguments[0] === 'string' && typeof frameArguments[1] === 'string')
  {
    var from = frameArguments[0];
    var to = frameArguments[1];

    //print("sequence mode "+from+" -> "+to);

    //make sure the extensions are fine
    var ext1 = from.substring(from.length-4, from.length);
    if(ext1 !== '.png')
    {
      pInst.print('Animation error: you need to use .png files (filename '+from+')');
      from = -1;
    }

    var ext2 = to.substring(to.length-4, to.length);
    if(ext2 !== '.png')
    {
      pInst.print('Animation error: you need to use .png files (filename '+to+')');
      to = -1;
    }

    //extensions are fine
    if(from !== -1 && to !== -1)
    {
      var digits1 = 0;
      var digits2 = 0;

      //skip extension work backwards to find the numbers
      for (i = from.length-5; i >= 0; i--) {
        if(from.charAt(i) >= '0' && from.charAt(i) <= '9')
          digits1++;
      }

      for (i = to.length-5; i >= 0; i--) {
        if(to.charAt(i) >= '0' && to.charAt(i) <= '9')
          digits2++;
      }

      var prefix1 = from.substring(0, from.length-(4+digits1));
      var prefix2 = to.substring(0, to.length-(4+digits2) );

      // Our numbers likely have leading zeroes, which means that some
      // browsers (e.g., PhantomJS) will interpret them as base 8 (octal)
      // instead of decimal. To fix this, we'll explicity tell parseInt to
      // use a base of 10 (decimal). For more details on this issue, see
      // http://stackoverflow.com/a/8763427/2422398.
      var number1 = parseInt(from.substring(from.length-(4+digits1), from.length-4), 10);
      var number2 = parseInt(to.substring(to.length-(4+digits2), to.length-4), 10);

      //swap if inverted
      if(number2<number1)
      {
        var t = number2;
        number2 = number1;
        number1 = t;
      }

      //two different frames
      if(prefix1 !== prefix2 )
      {
        //print("2 separate images");
        this.images.push(pInst.loadImage(from));
        this.images.push(pInst.loadImage(to));
      }
      //same digits: case img0001, img0002
      else
      {
        var fileName;
        if(digits1 === digits2)
        {

          //load all images
          for (i = number1; i <= number2; i++) {
            // Use nf() to number format 'i' into four digits
            fileName = prefix1 + pInst.nf(i, digits1) + '.png';
            this.images.push(pInst.loadImage(fileName));

          }

        }
        else //case: case img1, img2
        {
          //print("from "+prefix1+" "+number1 +" to "+number2);
          for (i = number1; i <= number2; i++) {
            // Use nf() to number format 'i' into four digits
            fileName = prefix1 + i + '.png';
            this.images.push(pInst.loadImage(fileName));

          }

        }
      }

    }//end no ext error

  }//end sequence mode
  // Sprite sheet mode
  else if (frameArguments.length === 1 && (frameArguments[0] instanceof SpriteSheet))
  {
    this.spriteSheet = frameArguments[0];
    this.images = this.spriteSheet.frames.map( function(f) {
      return f.frame;
    });
  }
  else if(frameArguments.length !== 0)//arbitrary list of images
  {
    //print("Animation arbitrary mode");
    for (i = 0; i < frameArguments.length; i++) {
      //print("loading "+fileNames[i]);
      if(frameArguments[i] instanceof p5.Image)
        this.images.push(frameArguments[i]);
      else
        this.images.push(pInst.loadImage(frameArguments[i]));
    }
  }

  /**
  * Objects are passed by reference so to have different sprites
  * using the same animation you need to clone it.
  *
  * @method clone
  * @return {Animation} A clone of the current animation
  */
  this.clone = function() {
    var myClone = new Animation(pInst); //empty
    myClone.images = [];

    if (this.spriteSheet) {
      myClone.spriteSheet = this.spriteSheet.clone();
    }
    myClone.images = this.images.slice();

    myClone.offX = this.offX;
    myClone.offY = this.offY;
    myClone.frameDelay = this.frameDelay;
    myClone.playing = this.playing;
    myClone.looping = this.looping;

    return myClone;
  };

  /**
   * Draws the animation at coordinate x and y.
   * Updates the frames automatically.
   *
   * @method draw
   * @param {Number} x x coordinate
   * @param {Number} y y coordinate
   * @param {Number} [r=0] rotation
   */
  this.draw = function(x, y, r) {
    this.xpos = x;
    this.ypos = y;
    this.rotation = r || 0;

    if (this.visible)
    {

      //only connection with the sprite class
      //if animation is used independently draw and update are the sam
      if(!this.isSpriteAnimation)
        this.update();

      //this.currentImageMode = g.imageMode;
      pInst.push();
      pInst.imageMode(CENTER);

      pInst.translate(this.xpos, this.ypos);
      if (pInst._angleMode === pInst.RADIANS) {
        pInst.rotate(radians(this.rotation));
      } else {
        pInst.rotate(this.rotation);
      }

      if(this.images[frame] !== undefined)
      {
        if (this.spriteSheet) {
          var frame_info = this.images[frame];
          pInst.image(this.spriteSheet.image, frame_info.x, frame_info.y, frame_info.width,
            frame_info.height, this.offX, this.offY, frame_info.width, frame_info.height);
        } else {
          pInst.image(this.images[frame], this.offX, this.offY);
        }
      }
      else
      {
        pInst.print('Warning undefined frame '+frame);
        //this.isActive = false;
      }

      pInst.pop();
    }
  };

  //called by draw
  this.update = function() {
    cycles++;
    var previousFrame = frame;
    this.frameChanged = false;


    //go to frame
    if(this.images.length === 1)
    {
      this.playing = false;
      frame = 0;
    }

    if ( this.playing && cycles%this.frameDelay === 0)
    {
      //going to target frame up
      if(targetFrame>frame && targetFrame !== -1)
      {
        frame++;
      }
      //going to taget frame down
      else if(targetFrame<frame && targetFrame !== -1)
      {
        frame--;
      }
      else if(targetFrame === frame && targetFrame !== -1)
      {
        this.playing=false;
      }
      else if (this.looping) //advance frame
      {
        //if next frame is too high
        if (frame>=this.images.length-1)
          frame = 0;
        else
          frame++;
      } else
      {
        //if next frame is too high
        if (frame<this.images.length-1)
          frame++;
      }
    }

    if(previousFrame !== frame)
      this.frameChanged = true;

  };//end update

  /**
  * Plays the animation.
  *
  * @method play
  */
  this.play = function() {
    this.playing = true;
    targetFrame = -1;
  };

  /**
  * Stops the animation.
  *
  * @method stop
  */
  this.stop = function(){
    this.playing = false;
  };

  /**
  * Rewinds the animation to the first frame.
  *
  * @method rewind
  */
  this.rewind = function() {
    frame = 0;
  };

  /**
  * Changes the current frame.
  *
  * @method changeFrame
  * @param {Number} frame Frame number (starts from 0).
  */
  this.changeFrame = function(f) {
    if (f<this.images.length)
      frame = f;
    else
      frame = this.images.length - 1;

    targetFrame = -1;
    //this.playing = false;
  };

   /**
  * Goes to the next frame and stops.
  *
  * @method changeFrame
  */
  this.nextFrame = function() {

    if (frame<this.images.length-1)
      frame = frame+1;
    else if(this.looping)
      frame = 0;

    targetFrame = -1;
    this.playing = false;
  };

   /**
  * Goes to the next frame and stops.
  *
  * @method changeFrame
  */
  this.previousFrame = function() {

    if (frame>0)
      frame = frame-1;
    else if(this.looping)
      frame = this.images.length-1;

    targetFrame = -1;
    this.playing = false;
  };

  /**
  * Plays the animation forward or backward toward a target frame.
  *
  * @method goToFrame
  * @param {Number} toFrame Frame number destination (starts from 0)
  */
  this.goToFrame = function(toFrame) {
    if(toFrame < 0 || toFrame >= this.images.length) {
      return;
    }

    // targetFrame gets used by the update() method to decide what frame to
    // select next.  When it's not being used it gets set to -1.
    targetFrame = toFrame;

    if(targetFrame !== frame) {
      this.playing = true;
    }
  };

  /**
  * Returns the current frame number.
  *
  * @method getFrame
  * @return {Number} Current frame (starts from 0)
  */
  this.getFrame = function() {
    return frame;
  };

  /**
  * Returns the last frame number.
  *
  * @method getLastFrame
  * @return {Number} Last frame number (starts from 0)
  */
  this.getLastFrame = function() {
    return this.images.length-1;
  };

  /**
  * Returns the current frame image as p5.Image.
  *
  * @method getFrameImage
  * @return {p5.Image} Current frame image
  */
  this.getFrameImage = function() {
    return this.images[frame];
  };

  /**
  * Returns the frame image at the specified frame number.
  *
  * @method getImageAt
  * @param {Number} frame Frame number
  * @return {p5.Image} Frame image
  */
  this.getImageAt = function(f) {
    return this.images[f];
  };

  /**
  * Returns the current frame width in pixels.
  * If there is no image loaded, returns 1.
  *
  * @method getWidth
  * @return {Number} Frame width
  */
  this.getWidth = function() {
    if (this.images[frame]) {
      return this.images[frame].width;
    } else {
      return 1;
    }
  };

  /**
  * Returns the current frame height in pixels.
  * If there is no image loaded, returns 1.
  *
  * @method getHeight
  * @return {Number} Frame height
  */
  this.getHeight = function() {
    if (this.images[frame]) {
      return this.images[frame].height;
    } else {
      return 1;
    }
  };

}

defineLazyP5Property('Animation', boundConstructorFactory(Animation));

/**
 * Represents a sprite sheet and all it's frames.  To be used with Animation,
 * or static drawing single frames.
 *
 *  There are two different ways to load a SpriteSheet
 *
 * 1. Given width, height that will be used for every frame and the
 *    number of frames to cycle through. The sprite sheet must have a
 *    uniform grid with consistent rows and columns.
 *
 * 2. Given an array of frame objects that define the position and
 *    dimensions of each frame.  This is Flexible because you can use
 *    sprite sheets that don't have uniform rows and columns.
 *
 * @example
 *     // Method 1 - Using width, height for each frame and number of frames
 *     explode_sprite_sheet = loadSpriteSheet('assets/explode_sprite_sheet.png', 171, 158, 11);
 *
 *     // Method 2 - Using an array of objects that define each frame
 *     var player_frames = loadJSON('assets/tiles.json');
 *     player_sprite_sheet = loadSpriteSheet('assets/player_spritesheet.png', player_frames);
 *
 * @class SpriteSheet
 * @constructor
 * @param image String image path or p5.Image object
 */
function SpriteSheet(pInst) {
  var spriteSheetArgs = Array.prototype.slice.call(arguments, 1);

  this.image = null;
  this.frames = [];
  this.frame_width = 0;
  this.frame_height = 0;
  this.num_frames = 0;

  /**
   * Generate the frames data for this sprite sheet baesd on user params
   * @private
   * @method _generateSheetFrames
   */
  this._generateSheetFrames = function() {
    var sX = 0, sY = 0;
    for (var i = 0; i < this.num_frames; i++) {
      this.frames.push(
        {
          'name': i,
          'frame': {
            'x': sX,
            'y': sY,
            'width': this.frame_width,
            'height': this.frame_height
          }
        });
      sX += this.frame_width;
      if (sX >= this.image.width) {
        sX = 0;
        sY += this.frame_height;
        if (sY >= this.image.height) {
          sY = 0;
        }
      }
    }
  };

  if (spriteSheetArgs.length === 2 && Array.isArray(spriteSheetArgs[1])) {
    this.frames = spriteSheetArgs[1];
    this.num_frames = this.frames.length;
  } else if (spriteSheetArgs.length === 4 &&
    (typeof spriteSheetArgs[1] === 'number') &&
    (typeof spriteSheetArgs[2] === 'number') &&
    (typeof spriteSheetArgs[3] === 'number')) {
    this.frame_width = spriteSheetArgs[1];
    this.frame_height = spriteSheetArgs[2];
    this.num_frames = spriteSheetArgs[3];
  }

  if(spriteSheetArgs[0] instanceof p5.Image) {
    this.image = spriteSheetArgs[0];
    if (spriteSheetArgs.length === 4) {
      this._generateSheetFrames();
    }
  } else {
    if (spriteSheetArgs.length === 2) {
      this.image = pInst.loadImage(spriteSheetArgs[0]);
    } else if (spriteSheetArgs.length === 4) {
      this.image = pInst.loadImage(spriteSheetArgs[0], this._generateSheetFrames.bind(this));
    }
  }

  /**
   * Draws a specific frame to the canvas.
   * @param frame_name  Can either be a string name, or a numeric index.
   * @param x   x position to draw the frame at
   * @param y   y position to draw the frame at
   * @param [width]   optional width to draw the frame
   * @param [height]  optional height to draw the frame
   * @method drawFrame
   */
  this.drawFrame = function(frame_name, x, y, width, height) {
    var frameToDraw;
    if (typeof frame_name === 'number') {
      frameToDraw = this.frames[frame_name].frame;
    } else {
      for (var i = 0; i < this.frames.length; i++) {
        if (this.frames[i].name === frame_name) {
          frameToDraw = this.frames[i].frame;
          break;
        }
      }
    }
    var dWidth = width || frameToDraw.width;
    var dHeight = height || frameToDraw.height;
    pInst.image(this.image, frameToDraw.x, frameToDraw.y,
      frameToDraw.width, frameToDraw.height, x, y, dWidth, dHeight);
  };

  /**
   * Objects are passed by reference so to have different sprites
   * using the same animation you need to clone it.
   *
   * @method clone
   * @return {SpriteSheet} A clone of the current SpriteSheet
   */
  this.clone = function() {
    var myClone = new SpriteSheet(pInst); //empty

    // Deep clone the frames by value not reference
    for(var i = 0; i < this.frames.length; i++) {
      var frame = this.frames[i].frame;
      var cloneFrame = {
        'name':frame.name,
        'frame': {
          'x':frame.x,
          'y':frame.y,
          'width':frame.width,
          'height':frame.height
        }
      };
      myClone.frames.push(cloneFrame);
    }

    // clone other fields
    myClone.image = this.image;
    myClone.frame_width = this.frame_width;
    myClone.frame_height = this.frame_height;
    myClone.num_frames = this.num_frames;

    return myClone;
  };
}

defineLazyP5Property('SpriteSheet', boundConstructorFactory(SpriteSheet));

//general constructor to be able to feed arguments as array
function construct(constructor, args) {
  function F() {
    return constructor.apply(this, args);
  }
  F.prototype = constructor.prototype;
  return new F();
}





/*
 * Javascript Quadtree
 * based on
 * https://github.com/timohausmann/quadtree-js/
 * Copyright © 2012 Timo Hausmann
*/

function Quadtree( bounds, max_objects, max_levels, level ) {

  this.active = true;
  this.max_objects	= max_objects || 10;
  this.max_levels		= max_levels || 4;

  this.level 			= level || 0;
  this.bounds 		= bounds;

  this.objects 		= [];
  this.object_refs	= [];
  this.nodes 			= [];
}

Quadtree.prototype.updateBounds = function() {

  //find maximum area
  var objects = this.getAll();
  var x = 10000;
  var y = 10000;
  var w = -10000;
  var h = -10000;

  for( var i=0; i < objects.length; i++ )
    {
      if(objects[i].position.x < x)
        x = objects[i].position.x;
      if(objects[i].position.y < y)
        y = objects[i].position.y;
      if(objects[i].position.x > w)
        w = objects[i].position.x;
      if(objects[i].position.y > h)
        h = objects[i].position.y;
    }


  this.bounds = {
    x:x,
    y:y,
    width:w,
    height:h
  };
  //print(this.bounds);
};

/*
	 * Split the node into 4 subnodes
	 */
Quadtree.prototype.split = function() {

  var nextLevel	= this.level + 1,
      subWidth	= Math.round( this.bounds.width / 2 ),
      subHeight 	= Math.round( this.bounds.height / 2 ),
      x 			= Math.round( this.bounds.x ),
      y 			= Math.round( this.bounds.y );

  //top right node
  this.nodes[0] = new Quadtree({
    x	: x + subWidth,
    y	: y,
    width	: subWidth,
    height	: subHeight
  }, this.max_objects, this.max_levels, nextLevel);

  //top left node
  this.nodes[1] = new Quadtree({
    x	: x,
    y	: y,
    width	: subWidth,
    height	: subHeight
  }, this.max_objects, this.max_levels, nextLevel);

  //bottom left node
  this.nodes[2] = new Quadtree({
    x	: x,
    y	: y + subHeight,
    width	: subWidth,
    height	: subHeight
  }, this.max_objects, this.max_levels, nextLevel);

  //bottom right node
  this.nodes[3] = new Quadtree({
    x	: x + subWidth,
    y	: y + subHeight,
    width	: subWidth,
    height	: subHeight
  }, this.max_objects, this.max_levels, nextLevel);
};


/*
	 * Determine the quadtrant for an area in this node
	 */
Quadtree.prototype.getIndex = function( pRect ) {
  if(!pRect.collider)
    return -1;
  else
  {
    var index 				= -1,
        verticalMidpoint 	= this.bounds.x + (this.bounds.width / 2),
        horizontalMidpoint 	= this.bounds.y + (this.bounds.height / 2),

        //pRect can completely fit within the top quadrants
        topQuadrant = (pRect.collider.top() < horizontalMidpoint && pRect.collider.top() + pRect.collider.size().y < horizontalMidpoint),

        //pRect can completely fit within the bottom quadrants
        bottomQuadrant = (pRect.collider.top() > horizontalMidpoint);

    //pRect can completely fit within the left quadrants
    if( pRect.collider.left() < verticalMidpoint && pRect.collider.left() + pRect.collider.size().x < verticalMidpoint ) {
      if( topQuadrant ) {
        index = 1;
      } else if( bottomQuadrant ) {
        index = 2;
      }

      //pRect can completely fit within the right quadrants
    } else if( pRect.collider.left() > verticalMidpoint ) {
      if( topQuadrant ) {
        index = 0;
      } else if( bottomQuadrant ) {
        index = 3;
      }
    }

    return index;
  }
};


/*
	 * Insert an object into the node. If the node
	 * exceeds the capacity, it will split and add all
	 * objects to their corresponding subnodes.
	 */
Quadtree.prototype.insert = function( obj ) {
  //avoid double insertion
  if(this.objects.indexOf(obj) === -1)
  {

    var i = 0,
        index;

    //if we have subnodes ...
    if( typeof this.nodes[0] !== 'undefined' ) {
      index = this.getIndex( obj );

      if( index !== -1 ) {
        this.nodes[index].insert( obj );
        return;
      }
    }

    this.objects.push( obj );

    if( this.objects.length > this.max_objects && this.level < this.max_levels ) {

      //split if we don't already have subnodes
      if( typeof this.nodes[0] === 'undefined' ) {
        this.split();
      }

      //add all objects to there corresponding subnodes
      while( i < this.objects.length ) {

        index = this.getIndex( this.objects[i] );

        if( index !== -1 ) {
          this.nodes[index].insert( this.objects.splice(i, 1)[0] );
        } else {
          i = i + 1;
        }
      }
    }
  }
};


/*
	 * Return all objects that could collide with a given area
	 */
Quadtree.prototype.retrieve = function( pRect ) {


  var index = this.getIndex( pRect ),
      returnObjects = this.objects;

  //if we have subnodes ...
  if( typeof this.nodes[0] !== 'undefined' ) {

    //if pRect fits into a subnode ..
    if( index !== -1 ) {
      returnObjects = returnObjects.concat( this.nodes[index].retrieve( pRect ) );

      //if pRect does not fit into a subnode, check it against all subnodes
    } else {
      for( var i=0; i < this.nodes.length; i=i+1 ) {
        returnObjects = returnObjects.concat( this.nodes[i].retrieve( pRect ) );
      }
    }
  }

  return returnObjects;
};

Quadtree.prototype.retrieveFromGroup = function( pRect, group ) {

  var results = [];
  var candidates = this.retrieve(pRect);

  for(var i=0; i<candidates.length; i++)
    if(group.contains(candidates[i]))
    results.push(candidates[i]);

  return results;
};

/*
	 * Get all objects stored in the quadtree
	 */
Quadtree.prototype.getAll = function() {

  var objects = this.objects;

  for( var i=0; i < this.nodes.length; i=i+1 ) {
    objects = objects.concat( this.nodes[i].getAll() );
  }

  return objects;
};


/*
	 * Get the node in which a certain object is stored
	 */
Quadtree.prototype.getObjectNode = function( obj ) {

  var index;

  //if there are no subnodes, object must be here
  if( !this.nodes.length ) {

    return this;

  } else {

    index = this.getIndex( obj );

    //if the object does not fit into a subnode, it must be here
    if( index === -1 ) {

      return this;

      //if it fits into a subnode, continue deeper search there
    } else {
      var node = this.nodes[index].getObjectNode( obj );
      if( node ) return node;
    }
  }

  return false;
};


/*
	 * Removes a specific object from the quadtree
	 * Does not delete empty subnodes. See cleanup-function
	 */
Quadtree.prototype.removeObject = function( obj ) {

  var node = this.getObjectNode( obj ),
      index = node.objects.indexOf( obj );

  if( index === -1 ) return false;

  node.objects.splice( index, 1);
};


/*
	 * Clear the quadtree and delete all objects
	 */
Quadtree.prototype.clear = function() {

  this.objects = [];

  if( !this.nodes.length ) return;

  for( var i=0; i < this.nodes.length; i=i+1 ) {

    this.nodes[i].clear();
  }

  this.nodes = [];
};


/*
	 * Clean up the quadtree
	 * Like clear, but objects won't be deleted but re-inserted
	 */
Quadtree.prototype.cleanup = function() {

  var objects = this.getAll();

  this.clear();

  for( var i=0; i < objects.length; i++ ) {
    this.insert( objects[i] );
  }
};



function updateTree() {
  if(this.quadTree.active)
  {
    this.quadTree.updateBounds();
    this.quadTree.cleanup();
  }
}

//keyboard input
p5.prototype.registerMethod('pre', p5.prototype.readPresses);

//automatic sprite update
p5.prototype.registerMethod('pre', p5.prototype.updateSprites);

//quadtree update
p5.prototype.registerMethod('post', updateTree);

//camera push and pop
p5.prototype.registerMethod('pre', cameraPush);
p5.prototype.registerMethod('post', cameraPop);

//deltaTime
//p5.prototype.registerMethod('pre', updateDelta);

/**
 * Log a warning message to the host console, using native `console.warn`
 * if it is available but falling back on `console.log` if not.  If no
 * console is available, this method will fail silently.
 * @method _warn
 * @param {!string} message
 * @private
 */
p5.prototype._warn = function(message) {
  var console = window.console;

  if(console)
  {
    if('function' === typeof console.warn)
    {
      console.warn(message);
    }
    else if('function' === typeof console.log)
    {
      console.log('Warning: ' + message);
    }
  }
};

}));
