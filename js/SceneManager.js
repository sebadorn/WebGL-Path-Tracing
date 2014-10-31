"use strict";


var SceneManager = {


	_scene: {
		models: []
	},


	addObj: function( obj ) {
		SceneManager._scene.models.push( obj );
	},


	loadModelFile: function( ev ) {
		if( !ev.target.files[0] ) {
			UI.printError( "[SceneManager] No file has been uploaded." );
			return;
		}

		var objl = new ObjLoader();
		objl.load( ev.target.files[0], SceneManager.addObj );
	}


};