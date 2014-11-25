"use strict";


var gl = null,
	glAttrPointerVertex = null,
	glBuffers = {},
	glShaders = {},
	glShadersFinal = {},
	glShaderPrograms = {};
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
 * Callback function for when the shaders have all been loaded and
 * attached to the shader programs.
 * Now links the programs.
 */
function callbackShadersLoaded() {
	// Path Tracing: program
	glShaderPrograms["path-tracing"] = gl.createProgram();

	// Path Tracing: vertex shader
	var vertexShader = gl.createShader( gl.VERTEX_SHADER );
	gl.shaderSource( vertexShader, glShaders["path-tracing.vert"] );
	gl.compileShader( vertexShader );
	gl.attachShader( glShaderPrograms["path-tracing"], vertexShader );

	// Path Tracing: fragment shader
	var fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );
	var fragSource = glShaders["path-tracing.frag"];

	for( var fragName in glShaders ) {
		if( fragName.substr( -5 ) != ".frag" ) {
			continue;
		}

		fragSource = fragSource.replace( "#FILE:" + fragName + ":FILE#", glShaders[fragName] );
	}

	fragSource = setDefineValues( fragSource );

	gl.shaderSource( fragmentShader, fragSource );
	gl.compileShader( fragmentShader );
	gl.attachShader( glShaderPrograms["path-tracing"], fragmentShader );

	// Path Tracing: link program
	gl.linkProgram( glShaderPrograms["path-tracing"] );

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


function setDefineValues( fragSource ) {
	var cl = CFG.CLEAR_COLOR;
	var skyLight = "vec3( " + cl[0] + ", " + cl[1] + ", " + cl[2] + " )";

	fragSource = fragSource.replace( '%ACCEL_STRUCT%', CFG.ACCEL_STRUCT );
	fragSource = fragSource.replace( '%ANTI_ALIASING%', parseInt( CFG.SHADER.ANTI_ALIASING ) );
	fragSource = fragSource.replace( '%BRDF%', CFG.SHADER.BRDF );
	fragSource = fragSource.replace( '%BVH_STACKSIZE%', 0 ); // TODO: Get BVH depth.
	fragSource = fragSource.replace( '%IMG_HEIGHT%', CFG.WINDOW.HEIGHT ); // TODO: Get size for fullscreen.
	fragSource = fragSource.replace( '%IMG_WIDTH%', CFG.WINDOW.WIDTH ); // TODO: see above
	fragSource = fragSource.replace( '%IMPLICIT%', parseInt( CFG.SHADER.IMPLICIT ) );
	fragSource = fragSource.replace( '%MAX_ADDED_DEPTH%', CFG.SHADER.MAX_ADDED_DEPTH );
	fragSource = fragSource.replace( '%MAX_DEPTH%', CFG.SHADER.MAX_DEPTH );
	fragSource = fragSource.replace( '%PHONG_TESS%', ( CFG.SHADER.PHONG_TESSELATION > 0.0 ) ? 1 : 0 );
	fragSource = fragSource.replace( '%PHONG_TESS_ALPHA%', CFG.SHADER.PHONG_TESSELATION );
	fragSource = fragSource.replace( '%SAMPLES%', CFG.SHADER.SAMPLES );
	fragSource = fragSource.replace( '%SKY_LIGHT%', skyLight );

	return fragSource;
}


/**
 * Render the scene.
 * @param {float} elapsedTime Elapsed time since first draw in milliseconds.
 */
function draw( elapsedTime ) {
	gl.clear( gl.COLOR_BUFFER_BIT );

	gl.useProgram( glShaderPrograms["path-tracing"] );
	gl.bindBuffer( gl.ARRAY_BUFFER, glBuffers["path-tracing"]["array_buffer"] );
	gl.vertexAttribPointer( glAttrPointerVertex, 2, gl.FLOAT, gl.FALSE, 0, 0 );

    gl.uniform2f( gl.getUniformLocation( glShaderPrograms["path-tracing"], "uResolution" ), gWidth, gHeight );
    gl.uniform1f( gl.getUniformLocation( glShaderPrograms["path-tracing"], "uGlobalTime" ), elapsedTime * 0.0001 );

	gl.drawArrays( gl.TRIANGLE_STRIP, 0, 4 );
}


/**
 * Initialize the render target area.
 */
function initRenderTarget() {
	gl.useProgram( glShaderPrograms["path-tracing"] );
	glAttrPointerVertex = gl.getAttribLocation( glShaderPrograms["path-tracing"], "vertexPos" );
	gl.enableVertexAttribArray( glAttrPointerVertex );

	var vertices = [
		-1.0, -1.0,
		-1.0, +1.0,
		+1.0, -1.0,
		+1.0, +1.0
	];
	glBuffers["path-tracing"] = { "array_buffer": gl.createBuffer() };

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
 * Load the shaders.
 * @param {function} callback Callback function to call after having loaded all shaders.
 */
function loadShaders( callback ) {
	var load = [
		// vertex shader
		"path-tracing.vert",
		// all parts of the fragment shader
		"path-tracing.frag",
		"pt_brdf.frag",
		"pt_bvh.frag",
		"pt_header.frag",
		"pt_intersect.frag",
		// "pt_kdtree.frag",
		"pt_phongtess.frag",
		"pt_utils.frag"
	];

	load.forEach( function( item, index, array ) {
		var xhr = new XMLHttpRequest();

		xhr.onload = function( ev ) {
			if( xhr.readyState !== 4 ) {
				return;
			}

			var path = ev.target.responseURL.split( "/" );
			var filename = path[path.length - 1].split( "." );

			glShaders[filename] = xhr.responseText;

			if( index == array.length - 1 ) {
				callback();
			}
		};

		xhr.onerror = function( ev ) {
			UI.printError( "Failed to load shader from \"" + ev.target.responseURL + "\"." );
		};

		xhr.overrideMimeType( "text/plain; charset=utf-8" );
		xhr.open( "GET", "shaders/" + item, true );
		xhr.send( null );
	} );
}


/**
 * Replace placeholders inside the shader code with values from the config.
 * @param  {string} shaderCode Shader code.
 * @return {string}            Shader code with replacements.
 */
function shaderSetDefines( shaderCode ) {
	shaderCode = shaderCode.replace( "%MAX_DEPTH%", CFG.SHADER.MAX_DEPTH );
	shaderCode = shaderCode.replace( "%SAMPLES%", CFG.SHADER.SAMPLES );

	return shaderCode;
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
	loadShaders( callbackShadersLoaded );
}