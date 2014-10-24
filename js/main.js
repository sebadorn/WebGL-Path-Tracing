"use strict";


var gl = null,
	glShaderPrograms = {};


window.addEventListener( "load", main );


/**
 * Callback function for when the shaders have all been loaded and
 * attached to the shader programs.
 * Now links the programs.
 */
function callbackShadersLoaded() {
	var link = ["path-tracing"];

	link.forEach( function( item, index, array ) {
		gl.linkProgram( glShaderPrograms[item] );
	} );
}


/**
 * Initialize the canvas element.
 * @return {DOMElement} The HTML canvas or null on error.
 */
function initCanvas() {
	var canvas = document.getElementById( "render-target" );

	if( !canvas ) {
		console.error( "No canvas#render-target found!" );
		return null;
	}

	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	return canvas;
}


/**
 * Initialize WebGL.
 * @param  {DOMElement}       canvas The HTML canvas.
 * @return {RenderingContext}        WebGL rendering context or null on error.
 */
function initWebGL( canvas ) {
	if( !canvas ) {
		return null;
	}

	var webgl = null;

	try {
		webgl = canvas.getContext( "webgl" ) || canvas.getContext( "experimental-webgl" );
	}
	catch( exc ) {
		console.error( exc );
		return null;
	}

	webgl.clearColor( 1.0, 1.0, 1.0, 0.0 );
	webgl.clear( webgl.COLOR_BUFFER_BIT );
	webgl.viewport( 0, 0, canvas.width, canvas.height );

	return webgl;
}


/**
 * Load the shaders.
 */
function loadShaders( callback ) {
	var load = ["path-tracing.vert", "path-tracing.frag"];

	load.forEach( function( item, index, array ) {
		var xhr = new XMLHttpRequest();

		xhr.onload = function( ev ) {
			if( xhr.readyState !== 4 ) {
				return;
			}

			var path = ev.target.responseURL.split( "/" );
			var filename = path[path.length - 1].split( "." );
			var shaderName = filename[0];
			var shaderType = filename[1];

			if( !glShaderPrograms[shaderName] ) {
				glShaderPrograms[shaderName] = gl.createProgram();
			}

			var shader;

			if( shaderType === "vert" ) {
				shader = gl.createShader( gl.VERTEX_SHADER );
			}
			else if( shaderType === "frag" ) {
				shader = gl.createShader( gl.FRAGMENT_SHADER );
			}
			else {
				console.error( "Unknown shader type: " + shaderType );
				return;
			}

			gl.shaderSource( shader, xhr.responseText );
			gl.compileShader( shader );
			gl.attachShader( glShaderPrograms[shaderName], shader );

			if( index == array.length - 1 ) {
				callback();
			}
		};

		xhr.onerror = function( ev ) {
			console.error( "Failed to load shader." );
		};

		xhr.overrideMimeType( "text/plain; charset=utf-8" );
		xhr.open( "GET", "shaders/" + item, true );
		xhr.send( null );
	} );
}


/**
 * Main function, entry point.
 */
function main() {
	var canvas = initCanvas();
	gl = initWebGL( canvas );

	if( !gl ) {
		return;
	}

	loadShaders( callbackShadersLoaded );
}