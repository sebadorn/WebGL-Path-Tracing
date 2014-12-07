"use strict";


var ShaderLoader = {


	_callback: null,
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
		gl.shaderSource( vertexShader, this._sources["path-tracing.vert"] );
		gl.compileShader( vertexShader );
		gl.attachShader( this._programs["path-tracing"], vertexShader );

		// Path Tracing: fragment shader
		var fragmentShader = gl.createShader( gl.FRAGMENT_SHADER );
		var fragSource = this._sources["path-tracing.frag"];

		for( var fragName in this._sources ) {
			if( fragName.substr( -5 ) != ".frag" ) {
				continue;
			}

			fragSource = fragSource.replace( "#FILE:" + fragName + ":FILE#", this._sources[fragName] );
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
		var acc = SceneManager.getAccStructData();
		var cl = CFG.CLEAR_COLOR;
		var skyLight = "vec3( " + cl[0] + ", " + cl[1] + ", " + cl[2] + " )";

		source = source.replace( "%ACCEL_STRUCT%", CFG.ACCEL_STRUCT );
		source = source.replace( "%ANTI_ALIASING%", CFG.SHADER.ANTI_ALIASING );
		source = source.replace( "%BRDF%", CFG.SHADER.BRDF );
		source = source.replace( "%BVH_STACKSIZE%", acc.bvh.depth );
		source = source.replace( "%IMPLICIT%", CFG.SHADER.IMPLICIT ? 1 : 0 );
		source = source.replace( "%MAX_ADDED_DEPTH%", CFG.SHADER.MAX_ADDED_DEPTH );
		source = source.replace( "%MAX_DEPTH%", CFG.SHADER.MAX_DEPTH );
		source = source.replace( "%NUM_BVH_FACES%", acc.bvh.numFaces );
		source = source.replace( "%NUM_BVH_NODES%", acc.bvh.numNodes );
		source = source.replace( "%NUM_FACES%", acc.numFaces );
		// source = source.replace( "%NUM_KD_FACES%", ); // TODO:
		// source = source.replace( "%NUM_KD_LEAVES%", ); // TODO:
		// source = source.replace( "%NUM_KD_NONLEAVES%", ); // TODO:
		source = source.replace( "%NUM_MATERIALS%", acc.numMaterials );
		source = source.replace( "%PHONG_TESS%", ( CFG.SHADER.PHONG_TESSELATION > 0.0 ) ? 1 : 0 );
		source = source.replace( "%PHONG_TESS_ALPHA%", CFG.SHADER.PHONG_TESSELATION );
		source = source.replace( "%SAMPLES%", CFG.SHADER.SAMPLES );
		source = source.replace( "%SKY_LIGHT%", skyLight );

		source = source.replace( "%DATA_BVH_FACES%", acc.bvh.facesStr );
		source = source.replace( "%DATA_BVH_NODES%", acc.bvh.nodesStr );

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
	 */
	load: function() {
		var load = [
			// vertex shader
			"path-tracing.vert",
			// all parts of the fragment shader
			"path-tracing.frag",
			"pt_brdf.frag",
			"pt_bvh.frag",
			"pt_data.frag",
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
				var filename = path[path.length - 1];

				ShaderLoader._sources[filename] = xhr.responseText;

				if( index == array.length - 1 ) {
					ShaderLoader._buildProgram();
				}
			};

			xhr.onerror = function( ev ) {
				UI.printError( "Failed to load shader from \"" + ev.target.responseURL + "\"." );
			};

			xhr.overrideMimeType( "text/plain; charset=utf-8" );
			xhr.open( "GET", "shaders/" + item, true );
			xhr.send( null );
		} );
	},


	/**
	 * Set a callback to use after shaders have been built.
	 * @param {Function} fn Function to call after shaders have been
	 *                      loaded an the program has been built.
	 */
	setCallback: function( fn ) {
		this._callback = fn;
	}

};