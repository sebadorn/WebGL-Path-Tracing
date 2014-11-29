"use strict";


/**
 * A node in the BVH.
 * @constructor
 */
var BVHNode = function() {
	this.leftChild = null;
	this.rightChild = null;
	this.faces = [];
	this.bb = new THREE.Box3();
	this.id = false;
	this.depth = 0;
};



/**
 * Constructor.
 * @param {Array<Object3D>} objects
 * @param {Array<float>}    vertices
 * @param {Array<float>}    normals
 */
var BVH = function( objects, vertices, normals ) {
	this.containerNodes = [];
	this.leafNodes = [];
	this.nodes = [];
	this.depthReached = 0;

	var subTrees = this.buildTreesFromObjects( objects, vertices, normals );
	this.rootNode = this.makeContainerNode( subTrees, true );
	this.groupTreesToNodes( subTrees, this.rootNode, this.depthReached );
	this.combineNodes( subTrees.length );
};


/**
 *
 * @param  {Array<Tri>} faces
 * @param  {THREE.Box3} bb
 * @param  {int}        depth
 * @param  {boolean}    useGivenBB
 * @param  {float}      rootSA
 * @return {BVHNode}
 */
BVH.prototype.buildTree = function( faces, bb, depth, useGivenBB, rootSA ) {
	var containerNode = this.makeNode( faces, false );

	if( useGivenBB ) {
		containerNode.bb = bb.clone();
	}

	containerNode.depth = depth;
	this.depthReached = Math.max( depth, this.depthReached );

	// leaf node
	if( faces.length <= CFG.BVH.MAX_FACES ) {
		if( faces.length <= 0 ) {
			UI.printError( "[BVH] No faces in node." );
		}

		containerNode.faces = faces;

		return containerNode;
	}

	var leftFaces = [],
	    rightFaces = [];
	var bbLeft = new THREE.Box3(),
	    bbRight = new THREE.Box3();

	useGivenBB = false;

	// SAH takes some time. Don't do it if there are too many faces.
	if( faces.length <= CFG.BVH.SAH_FACES_LIMIT ) {
		var result = this.buildWithSAH( containerNode, faces );
		var objectSAH = result.SAH;
		var lambda = result.lambda / rootSA;

		leftFaces = result.leftFaces;
		rightFaces = result.rightFaces;

		// TODO: spatial splits for comparison and improvement
		if( lambda > 0.00001 && CFG.BVH.USE_SPATIAL_SPLITS ) {
			UI.printWarning( "[BVH] Spatial Splits not implemented." );
		}
	}
	// Faster to build: Splitting at the midpoint of the longest axis
	else {
		UI.print( "[BVH] Too many faces in node for SAH. Splitting by midpoint." );
		var result = this.buildWithMidpointSplit( containerNode, faces );

		leftFaces = result.leftFaces;
		rightFaces = result.rightFaces;
	}

	if(
		leftFaces.length == 0 ||
		rightFaces.length == 0 ||
		leftFaces.length == faces.length ||
		rightFaces.length == faces.length
	) {
		if( faces.length <= 0 ) {
			UI.printWarning( "[BVH] No faces in node." );
		}

		containerNode.faces = faces;

		return containerNode;
	}

	containerNode.leftChild = this.buildTree( leftFaces, bbLeft, depth + 1, useGivenBB, rootSA );
	containerNode.rightChild = this.buildTree( rightFaces, bbRight, depth + 1, useGivenBB, rootSA );

	return containerNode;
};


/**
 *
 * @param  {array<Object3D>} objects
 * @param  {array<float>}    vertices
 * @param  {array<float>}    normals
 * @return {array<BVHNode>}
 */
BVH.prototype.buildTreesFromObjects = function( objects, vertices, normals ) {
	var subTrees = [];
	var offset = 0,
	    offsetN = 0;

	var vertices3 = this.packVerticesAsVectors( vertices );

	for( var i = 0; i < objects.length; i++ ) {
		var facesThisObj = ObjLoader.getFacesOfObject( objects[i], offset );
		offset += facesThisObj.length;

		var faceNormalsThisObj = ObjLoader.getFaceNormalsOfObject( objects[i], offsetN );
		offsetN += faceNormalsThisObj.length;

		var triFaces = this.facesToTriStructs(
			facesThisObj, faceNormalsThisObj, vertices3, normals
		);

		var rootNode = this.makeNode( triFaces, true );
		var rootSA = MathHelp.getSurfaceArea( rootNode.bb );

		var st = this.buildTree( triFaces, new THREE.Box3(), 1, false, rootSA );
		subTrees.push( st );
	}

	return subTrees;
};


