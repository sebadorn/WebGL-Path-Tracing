"use strict";


var Tri = function() {
	this.face = {
		a: -1,
		b: -1,
		c: -1,
		w: -1
	};
	this.bb = new THREE.Box3();
};


/**
 * Calculate and set the AABB of the Tri (face).
 * @param {THREE.Vector3} fn       Face normals of the triangle.
 * @param {array<float>}  vertices All vertices.
 * @param {array<float>}  normals  All normals.
 */
Tri.prototype.calcAABB = function( fn, vertices, normals ) {
	var v = [
		vertices[this.face.a],
		vertices[this.face.b],
		vertices[this.face.c]
	];
	var bb = MathHelp.getAABB( v );

	this.bb.set( bb.min, bb.max );

	// ALPHA <= 0.0, no Phong Tessellation
	if( CFG.SHADER.PHONG_TESSELLATION <= 0.0 ) {
		return;
	}

	// TODO: Phong Tessellation
};


Tri.prototype.getCenter = function() {
	return this.bb.min.clone().add( this.bb.max ).multiplayScalar( 0.5 );
};


Tri.getCenter = function( v0, v1, v2 ) {
	var bb = MathHelp.getAABB( [v0, v1, v2] );

	return ( bb.max.sub( bb.min ) ).multiplayScalar( 0.5 );
};


Tri.getCentroid = function( v0, v1, v2 ) {
	var r = v0.clone();

	return r.add( v1 ).add( v2 ).divideScalar( 3.0 );
};