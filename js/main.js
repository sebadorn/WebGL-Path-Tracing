"use strict";


var gl = null,
	glAttrPointerVertex = null,
	glBuffers = {};
var gHeight, gWidth;


window.addEventListener( "load", main );


/**
 * Main animation loop.
 * @param {float} elapsedTime Elapsed time since first draw in milliseconds.
 */
function animate( elapsedTime ) {
	UI.stats.begin();
	draw( elapsedTime );
	UI.stats.end();

	requestAnimationFrame( animate );
}


/**
 * Render the scene.
 * @param {float} elapsedTime Elapsed time since first draw in milliseconds.
 */
function draw( elapsedTime ) {
	var program = ShaderLoader.getProgram( "path-tracing" );

	gl.clear( gl.COLOR_BUFFER_BIT );

	gl.useProgram( program );
	gl.bindBuffer( gl.ARRAY_BUFFER, glBuffers["path-tracing"]["array_buffer"] );
	gl.vertexAttribPointer( glAttrPointerVertex, 2, gl.FLOAT, gl.FALSE, 0, 0 );

    gl.uniform2f( gl.getUniformLocation( program, "uResolution" ), gWidth, gHeight );
    gl.uniform1f( gl.getUniformLocation( program, "uGlobalTime" ), elapsedTime * 0.0001 );

	gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
}


/**
 * Initialize the render target area.
 */
function initRenderTarget() {
	var program = ShaderLoader.getProgram( "path-tracing" );

	gl.useProgram( program );
	glAttrPointerVertex = gl.getAttribLocation( program, "vertexPos" );
	gl.enableVertexAttribArray( glAttrPointerVertex );

	var vertices = [
		-1.0, -1.0,
		-1.0, +1.0,
		+1.0, -1.0,
		+1.0, +1.0
	];
	glBuffers["path-tracing"] = {
		"array_buffer": gl.createBuffer()
	};

	gl.bindBuffer( gl.ARRAY_BUFFER, glBuffers["path-tracing"]["array_buffer"] );
	gl.bufferData( gl.ARRAY_BUFFER, new Float32Array( vertices ), gl.STATIC_DRAW );
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

	webgl.clearColor( CFG.CLEAR_COLOR[0], CFG.CLEAR_COLOR[1], CFG.CLEAR_COLOR[2], CFG.CLEAR_COLOR[3] );
	webgl.clear( webgl.COLOR_BUFFER_BIT );
	webgl.viewport( 0, 0, canvas.width, canvas.height );

	return webgl;
}


/**
 * After the scene and the shaders have been loaded, start rendering.
 */
function start() {
	initRenderTarget();
	UI.print( "Beginning rendering ..." );

	// Leave some time for the UI to print messages.
	window.setTimeout( function( ev ) {
		if( CFG.CONTINUOUSLY ) {
			animate( 0.0 );
		}
		else {
			draw( 0.0 );
		}
	}, 1 );
}


/**
 * Main function, entry point.
 */
function main() {
	UI.init();
	gl = initWebGL( UI.getCanvas() );

	if( !gl ) {
		return;
	}

	window.addEventListener( "resize", UI.resize );
	ShaderLoader.load( start );
}