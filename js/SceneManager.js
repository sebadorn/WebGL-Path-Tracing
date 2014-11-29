"use strict";


var SceneManager = {


	_scene: {
		bvh: null,
		model: null
	},


	/**
	 * Build an acceleration structure from the loaded scene.
	 * @param {Object} obj 3D scene data.
	 */
	_buildAccStruct: function( obj ) {
		var startTime = Date.now();
		this._scene.model = obj;
		this._scene.bvh = new BVH( obj.objects, obj.vertices, obj.normals );

		UI.print( "[SceneManager] Created BVH in " + ( Date.now() - startTime ) + " ms." );
		UI.print( "[SceneManager] Loading shaders ..." );

		ShaderLoader.load();
	},


	/**
	 * Get data about the acceleration structure that will be needed in the shader(s).
	 * @return {Object} Data about the acceleration structure.
	 */
	getAccStructData: function() {
		return {
			bvh: {
				depth: this._scene.bvh.depthReached,
				numFaces: 0, // TODO: ?
				numNodes: this._scene.bvh.nodes.length
			},
			kd: { // TODO: kd-tree not yet available
				numFaces: 0,
				numLeaves: 0,
				numNonLeaves: 0
			},
			numFaces: this._scene.model.facesV.length / 3,
			numMaterials: 1 // TODO: load materials and get number here
		};
	},


	/**
	 * Get BVH data as string to inject directly into GLSL code instead of passing it per OpenGL.
	 * @return {Object} Object with strings for nodes and faces.
	 */
	getBVHShaderData: function() {
		var facesStr = "";
		var nodesStr = "";
		var nodes = this._scene.bvh.nodes;
		var numFaces = 0;

		for( var i = 0; i < nodes.length; i++ ) {
			var n = nodes[i];

			// faces of leaf node
			for( var j = 0; j < n.faces.length; j++ ) {
				var f = n.faces[j].face;
				facesStr += f.w;
				facesStr += ( j < n.faces.length - 1 ) ? ", " : "";
			}

			numFaces += n.faces.length;

			var facesStart = ( n.faces.length > 0 ) ? numFaces : -1;

			// node data
			var initStr = "";
			initStr = "vec3( " + n.bb.min.x + ", " + n.bb.min.y + ", " + n.bb.min.z + " ), "; // bbMin
			initStr += "vec3( " + n.bb.max.x + ", " + n.bb.max.y + ", " + n.bb.max.z + " ), "; // bbMax
			initStr += "ivec2( " + facesStart + ", " + n.faces.length + " ), "; // facesInterval
			initStr += ( n.leftChild ? n.leftChild.id : -1 ) + ", "; // leftChild
			initStr += ( n.rightChild ? n.rightChild.id : -1 ); // rightChild

			nodesStr += "bvhNode( " + initStr + " )";
			nodesStr += ( i < nodes.length - 1 ) ? ",\n" : "";
		}

		return {
			faces: facesStr,
			nodes: nodesStr
		};
	},


	/**
	 * Load a 3D scene from a file.
	 * @param {Event} ev Event that contains file information about the model to load.
	 */
	loadModelFile: function( ev ) {
		if( !ev.target.files[0] ) {
			UI.printError( "[SceneManager] No file has been uploaded." );
			return;
		}

		var objl = new ObjLoader();
		objl.load( ev.target.files[0], this._buildAccStruct.bind( this ) );
	}


};
