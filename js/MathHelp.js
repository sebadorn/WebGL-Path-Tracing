"use strict";


var MathHelp = {


	degToRad: function( deg ) {
		return ( deg * Math.PI / 180.0 );
	},


	getAABB: function( a, b ) {
		var bb = new THREE.Box3();

		// a: bbMins, b: bbMaxs
		if( a && b ) {
			for( var i = 0; i < a.length; i++ ) {
				bb.expandByPoint( a[i] );
				bb.expandByPoint( b[i] );
			}
		}
		// a: vertices
		else {
			for( var i = 0; i < a.length; i++ ) {
				bb.expandByPoint( a[i] );
			}
		}

		return bb;
	},


	getSurfaceArea: function( bb ) {
		var xy = 2.0 * Math.abs( bb.max.x - bb.min.x ) * Math.abs( bb.max.y - bb.min.y );
		var zy = 2.0 * Math.abs( bb.max.z - bb.min.z ) * Math.abs( bb.max.y - bb.min.y );
		var xz = 2.0 * Math.abs( bb.max.x - bb.min.x ) * Math.abs( bb.max.z - bb.min.z );

		return xy + zy + xz;
	},


	radToDeg: function( rad ) {
		return ( rad * 180.0 / Math.PI );
	}


};