/**
 *
 * @param {BVHNode}    node
 * @param {array<Tri>} faces
 * @param {array<Tri>} leftFaces
 * @param {array<Tri>} rightFaces
 */
BVH.prototype.buildWithMidpointSplit = function( node, faces ) {
	var axis = this.longestAxis( node );
	var splitPos = 0.5 * ( node.bb.min.toArray()[axis] + node.bb.max.toArray()[axis] );

	var result = this.splitFaces( faces, splitPos, axis );

	if( leftFaces.length <= 0 || rightFaces.length <= 0 ) {
		UI.printWarning( "[BVH] Splitting faces by midpoint didn't work. Trying again with mean." );

		leftFaces = [];
		rightFaces = [];
		splitPos = this.getMean( faces, axis );

		result = this.splitFaces( faces, splitPos, axis );
	}

	return {
		leftFaces: result.leftFaces,
		rightFaces: result.rightFaces
	}
};


/**
 *
 * @param  {BVHNode}    node
 * @param  {array<Tri>} faces
 * @return {Object}
 */
BVH.prototype.buildWithSAH = function( node, faces ) {
	var leftFaces = [],
	    rightFaces = [];
	var lambda = Infinity;
	var nodeSA = MathHelp.getSurfaceArea( node.bb );
	var bestSAH = nodeSA * faces.length; // TODO
	bestSAH = Infinity;

	for( var axis = 0; axis <= 2; axis++ ) {
		var result = this.splitBySAH( 1.0 / nodeSA, bestSAH, axis, faces, leftFaces, rightFaces, lambda );
		bestSAH = result.bestSAH;
		lambda = result.lambda;
		leftFaces = result.leftFaces;
		rightFaces = result.rightFaces;
	}

	return {
		SAH: bestSAH,
		lambda: lambda,
		leftFaces: leftFaces,
		rightFaces: rightFaces
	};
};


/**
 * Calculate the SAH value.
 * @param  {float} nodeSA_recip
 * @param  {float} leftSA
 * @param  {int}   leftNumFaces
 * @param  {float} rightSA
 * @param  {int}   rightNumFaces
 * @return {float}
 */
BVH.prototype.calcSAH = function( nodeSA_recip, leftSA, leftNumFaces, rightSA, rightNumFaces ) {
	return ( nodeSA_recip * ( leftSA * leftNumFaces + rightSA * rightNumFaces ) );
};


/**
 * Combine the container nodes and the root node into one list.
 * Create a separate list of leaf nodes.
 * @param {int} numSubTrees The number of generated trees (one for each 3D object).
 */
BVH.prototype.combineNodes = function( numSubTrees ) {
	if( numSubTrees > 1 ) {
		this.nodes.push( this.rootNode );
	}

	this.nodes = this.nodes.concat( this.containerNodes );

	for( var i = 0; i < this.nodes.length; i++ ) {
		this.nodes[i].id = i;

		if( this.nodes[i].faces.length > 0 ) {
			this.leafNodes.push( this.nodes[i] );
		}
	}
};


/**
 *
 * @param  {BVHNode}      node
 * @param  {int}          axis
 * @param  {array<float>} splitPos
 * @return {Object}
 */
BVH.prototype.createBinCombinations = function( node, axis, splitPos ) {
	var leftBin = [],
	    rightBin = [];

	for( var i = 0; i < splitPos.length; i++ ) {
		leftBin.push( new THREE.Box3() );
		leftBin[i].min = node.bb.min.clone();
		leftBin[i].max = node.bb.max.clone();

		if( axis == 0 ) {
			leftBin[i].max.x = splitPos[i];
		}
		else if( axis == 1 ) {
			leftBin[i].max.y = splitPos[i];
		}
		else {
			leftBin[i].max.z = splitPos[i];
		}

		rightBin.push( new THREE.Box3() );
		rightBin[i].min = node.bb.min.clone();
		rightBin[i].max = node.bb.max.clone();

		if( axis == 0 ) {
			rightBin[i].min.x = splitPos[i];
		}
		else if( axis == 1 ) {
			rightBin[i].min.y = splitPos[i];
		}
		else {
			rightBin[i].min.z = splitPos[i];
		}
	}

	return {
		left: leftBin,
		right: rightBin
	};
};


