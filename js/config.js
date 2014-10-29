"use strict";


var CFG = {
	// OpenGL color for the cleared render area.
	// RGBA
	CLEAR_COLOR: [1.0, 1.0, 1.0, 0.0], // [array<float>]

	// Continuously keep renderering, improving the rendered
	// graphic with each round.
	CONTINUOUSLY: false, // [boolean]

	// Shader variables
	SHADER: {
		// Max depth of rays
		MAX_DEPTH: 3, // [int]
		// Number of samples computed per draw
		SAMPLES: 5, // [int]
	},

	// User interface
	UI: {
		// Max number of messages to keep in the logging area
		STDOUT_MAX: 40
	},

	// Render window (canvas)
	WINDOW: {
		// Adjust the canvas to the browser window size
		FULLSCREEN: false, // [boolean]
		// If not using fullscreen, set the height to this
		HEIGHT: 600, // [pixels]
		// if not using fullscreen, set the width to this
		WIDTH: 900 // [pixels]
	}
};