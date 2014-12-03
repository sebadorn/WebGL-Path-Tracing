"use strict";


var UI = {


	_oldMouseX: false,
	_oldMouseY: false,
	canvas: null,
	stats: null,
	stdout: null,


	/**
	 * Initialize UI elements.
	 */
	init: function() {
		this.stdout = document.getElementById( "stdout" );

		var inputImport = document.getElementById( "file-import" );
		var load = SceneManager.loadModelFile.bind( SceneManager );
		inputImport.addEventListener( "change", load );

		this.stats = new Stats();
		this.stats.setMode( 0 );
		document.body.appendChild( this.stats.domElement );

		this.initCanvas();
	},


	/**
	 * Get the canvas.
	 * @return {DOMElement} The canvas.
	 */
	getCanvas: function() {
		return this.canvas;
	},


	/**
	 * Initialize the canvas element.
	 */
	initCanvas: function() {
		this.canvas = document.getElementById( "render-target" );

		if( !this.canvas ) {
			UI.printError( "No canvas#render-target found!" );
			return null;
		}

		if( CFG.WINDOW.FULLSCREEN ) {
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;
		}
		else {
			this.canvas.width = CFG.WINDOW.WIDTH;
			this.canvas.height = CFG.WINDOW.HEIGHT;
		}

		gHeight = this.canvas.height;
		gWidth = this.canvas.width;

		this.canvas.addEventListener( "mousemove", this.mouseMove.bind( this ) );
	},


	mouseMove: function( ev ) {
		if( ev.button != 1 ) {
			return;
		}

		if( this._oldMouseX === false ) {
			this._oldMouseX = ev.clientX;
			this._oldMouseY = ev.clientY;

			return;
		}

		var moveX = this._oldMouseX - ev.clientX,
		    moveY = this._oldMouseY - ev.clientY;

		this._oldMouseX = ev.clientX;
		this._oldMouseY = ev.clientY;

		Camera.updateRotation( moveX, moveY );
	},


	/**
	 * Print a (HTML) message to the UI.
	 * @param {string} msg   Message to log. Can contain HTML.
	 * @param {string} className Class name for the message. (Optional.)
	 */
	print: function( msg, className ) {
		while( this.stdout.children.length >= CFG.UI.STDOUT_MAX ) {
			this.stdout.removeChild( this.stdout.children[0] );
		}

		var child = document.createElement( "li" );

		if( className ) {
			child.className = className;
		}

		child.innerHTML = msg;
		this.stdout.appendChild( child );
		this.stdout.scrollTop = this.stdout.scrollHeight;
	},


	/**
	 * Print a (HTML) error message to the UI.
	 * @param {string} msg Message to log. Can contain HTML.
	 */
	printError: function( msg ) {
		this.print( msg, "error" );
	},


	/**
	 * Print a (HTML) warning message to the UI.
	 * @param {string} msg Message to log. Can contain HTML.
	 */
	printWarning: function( msg ) {
		this.print( msg, "warn" );
	},


	/**
	 * Handle window resize events.
	 * @param {Event} ev Resize event.
	 */
	resize: function( ev ) {
		if( CFG.WINDOW.FULLSCREEN ) {
			this.canvas.height = ev.target.innerHeight;
			this.canvas.width = ev.target.innerWidth;
			gHeight = this.canvas.height;
			gWidth = this.canvas.width;
		}
	}


};
