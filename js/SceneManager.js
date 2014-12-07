"use strict";


var SceneManager = {


	_scene: {
		bvh: null,
		materials: null,
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

		if( this._scene.materials !== null ) {
			ShaderLoader.load();
		}
	},


	/**
	 * Set the loaded material data.
	 * @param {Object} mtl Material data for the scene.
	 */
	_setMaterialData: function( mtl ) {
		this._scene.materials = mtl;

		if( this._scene.bvh !== null ) {
			ShaderLoader.load();
		}
	},


	/**
	 * Get data about the acceleration structure that will be needed in the shader(s).
	 * @return {Object} Data about the acceleration structure.
	 */
	getAccStructData: function() {
		var bvhStrings = this.getBVHShaderData();

		return {
			bvh: {
				depth: this._scene.bvh.depthReached,
				facesStr: bvhStrings.faces,
				nodesStr: bvhStrings.nodes,
				numFaces: bvhStrings.numFaces,
				numNodes: this._scene.bvh.nodes.length
			},
			kd: { // TODO: kd-tree not yet available
				numFaces: 0,
				numLeaves: 0,
				numNonLeaves: 0
			},
			numFaces: this._scene.model.facesV.length / 3,
			numMaterials: this._scene.materials.length
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
			if( !n.leftChild ) {
				for( var j = 0; j < n.faces.length; j++ ) {
					var f = n.faces[j].face;
					facesStr += "bvhFaces[" + j + "] = " + f.w + ";\n";
				}

				numFaces += n.faces.length;
			}

			var facesStart = ( !n.leftChild ) ? numFaces : -1;
			var facesLength = ( !n.leftChild ) ? n.faces.length : 0;

			// node data
			var initStr = "";
			initStr = "vec3( " + n.bb.min.x + ", " + n.bb.min.y + ", " + n.bb.min.z + " ), "; // bbMin
			initStr += "vec3( " + n.bb.max.x + ", " + n.bb.max.y + ", " + n.bb.max.z + " ), "; // bbMax
			initStr += "ivec2( " + facesStart + ", " + facesLength + " ), "; // facesInterval
			initStr += ( n.leftChild ? n.leftChild.id : -1 ) + ", "; // leftChild
			initStr += ( n.rightChild ? n.rightChild.id : -1 ); // rightChild

			nodesStr += "bvh[" + i + "] = bvhNode( " + initStr + " );\n";
		}

		return {
			faces: facesStr,
			nodes: nodesStr,
			numFaces: numFaces
		};
	},


	/**
	 * Load material data for the scene from a file.
	 * @param {Event} ev
	 */
	loadMaterialFile: function( ev ) {
		if( !ev.target.files[0] ) {
			UI.printError( "[SceneManager] No file has been uploaded." );
			return;
		}

		var mtll = new MtlLoader();
		mtll.load( ev.target.files[0], this._setMaterialData.bind( this ) );
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
