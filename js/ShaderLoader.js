"use strict";


var ShaderLoader = {


	_programs: {},
	_sources: {},


	/**
	 * Build the program and link it.
	 */
	_buildProgram: function() {
		// Path Tracing: program
		this._programs["path-tracing"] = gl.createProgram();

		// Path Tracing: vertex shader
		var vertexShader = gl.createShader( gl.VERTEX_SHADER );
		gl.shaderSource( vertexShader, glShaders["path-tracing.vert"] );
		gl.compileShader( vertexShader );
		gl.attachShader( this._programs["path-tracing"], vertexShader );

		// Path Tracing: fragment shader
		var fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );
		var fragSource = this._sources["path-tracing.frag"];

		for( var fragName in this._sources ) {
			if( fragName.substr( -5 ) != ".frag" ) {
				continue;
			}

			fragSource = fragSource.replace( "#FILE:" + fragName + ":FILE#", glShaders[fragName] );
		}

		fragSource = this._setDefineValues( fragSource );

		gl.shaderSource( fragmentShader, fragSource );
		gl.compileShader( fragmentShader );
		gl.attachShader( this._programs["path-tracing"], fragmentShader );

		// Path Tracing: link program
		gl.linkProgram( this._programs["path-tracing"] );

		this._callback;
	},


	/**
	 * Replace the placeholders for #define values.
	 * @param  {String} source The source code to replace in.
	 * @return {String}        The source code with replacements.
	 */
	_setDefineValues: function( source ) {
		var cl = CFG.CLEAR_COLOR;
		var skyLight = "vec3( " + cl[0] + ", " + cl[1] + ", " + cl[2] + " )";

		source = source.replace( '%ACCEL_STRUCT%', CFG.ACCEL_STRUCT );
		source = source.replace( '%ANTI_ALIASING%', parseInt( CFG.SHADER.ANTI_ALIASING ) );
		source = source.replace( '%BRDF%', CFG.SHADER.BRDF );
		source = source.replace( '%BVH_STACKSIZE%', 0 ); // TODO: Get BVH depth.
		source = source.replace( '%IMG_HEIGHT%', gHeight );
		source = source.replace( '%IMG_WIDTH%', gWidth );
		source = source.replace( '%IMPLICIT%', parseInt( CFG.SHADER.IMPLICIT ) );
		source = source.replace( '%MAX_ADDED_DEPTH%', CFG.SHADER.MAX_ADDED_DEPTH );
		source = source.replace( '%MAX_DEPTH%', CFG.SHADER.MAX_DEPTH );
		source = source.replace( '%PHONG_TESS%', ( CFG.SHADER.PHONG_TESSELATION > 0.0 ) ? 1 : 0 );
		source = source.replace( '%PHONG_TESS_ALPHA%', CFG.SHADER.PHONG_TESSELATION );
		source = source.replace( '%SAMPLES%', CFG.SHADER.SAMPLES );
		source = source.replace( '%SKY_LIGHT%', skyLight );

		return source;
	},


	/**
	 * Get a built program.
	 * @param  {String}       name Name of the program.
	 * @return {WebGLProgram}      The WebGL program.
	 */
	getProgram: function( name ) {
		return this._program[name];
	},


	/**
	 * Load the shaders.
	 * @callback callback Function to call after shaders have been loaded and
	 *                    the program has been built.
	 */
	load: function( callback ) {
		this._callback = callback;

		var load = [
			// vertex shader
			"path-tracing.vert",
			// all parts of the fragment shader
			"path-tracing.frag",
			"pt_brdf.frag",
			"pt_bvh.frag",
			"pt_header.frag",
			"pt_intersect.frag",
			"pt_kdtree.frag",
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

				this._source[filename] = xhr.responseText;

				if( index == array.length - 1 ) {
					this._buildProgram();
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

};