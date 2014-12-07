"use strict";


/**
 * Struct for holding basic data about a 3D object.
 * @constructor
 * @param {String} objectName Name of the 3D object.
 */
var Object3D = function( objectName ) {
	this.name = objectName || "";

	this.facesV = [];
	this.facesVN = [];
	this.facesVT = [];
};


var Face = function() {
	// Vertex indices
	this.a = false;
	this.b = false;
	this.c = false;
	// Vertex normal indices
	this.an = false;
	this.bn = false;
	this.cn = false;
	// Material name
	this.material = "";
};



/**
 * Class for loading an OBJ model.
 * @constructor
 */
var ObjLoader = function() {
	this._faces = []; // <Array<Face>>

	this.facesV = [];
	this.facesVN = [];
	this.facesVT = [];
	this._normals = [];
	this.objects = [];
	this.vertexTextures = [];
	this._vertices = [];
};


/**
 * Get the loaded OBJ data.
 * @return {Object} Object with data about faces and vertices.
 */
ObjLoader.prototype.getObj = function() {
	return {
		faces: this._faces,
		facesV: this.facesV,
		facesVN: this.facesVN,
		facesVT: this.facesVT,
		normals: this._normals,
		objects: this.objects,
		vertexTextures: this.vertexTextures,
		vertices: this._vertices
	};
};


/**
 * Load an OBJ from file.
 * @param {File}     file     File to read.
 * @param {Function} callback Function to call after loaded has been finished.
 */
ObjLoader.prototype.load = function( file, callback ) {
	var fr = new FileReader();

	fr.addEventListener( "load", function( ev ) {
		this.parse( ev.target.result );
		UI.print( "[ObjLoader] Loaded " + this.objects.length + " objects:" );
		UI.print( "- faces: " + this.facesV.length );
		UI.print( "- vertices: " + this._vertices.length );
		callback( this.getObj() );
	}.bind( this ) );

	fr.readAsText( file );
};


/**
 * Parse the content of the read OBJ file.
 * @param {string} objText Content of file.
 */
ObjLoader.prototype.parse = function( objText ) {
	var lines = objText.match( /[^\r\n]+/g );
	var currentMaterial = "";

	lines.forEach( function( line, index, array ) {
		line = line.trim();

		if( line.length < 3 ) {
			return;
		}

		// Ignore comment lines
		if( line[0] === "#" ) {
			return;
		}

		// 3D object
		if( line[0] === "o" ) {
			var parts = line.split( /\s+/g );

			if( parts.length < 2 ) {
				UI.printWarning( "[ObjLoader] Encountered object without name." );
				return;
			}

			this.objects.push( new Object3D( parts[1] ) );
		}

		// Vertex data of some form
		else if( line[0] === "v" ) {
			// Vertex
			if( line[1] === " " ) {
				this._parseVertex( line );
			}
			// Vertex normal
			else if( line[1] === "n" && line[2] === " " ) {
				this._parseVertexNormal( line );
			}
			// Vertex texture
			else if( line[1] === "t" && line[2] === " " ) {
				UI.printWarning( "[ObjLoader] TODO: Handle 'vt' lines." );
			}
		}

		// Face
		else if( line[0] === "f" && line[1] === " " ) {
			var lineFaces = this._parseFace( line );

			var face = new Face();
			face.material = currentMaterial;
			face.a = lineFaces.facesV[0];
			face.b = lineFaces.facesV[1];
			face.c = lineFaces.facesV[2];
			face.an = lineFaces.facesVN[0];
			face.bn = lineFaces.facesVN[1];
			face.cn = lineFaces.facesVN[2];

			this._faces.push( face );

			if( this.objects.length > 0 ) {
				var o = this.objects[this.objects.length - 1];
				o.facesV = o.facesV.concat( lineFaces.facesV );
				o.facesVN = o.facesVN.concat( lineFaces.facesVN );
				o.facesVT = o.facesVT.concat( lineFaces.facesVT );
			}
		}

		// Material
		else if( line.search( /^usemtl / ) === 0 ) {
			var parts = line.split( /\s+/g );

			currentMaterial = parts[1];
		}
	}.bind( this ) );
};


/**
 * Parse a line that contains face data.
 * @param {string} line A line in the OBJ file.
 */
ObjLoader.prototype._parseFace = function( line ) {
	var parts = line.split( /\s+/g );
	var numFaces = this.facesV.length;

	var lineFacesV = [],
	    lineFacesVN = [],
	    lineFacesVT = [];

	for( var i = 1; i < parts.length; i++ ) {
		var a;
		var e0 = parts[i].split( "/" );
		var e1 = parts[i].split( "//" );

		// "v//vn"
		if( e1.length == 2 ) {
			// "v"
			a = parseInt( e1[0] );
			a = ( a < 0 ) ? numFaces - a : a;
			lineFacesV.push( a - 1 );

			// "vn"
			a = parseInt( e1[1] );
			a = ( a < 0 ) ? numFaces - a : a;
			lineFacesVN.push( a - 1 );
		}
		else {
			// "v"
			a = parseInt( e0[0] );
			a = ( a < 0 ) ? numFaces - a : a;
			lineFacesV.push( a - 1 );

			// "v/vt"
			if( e0.length >= 2 ) {
				a = parseInt( e0[1] );
				a = ( a < 0 ) ? numFaces - a : a;
				lineFacesVT.push( a - 1 );
			}

			// "v/vt/vn"
			if( e0.length >= 3 ) {
				a = parseInt( e0[2] );
				a = ( a < 0 ) ? numFaces - a : a;
				lineFacesVN.push( a - 1 );
			}
		}
	}

	this.facesV = this.facesV.concat( lineFacesV );
	this.facesVN = this.facesVN.concat( lineFacesVN );
	this.facesVT = this.facesVT.concat( lineFacesVT );

	return {
		facesV: lineFacesV,
		facesVN: lineFacesVN,
		facesVT: lineFacesVT
	};
};


/**
 * Parse a line that contains vertex data.
 * @param {string} line A line in the OBJ file.
 */
ObjLoader.prototype._parseVertex = function( line ) {
	var parts = line.split( /\s+/g );

	this._vertices.push(
		parseFloat( parts[1] ),
		parseFloat( parts[2] ),
		parseFloat( parts[3] )
	);
};


/**
 * Parse a line that contains vertex normal data.
 * @param {string} line A line in the OBJ file.
 */
ObjLoader.prototype._parseVertexNormal = function( line ) {
	var parts = line.split( /\s+/g );

	this._normals.push(
		parseFloat( parts[1] ),
		parseFloat( parts[2] ),
		parseFloat( parts[3] )
	);
};


ObjLoader.getFaceNormalsOfObject = function( object, offset ) {
	var faceNormals = [];

	for( var i = 0; i < object.facesVN.length; i += 3 ) {
		var f = {
			a: object.facesVN[i],
			b: object.facesVN[i + 1],
			c: object.facesVN[i + 2],
			w: offset + faceNormals.length
		};

		faceNormals.push( f );
	}

	return faceNormals;
};


ObjLoader.getFacesOfObject = function( object, offset ) {
	var faces = [];

	for( var i = 0; i < object.facesV.length; i += 3 ) {
		var f = {
			a: object.facesV[i],
			b: object.facesV[i + 1],
			c: object.facesV[i + 2],
			w: offset + faces.length
		}

		faces.push( f );
	}

	return faces;
};