/**
 *
 * @param  {array<Object>}        facesThisObj
 * @param  {array<Object>}        faceNormalsThisObj
 * @param  {array<THREE.Vector3>} vertices
 * @param  {array<THREE.Vector3>} normals
 * @return {array<Tri>}
 */
BVH.prototype.facesToTriStructs = function( facesThisObj, faceNormalsThisObj, vertices, normals ) {
	var triFaces = [];

	for( var i = 0; i < facesThisObj.length; i++ ) {
		var tri = new Tri();
		tri.face = facesThisObj[i];
		tri.calcAABB( faceNormalsThisObj[i], vertices, normals );
		triFaces.push( tri );
	}

	return triFaces;
};


/**
 *
 * @param  {BVHNode}      node
 * @param  {int}          splits
 * @param  {int}          axis
 * @return {array<float>}
 */
BVH.prototype.getBinSplits = function( node, splits, axis ) {
	var pos = [];
	var lenSegment = ( node.bb.max.toArray()[axis] - node.bb.min.toArray()[axis] ) / ( splits + 1.0 );

	pos.push( node.bb.min.toArray()[axis] + lenSegment );

	for( var i = 1; i < splits; i++ ) {
		pos.push( pos[i - 1] + lenSegment );
	}

	// sort ascending
	pos.sort( function( a, b ) { return a - b; } );

	// unique
	pos = pos.filter( function( ele, index ) {
		return ( pos.indexOf( ele ) == index );
	} );

	return pos;
};


/**
 *
 * @param  {array<Tri>} faces
 * @param  {int}        axis
 * @return {float}
 */
BVH.prototype.getMean = function( faces, axis ) {
	var sum = 0.0;

	for( var i = 0; i < faces.length; i++ ) {
		var center = faces[i].bb.min.toArray()[axis] + faces[i].bb.max.toArray()[axis];
		sum += center * 0.5;
	}

	return ( sum / faces.length );
};


/**
 *
 * @param  {array<BVHNode>} nodes
 * @param  {int}            axis
 * @return {float}
 */
BVH.prototype.getMeanOfNodes = function( nodes, axis ) {
	var sum = 0.0;

	for( var i = 0; i < nodes.length; i++ ) {
		var center = nodes[i].bb.max.toArray()[axis] - nodes[i].bb.min.toArray()[axis];
		sum += center * 0.5;
	}

	return ( sum / nodes.length );
};


/**
 *
 * @param {array<BVHNode>} nodes
 * @param {BVHNode}        parent
 * @param {int}            depth
 */
BVH.prototype.groupTreesToNodes = function( nodes, parent, depth ) {
	if( nodes.length == 1 ) {
		return;
	}

	parent.depth = depth;
	this.depthReached = Math.max( depth, this.depthReached );

	if( depth > CFG.BVH.EMERGENCY_DEPTH_LIMIT ) {
		UI.printError( "[BVH] Aborted. Reached tree depth of " + depth + "." );
		return;
	}

	var axis = this.longestAxis( parent );
	var midpoint = ( parent.bb.min.toArray()[axis] + parent.bb.max.toArray()[axis] ) * 0.5;

	var groups = this.splitNodes( nodes, midpoint, axis );

	if( groups.left.length <= 0 || groups.right.length <= 0 ) {
		var mean = this.getMeanOfNodes( nodes, axis );
		groups = this.splitNodes( nodes, mean, axis );
	}

	var leftNode = this.makeContainerNode( groups.left, false );
	parent.leftChild = leftNode;
	this.groupTreesToNodes( groups.left, parent.leftChild, depth + 1 );

	var rightNode = this.makeContainerNode( groups.right, false );
	parent.rightChild = rightNode;
	this.groupTreesToNodes( groups.right, parent.rightChild, depth + 1 );
};


