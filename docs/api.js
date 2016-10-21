YUI.add("yuidoc-meta", function(Y) {
   Y.YUIDoc = { meta: {
    "classes": [
        "Animation",
        "Camera",
        "Group",
        "Sprite",
        "SpriteSheet",
        "p5",
        "p5.Color",
        "p5.Element",
        "p5.Font",
        "p5.Graphics",
        "p5.Image",
        "p5.Renderer",
        "p5.Table",
        "p5.TableRow",
        "p5.Vector",
        "p5.play"
    ],
    "modules": [
        "2D Primitives",
        "3D Primitives",
        "Acceleration",
        "Array Functions",
        "Attributes",
        "Calculation",
        "Camera",
        "Color",
        "Constants",
        "Conversion",
        "Creating & Reading",
        "Curves",
        "DOM",
        "DOM",
        "Data",
        "Environment",
        "Events",
        "Font",
        "IO",
        "Image",
        "Input",
        "Keyboard",
        "Lights",
        "Lights, Camera",
        "Loading & Displaying",
        "Material",
        "Math",
        "Mouse",
        "Noise",
        "Output",
        "Pixels",
        "Random",
        "Rendering",
        "Setting",
        "Shape",
        "Structure",
        "Structure",
        "Table",
        "Touch",
        "Transform",
        "Transform",
        "Trigonometry",
        "Typography",
        "Vertex",
        "p5.play"
    ],
    "allModules": [
        {
            "displayName": "2D Primitives",
            "name": "2D Primitives"
        },
        {
            "displayName": "3D Primitives",
            "name": "3D Primitives"
        },
        {
            "displayName": "Acceleration",
            "name": "Acceleration"
        },
        {
            "displayName": "Array Functions",
            "name": "Array Functions",
            "description": "Base class for font handling"
        },
        {
            "displayName": "Attributes",
            "name": "Attributes"
        },
        {
            "displayName": "Calculation",
            "name": "Calculation",
            "description": "A TableRow object represents a single row of data values,\nstored in columns, from a table.\n\nA Table Row contains both an ordered array, and an unordered\nJSON object."
        },
        {
            "displayName": "Camera",
            "name": "Camera"
        },
        {
            "displayName": "Color",
            "name": "Color"
        },
        {
            "displayName": "Constants",
            "name": "Constants"
        },
        {
            "displayName": "Conversion",
            "name": "Conversion"
        },
        {
            "displayName": "Creating & Reading",
            "name": "Creating & Reading"
        },
        {
            "displayName": "Curves",
            "name": "Curves"
        },
        {
            "displayName": "Data",
            "name": "Data"
        },
        {
            "displayName": "DOM",
            "name": "DOM"
        },
        {
            "displayName": "Environment",
            "name": "Environment"
        },
        {
            "displayName": "Events",
            "name": "Events"
        },
        {
            "displayName": "Font",
            "name": "Font",
            "description": "This module defines the p5.Font class and functions for\ndrawing text to the display canvas."
        },
        {
            "displayName": "Image",
            "name": "Image"
        },
        {
            "displayName": "Input",
            "name": "Input"
        },
        {
            "displayName": "IO",
            "name": "IO"
        },
        {
            "displayName": "Keyboard",
            "name": "Keyboard"
        },
        {
            "displayName": "Lights",
            "name": "Lights"
        },
        {
            "displayName": "Lights, Camera",
            "name": "Lights, Camera"
        },
        {
            "displayName": "Loading & Displaying",
            "name": "Loading & Displaying"
        },
        {
            "displayName": "Material",
            "name": "Material"
        },
        {
            "displayName": "Math",
            "name": "Math"
        },
        {
            "displayName": "Mouse",
            "name": "Mouse"
        },
        {
            "displayName": "Noise",
            "name": "Noise"
        },
        {
            "displayName": "Output",
            "name": "Output"
        },
        {
            "displayName": "p5.play",
            "name": "p5.play",
            "description": "p5.play is a library for p5.js to facilitate the creation of games and gamelike\nprojects.\n\nIt provides a flexible Sprite class to manage visual objects in 2D space\nand features such as animation support, basic collision detection\nand resolution, mouse and keyboard interactions, and a virtual camera.\n\np5.play is not a box2D-derived physics engine, it doesn't use events, and it's\ndesigned to be understood and possibly modified by intermediate programmers.\n\nSee the examples folder for more info on how to use this library."
        },
        {
            "displayName": "Pixels",
            "name": "Pixels",
            "description": "Creates a new p5.Image. A p5.Image is a canvas backed representation of an\nimage.\n<br><br>\np5 can display .gif, .jpg and .png images. Images may be displayed\nin 2D and 3D space. Before an image is used, it must be loaded with the\nloadImage() function. The p5.Image class contains fields for the width and\nheight of the image, as well as an array called pixels[] that contains the\nvalues for every pixel in the image.\n<br><br>\nThe methods described below allow easy access to the image's pixels and\nalpha channel and simplify the process of compositing.\n<br><br>\nBefore using the pixels[] array, be sure to use the loadPixels() method on\nthe image to make sure that the pixel data is properly loaded."
        },
        {
            "displayName": "Random",
            "name": "Random",
            "description": "A class to describe a two or three dimensional vector, specifically\na Euclidean (also known as geometric) vector. A vector is an entity\nthat has both magnitude and direction. The datatype, however, stores\nthe components of the vector (x, y for 2D, and x, y, z for 3D). The magnitude\nand direction can be accessed via the methods mag() and heading().\n<br><br>\nIn many of the p5.js examples, you will see p5.Vector used to describe a\nposition, velocity, or acceleration. For example, if you consider a rectangle\nmoving across the screen, at any given instant it has a position (a vector\nthat points from the origin to its location), a velocity (the rate at which\nthe object's position changes per time unit, expressed as a vector), and\nacceleration (the rate at which the object's velocity changes per time\nunit, expressed as a vector).\n<br><br>\nSince vectors represent groupings of values, we cannot simply use\ntraditional addition/multiplication/etc. Instead, we'll need to do some\n\"vector\" math, which is made easy by the methods inside the p5.Vector class."
        },
        {
            "displayName": "Rendering",
            "name": "Rendering",
            "description": "Base class for all elements added to a sketch, including canvas,\ngraphics buffers, and other HTML elements. Methods in blue are\nincluded in the core functionality, methods in brown are added\nwith the <a href=\"http://p5js.org/libraries/\">p5.dom library</a>.\nIt is not called directly, but p5.Element\nobjects are created by calling createCanvas, createGraphics,\nor in the p5.dom library, createDiv, createImg, createInput, etc."
        },
        {
            "displayName": "Setting",
            "name": "Setting",
            "description": "We define colors to be immutable objects. Each color stores the color mode\nand level maxes that applied at the time of its construction. These are\nused to interpret the input arguments and to format the output e.g. when\nsaturation() is requested.\n\nInternally we store an array representing the ideal RGBA values in floating\npoint form, normalized from 0 to 1. From this we calculate the closest\nscreen color (RGBA levels from 0 to 255) and expose this to the renderer.\n\nWe also cache normalized, floating point components of the color in various\nrepresentations as they are calculated. This is done to prevent repeating a\nconversion that has already been performed."
        },
        {
            "displayName": "Shape",
            "name": "Shape"
        },
        {
            "displayName": "String Functions",
            "name": "String Functions"
        },
        {
            "displayName": "Structure",
            "name": "Structure"
        },
        {
            "displayName": "Table",
            "name": "Table",
            "description": "Table objects store data with multiple rows and columns, much\nlike in a traditional spreadsheet. Tables can be generated from\nscratch, dynamically, or using data from an existing file."
        },
        {
            "displayName": "Time & Date",
            "name": "Time & Date"
        },
        {
            "displayName": "Touch",
            "name": "Touch"
        },
        {
            "displayName": "Transform",
            "name": "Transform"
        },
        {
            "displayName": "Trigonometry",
            "name": "Trigonometry"
        },
        {
            "displayName": "Typography",
            "name": "Typography"
        },
        {
            "displayName": "Vertex",
            "name": "Vertex"
        }
    ],
    "elements": []
} };
});