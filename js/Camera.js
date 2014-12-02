"use strict";


var Camera = {


	_eye: null,
	_parent: null,
	_rot: null,
	_speed: CFG.CAMERA.SPEED,
	_up: null,


	init: function( parent ) {
		this._parent = parent;
		this.reset();
	},


	getAdjustedCenter: function() {
		return new THREE.Vector3(
			this._eye.x + this._center.x,
			this._eye.y - this._center.y,
			this._eye.z - this._center.z
		);
	},


	getCenter: function() {
		return this._center.clone();
	},


	getEye: function() {
		return this._eye.clone();
	},


	getRotX: function() {
		return this._rot.x;
	},


	getRotY: function() {
		return this._rot.y;
	},


	getUp: function() {
		return this._up.clone();
	},


	moveBackward: function() {
		this._eye.x -= Math.sin( MathHelp.degToRad( this._rot.x ) ) *
		               Math.cos( MathHelp.degToRad( this._rot.y ) ) *
		               this._speed;
		this._eye.y += Math.sin( MathHelp.degToRad( this._rot.y ) ) * this._speed;
		this._eye.z += Math.cos( MathHelp.degToRad( this._rot.x ) ) *
		               Math.cos( MathHelp.degToRad( this._rot.y ) ) *
		               this._speed;
		this.updateParent();
	},


	moveDown: function() {
		this._eye.y -= this._speed;
		this.updateParent();
	},


	moveForward: function() {
		this._eye.x += Math.sin( MathHelp.degToRad( this._rot.x ) ) *
		               Math.cos( MathHelp.degToRad( this._rot.y ) ) *
		               this._speed;
		this._eye.y -= Math.sin( MathHelp.degToRad( this._rot.y ) ) * this._speed;
		this._eye.z -= Math.cos( MathHelp.degToRad( this._rot.x ) ) *
		               Math.cos( MathHelp.degToRad( this._rot.y ) ) *
		               this._speed;
		this.updateParent();
	},


	moveLeft: function() {
		this._eye.x -= Math.cos( MathHelp.degToRad( this._rot.x ) ) * this._speed;
		this._eye.z -= Math.sin( MathHelp.degToRad( this._rot.x ) ) * this._speed;
		this.updateParent();
	},


	moveRight: function() {
		this._eye.x += Math.cos( MathHelp.degToRad( this._rot.x ) ) * this._speed;
		this._eye.z += Math.sin( MathHelp.degToRad( this._rot.x ) ) * this._speed;
		this.updateParent();
	},


	moveUp: function() {
		this._eye.y += this._speed;
		this.updateParent();
	},


	reset: function() {
		var cfg = CFG.CAMERA;

		this._eye = new THREE.Vector3( cfg.EYE[0], cfg.EYE[1], cfg.EYE[2] );
		this._up = new THREE.Vector3( 0.0, 1.0, 0.0 );
		this._rot = new THREE.Vector2( 0.0, 0.0 );
		this.updateRotation( 0, 0 );
		this._center = new THREE.Vector3( cfg.CENTER[0], cfg.CENTER[1], cfg.CENTER[2] );
		this._center.normalize();
	},


	setSpeed: function( speed ) {
		this._speed = parseFloat( speed );
	},


	updateRotation: function( moveX, moveY ) {
		this._rot.x -= moveX;
		this._rot.y -= moveY;

		if( this._rot.x >= 360.0 ) {
			this._rot.x = 0.0;
		}
		else if( this._rot.x < 0.0 ) {
			this._rot.x = 360.0;
		}

		if( this._rot.y > 90.0 ) {
			this._rot.y = 90.0;
		}
		else if( this._rot.y < -90.0 ) {
			this._rot.y = -90.0;
		}

		this._center.x = Math.sin( MathHelp.degToRad( this._rot.x ) ) -
		                 Math.abs( Math.sin( MathHelp.degToRad( this._rot.y ) ) ) *
		                 Math.sin( MathHelp.degToRad( this._rot.x ) );
		this._center.y = Math.sin( MathHelp.degToRad( this._rot.y ) );
		this._center.z = Math.cos( MathHelp.degToRad( this._rot.x ) ) -
		                 Math.abs( Math.sin( MathHelp.degToRad( this._rot.y ) ) ) *
		                 Math.cos( MathHelp.degToRad( this._rot.x ) );

		if( this._center.y == 1.0 ) {
			this._up.x = Math.sin( MathHelp.degToRad( this._rot.x ) );
		}
		else if( this._center.y == -1.0 ) {
			this._up.x = -Math.sin( MathHelp.degToRad( this._rot.x ) );
		}
		else {
			this._up.x = 0.0;
		}

		this._up.y = ( this._center.y == 1.0 || this._center.y == -1.0 ) ? 0.0 : 1.0;

		if( this._center.y == 1.0 ) {
			this._up.z = -Math.cos( MathHelp.degToRad( this._rot.x ) );
		}
		else if( this._center.y == -1.0 ) {
			this._up.z = Math.cos( MathHelp.degToRad( this._rot.x ) );
		}
		else {
			this._up.z = 0.0;
		}

		this.updateParent();
	},


	updateParent: function() {
		if( this._parent ) {
			this._parent.cameraUpdate();
		}
	}


};