/**
 *
 * @param {array<Tri>}        faces
 * @param {array<THREE.Box3>} leftBB
 * @param {array<THREE.Box3>} rightBB
 * @param {array<float>}      leftSA
 * @param {array<float>}      rightSA
 */
BVH.prototype.growAABBsForSAH = function( faces, leftBB, rightBB, leftSA, rightSA ) {
	var bbMins = [],
	    bbMaxs = [];


	// Grow a bound box face by face starting from the left.
	// Save the growing surface area for each step.

	for( var i = 0; i < faces.length - 1; i++ ) {
		bbMins.push( faces[i].bb.min.clone() );
		bbMaxs.push( faces[i].bb.max.clone() );

		var bb = MathHelp.getAABB( bbMins, bbMaxs );

		leftBB[i] = new THREE.Box3( bb.min, bb.max );
		leftSA[i] = MathHelp.getSurfaceArea( bb );
	}


	// Grow a bounding box face by face starting from the right.
	// Save the growing surface area for each step.

	bbMins = [];
	bbMaxs = [];

	for( var i = faces.length - 2; i >= 0; i-- ) {
		bbMins.push( faces[i + 1].bb.min.clone() );
		bbMaxs.push( faces[i + 1].bb.max.clone() );

		var bb = MathHelp.getAABB( bbMins, bbMaxs );

		rightBB[i] = new THREE.Box3( bb.min, bb.max );
		rightSA[i] = MathHelp.getSurfaceArea( bb );
	}
};


/**
 * Find the longest axis of a node.
 * @param  {BHVNode} node Node to find the longest axis of.
 * @return {int}          Index of the longest axis.
 */
BVH.prototype.longestAxis = function( node ) {
	var sides = node.bb.max.clone().sub( node.bb.min );

	if( sides.x > sides.y ) {
		return ( sides.x > sides.z ) ? 0 : 2;
	}
	else { // sides.y > sides.x
		return ( sides.y > sides.z ) ? 1 : 2;
	}
};


/**
 *
 * @param  {array<BVHNode>} subTrees
 * @param  {boolean}        isRoot
 * @return {BVHNode}
 */
BVH.prototype.makeContainerNode = function( subTrees, isRoot ) {
	if( subTrees.length == 1 ) {
		return subTrees[0];
	}

	var node = new BVHNode();
	node.bb = subTrees[0].bb.clone();

	for( var i = 1; i < subTrees.length; i++ ) {
		node.bb.expandByPoint( subTrees[i].bb.min );
		node.bb.expandByPoint( subTrees[i].bb.max );
	}

	if( !isRoot ) {
		this.containerNodes.push( node );
	}

	return node;
};


/**
 *
 * @param  {array<Tri>} tris
 * @param  {boolean}    ignore
 * @return {BVHNode}
 */
BVH.prototype.makeNode = function( tris, ignore ) {
	var node = new BVHNode();
	var bbMins = [],
	    bbMaxs = [];

	for( var i = 0; i < tris.length; i++ ) {
		bbMins.push( tris[i].bb.min );
		bbMaxs.push( tris[i].bb.max );
	}

	var bb = MathHelp.getAABB( bbMins, bbMaxs );
	node.bb.set( bb.min, bb.max );

	if( !ignore ) {
		this.containerNodes.push( node );
	}

	return node;
};


/**
 *
 * @param  {array<float>}         vertices
 * @return {array<THREE.Vector3>}
 */
BVH.prototype.packVerticesAsVectors = function( vertices ) {
	var vertices3 = [];

	for( var i = 0; i < vertices.length; i += 3 ) {
		var vec = new THREE.Vector3(
			vertices[i],
			vertices[i + 1],
			vertices[i + 2]
		);
		vertices3.push( vec );
	}

	return vertices3;
};


/**
 *
 * @param  {BVHNode}    nodeSA
 * @param  {float}      bestSAH
 * @param  {int}        axis
 * @param  {array<Tri>} faces
 * @param  {float}      lambda
 * @return {Object}
 */
