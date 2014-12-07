"use strict";


var Camera = {


	_center: new THREE.Vector3(),
	_eye: new THREE.Vector3(),
	_rot: new THREE.Vector2(),
	_speed: CFG.CAMERA.SPEED,
	_up: new THREE.Vector3(),
	_updateCallback: null,


	/**
	 * Initialize the camera.
	 * @param {Function} fn Function to call when the camera has an update.
	 */
	init: function( fn ) {
		this._updateCallback = fn;
		this.reset();
	},


	/**
	 * Get the adjusted center vector.
	 * @return {THREE.Vector3}
	 */
	getAdjustedCenter: function() {
		return new THREE.Vector3(
			this._eye.x + this._center.x,
			this._eye.y - this._center.y,
			this._eye.z - this._center.z
		);
	},


	/**
	 * Get the center vector.
	 * @return {THREE.Vector3}
	 */
	getCenter: function() {
		return this._center.clone();
	},


	/**
	 * Get the eye vector.
	 * @return {THREE.Vector3}
	 */
	getEye: function() {
		return this._eye.clone();
	},


	/**
	 * Get the x rotation.
	 * @return {float}
	 */
	getRotX: function() {
		return this._rot.x;
	},


	/**
	 * Get the y rotation.
	 * @return {float}
	 */
	getRotY: function() {
		return this._rot.y;
	},


	/**
	 * Get the up vector.
	 * @return {THREE.Vector3}
	 */
	getUp: function() {
		return this._up.clone();
	},


	/**
	 * Move the camera backwards.
	 */
	moveBackward: function() {
		this._eye.x -= Math.sin( MathHelp.degToRad( this._rot.x ) ) *
		               Math.cos( MathHelp.degToRad( this._rot.y ) ) *
		               this._speed;
		this._eye.y += Math.sin( MathHelp.degToRad( this._rot.y ) ) * this._speed;
		this._eye.z += Math.cos( MathHelp.degToRad( this._rot.x ) ) *
		               Math.cos( MathHelp.degToRad( this._rot.y ) ) *
		               this._speed;
		this._updateCallback();
	},


	/**
	 * Move the camera downwards.
	 */
	moveDown: function() {
		this._eye.y -= this._speed;
		this._updateCallback();
	},


	/**
	 * Move the camera forwards.
	 */
	moveForward: function() {
		this._eye.x += Math.sin( MathHelp.degToRad( this._rot.x ) ) *
		               Math.cos( MathHelp.degToRad( this._rot.y ) ) *
		               this._speed;
		this._eye.y -= Math.sin( MathHelp.degToRad( this._rot.y ) ) * this._speed;
		this._eye.z -= Math.cos( MathHelp.degToRad( this._rot.x ) ) *
		               Math.cos( MathHelp.degToRad( this._rot.y ) ) *
		               this._speed;
		this._updateCallback();
	},


	/**
	 * Move the camera to the left.
	 */
	moveLeft: function() {
		this._eye.x -= Math.cos( MathHelp.degToRad( this._rot.x ) ) * this._speed;
		this._eye.z -= Math.sin( MathHelp.degToRad( this._rot.x ) ) * this._speed;
		this._updateCallback();
	},


	/**
	 * Move the camera to the right.
	 */
	moveRight: function() {
		this._eye.x += Math.cos( MathHelp.degToRad( this._rot.x ) ) * this._speed;
		this._eye.z += Math.sin( MathHelp.degToRad( this._rot.x ) ) * this._speed;
		this._updateCallback();
	},


	/**
	 * Move the camera upwards.
	 */
	moveUp: function() {
		this._eye.y += this._speed;
		this._updateCallback();
	},


	/**
	 * Reset the camera to the defaults.
	 */
	reset: function() {
		var cfg = CFG.CAMERA;

		this._eye = new THREE.Vector3( cfg.EYE[0], cfg.EYE[1], cfg.EYE[2] );
		this._up = new THREE.Vector3( 0.0, 1.0, 0.0 );
		this._rot = new THREE.Vector2( 0.0, 0.0 );
		this.updateRotation( 0, 0 );
		this._center = new THREE.Vector3( cfg.CENTER[0], cfg.CENTER[1], cfg.CENTER[2] );
		this._center.normalize();
	},


	/**
	 * Set the movement speed of the camera.
	 */
	setSpeed: function( speed ) {
		this._speed = parseFloat( speed );
	},


	/**
	 * Update the rotation with the mouse movement.
	 * @param {int} moveX Pixel distance the mouse travelled on the X axis.
	 * @param {int} moveY Pixel distance the mouse travelled on the Y axis.
	 */
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

		this._updateCallback();
	}


};