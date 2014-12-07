"use strict";


/**
 * A material as defined in a MTL file with some extensions.
 * @constructor
 */
var Material = function() {
	// Part of the standard
	this.name = "";
	this.Ka = new THREE.Vector3( 1.0, 1.0, 1.0 );
	this.Kd = new THREE.Vector3( 1.0, 1.0, 1.0 );
	this.Ks = new THREE.Vector3( 1.0, 1.0, 1.0 );
	this.Ns = 100.0;
	this.Ni = 1.0;
	this.d = 1.0;
	this.illum = 2;
	// Extension
	this.light = 0;
	// BRDF: Schlick
	this.rough = 1.0;
	this.p = 1.0;
	// BRDF: Shirly-Ashikhmin
	this.nu = 0.0;
	this.nv = 0.0;
	this.Rs = 0.0;
	this.Rd = 1.0;
};



/**
 * Material file loader.
 * @constructor
 */
var MtlLoader = function() {
	this._materials = [];
};


/**
 * Get a list of the imported materials.
 * @return {Array<Material>} Imported materials.
 */
MtlLoader.prototype.getMaterials = function() {
	return this._materials;
};


/**
 * Read the contents of the given material file.
 * @param  {File}     file     File to read.
 * @param  {Function} callback Function to call after finishing importing the materials.
 */
MtlLoader.prototype.load = function( file, callback ) {
	var fr = new FileReader();

	fr.addEventListener( "load", function( ev ) {
		this.parse( ev.target.result );
		UI.print( "[MtlLoader] Loaded " + this._materials.length + " materials." );
		callback( this.getMaterials() );
	}.bind( this ) );

	fr.readAsText( file );
};


/**
 * Parse the material file content and import its materials.
 * @param {String} mtlText File content.
 */
MtlLoader.prototype.parse = function( mtlText ) {
	this._materials = [];

	var isSetTransparency = false;
	var lines = mtlText.match( /[^\r\n]+/g );
	var numMaterials = 0;
	var mtl = null;

	lines.forEach( function( line, index, array ) {
		line = line.trim();

		if( line.length < 3 || line[0] === "#" ) {
			return;
		}

		var parts = line.split( /\s+/g  );

		if( parts[0] === "newmtl" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] No name for <newmtl>. Ignoring entry." );
				return;
			}
			if( numMaterials > 0 ) {
				this._materials.push( mtl );
			}

			numMaterials++;

			mtl = new Material();
			mtl.name = parts[1];
		}
		// Transparency (dissolve)
		else if( parts[0] === "d" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <d>. Ignoring attribute." );
				return;
			}

			mtl.d = parseFloat( parts[1] );
			isSetTransparency = true;
		}
		// Transparency (dissolve), alternative definition
		else if( parts[0] === "Tr" && !isSetTransparency ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <Tr>. Ignoring attribute." );
				return;
			}

			mtl.d = 1.0 - parseFloat( parts[1] );
		}
		// Illumination model
		else if( parts[0] === "illum" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <illum>. Ignoring attribute." );
				return;
			}

			mtl.illum = parseInt( parts[1] );

			if( mtl.illum < 0 || mtl.illum > 10 ) {
				UI.printWarning( "[MtlLoader] Invalid value for <illum>. Has to be between 0 and 10. Ignoiring attribute." );
				mtl.illum = 2;
				return;
			}
		}
		// Ambient color
		else if( parts[0] === "Ka" ) {
			if( parts.length < 4 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <Ka>. Ignoring attribute." );
				return;
			}

			mtl.Ka.x = parseFloat( parts[1] );
			mtl.Ka.y = parseFloat( parts[2] );
			mtl.Ka.z = parseFloat( parts[3] );
		}
		// Diffuse color
		else if( parts[0] === "Kd" ) {
			if( parts.length < 4 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <Kd>. Ignoring attribute." );
				return;
			}

			mtl.Kd.x = parseFloat( parts[1] );
			mtl.Kd.y = parseFloat( parts[2] );
			mtl.Kd.z = parseFloat( parts[3] );
		}
		// Specular color
		else if( parts[0] === "Ks" ) {
			if( parts.length < 4 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <Ks>. Ignoring attribute." );
				return;
			}

			mtl.Ks.x = parseFloat( parts[1] );
			mtl.Ks.y = parseFloat( parts[2] );
			mtl.Ks.z = parseFloat( parts[3] );
		}
		// Optical density
		else if( parts[0] === "Ni" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <Ni>. Ignorign attribute." );
				return;
			}

			mtl.Ni = parseFloat( parts[1] );
		}
		// Specular exponent
		else if( parts[0] === "Ns" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <Ns>. Ignoring attribute." );
				return;
			}

			mtl.Ns = parseFloat( parts[1] );
		}
		// Light (extension)
		else if( parts[0] === "light" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <light>. Ignoring attribute." );
				return;
			}

			mtl.light = parseInt( parts[1] );
		}
		// Glossiness (extension, BRDF: Schlick)
		else if( parts[0] === "rough" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <rough>. Ignoring attribute." );
				return;
			}

			mtl.rough = parseFloat( parts[1] );
		}
		// Anisotropy/isotropy (extension, BRDF: Schlick)
		else if( parts[0] === "p" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <p>. Ignoring attribute." );
				return;
			}

			mtl.p = parseFloat( parts[1] );
		}
		// Specular lobe (extension, BRDF: Shirley-Ashikhmin)
		else if( parts[0] === "nu" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <nu>. Ignoring attribute." );
				return;
			}

			mtl.nu = parseFloat( parts[1] );
		}
		// Specular lobe (extension, BRDF: Shirley-Ashikhmin)
		else if( parts[0] === "nv" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <nv>. Ignoring attribute." );
				return;
			}

			mtl.nv = parseFloat( parts[1] );
		}
		// Specular lobe, specular (extension, BRDF: Shirley-Ashikhmin)
		else if( parts[0] === "Rs" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <Rs>. Ignoring attribute." );
				return;
			}

			mtl.Rs = parseFloat( parts[1] );
		}
		// Specular lobe, diffuse (extension, BRDF: Shirley-Ashikhmin)
		else if( parts[0] === "Rd" ) {
			if( parts.length < 2 ) {
				UI.printWarning( "[MtlLoader] Not enough parameters for <Rd>. Ignoring attribute." );
				return;
			}

			mtl.Rd = parseFloat( parts[1] );
		}
	}.bind( this ) );

	if( this._materials.length > 0 ) {
		this._materials.push( mtl );
	}
};