BVH.prototype.splitBySAH = function( nodeSA, bestSAH, axis, faces, leftFaces, rightFaces, lambda ) {
	faces.sort( function( a, b ) {
		var cenA = ( a.bb.max.toArray()[axis] + a.bb.min.toArray()[axis] ) * 0.5;
		var cenB = ( b.bb.max.toArray()[axis] + b.bb.min.toArray()[axis] ) * 0.5;

		return ( cenA < cenB );
	} );

	var leftSA = [],
	    rightSA = [];
	var leftBB = [],
	    rightBB = [];

	this.growAABBsForSAH( faces, leftBB, rightBB, leftSA, rightSA );

	var indexSplit = -1;
	var newSAH, numFacesLeft, numFacesRight;

	for( var i = 0; i < faces.length - 1; i++ ) {
		newSAH = this.calcSAH( nodeSA, leftSA[i], i + 1, rightSA[i], faces.length - i - 1 );

		if( newSAH < bestSAH ) {
			bestSAH = newSAH;
			indexSplit = i + 1;
		}
	}

	if( indexSplit >= 0 ) {
		leftFaces = [];
		rightFaces = [];

		var j = indexSplit - 1;
		var diff = rightBB[j].max.clone().sub( rightBB[j].max.clone().sub( leftBB[j].max ) );
		lambda = diff.x * diff.x + diff.y * diff.y + diff.z * diff.z;

		for( var i = 0; i < indexSplit; i++ ) {
			leftFaces.push( faces[i] );
		}
		for( var i = indexSplit; i < faces.length; i++ ) {
			rightFaces.push( faces[i] );
		}
	}

	return {
		bestSAH: bestSAH,
		lambda: lambda,
		leftFaces: leftFaces,
		rightFaces: rightFaces
	};
};


/**
 *
 * @param {array<Tri>} faces
 * @param {float}      midpoint
 * @param {int}        axis
 */
BVH.prototype.splitFaces = function( faces, midpoint, axis ) {
	var leftFaces = [],
	    rightFaces = [];

	for( var i = 0; i < faces.length; i++ ) {
		var tri = faces[i];
		var cen = tri.getCenter().toArray();

		if( cen[axis] < midpoint ) {
			leftFaces.push( tri );
		}
		else {
			rightFaces.push( tri );
		}
	}

	// Just do it 50:50.
	if( leftFaces.length == 0 || rightFaces.length == 0 ) {
		leftFaces = [];
		rightFaces = [];

		for( var i = 0; i < faces.length; i++ ) {
			if( i < faces.length * 0.5 ) {
				leftFaces.push( faces[i] );
			}
			else {
				rightFaces.push( faces[i] );
			}
		}
	}

	// There has to be somewhere else something wrong.
	if( leftFaces.length == 0 || rightFaces.length == 0 ) {
		UI.printError( "[BVH] Dividing faces 50:50 left one side empty. Faces: " + faces.length );
	}

	return {
		leftFaces: leftFaces,
		rightFaces: rightFaces
	}
};


/**
 *
 * @param {array<BVHNode>} nodes
 * @param {float}          midpoint
 * @param {axis}           axis
 */
BVH.prototype.splitNodes = function( nodes, midpoint, axis ) {
	var leftGroup = [],
	    rightGroup = [];

	for( var i = 0; i < nodes.length; i++ ) {
		var node = nodes[i];
		var cen = ( node.bb.max.toArray()[axis] - node.bb.min.toArray()[axis] ) * 0.5;

		if( cen < midpoint ) {
			leftGroup.push( node );
		}
		else {
			rightGroup.push( node );
		}
	}

	// Just do it 50:50 then.
	if( leftGroup.length == 0 || rightGroup.length == 0 ) {
		leftGroup = [];
		rightGroup = [];

		for( var i = 0; i < nodes.length; i++ ) {
			if( i < nodes.length * 0.5 ) {
				leftGroup.push( nodes[i] );
			}
			else {
				rightGroup.push( nodes[i] );
			}
		}
	}

	// There has to be somewhere else something wrong.
	if( leftGroup.length == 0 || rightGroup.length == 0 ) {
		UI.printError( "[BVH] Dividing nodes 50:50 left one side empty. Nodes: " + nodes.length );
	}

	return {
		left: leftGroup,
		right: rightGroup
	};
};
