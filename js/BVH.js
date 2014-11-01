"use strict";


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
 * @param {array<Object3D>} objects
 * @param {array<float>}    vertices
 * @param {array<float>}    normals
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
 * @param  {array<Tri>} faces
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
		var result = this.buildWithSAH( containerNode, faces, leftFaces, rightFaces );
		var objectSAH = result.SAH;
		var lambda = result.lambda / rootSA;

		// TODO: spatial splits for comparison and improvement
		if( lambda > 0.00001 && CFG.BVH.USE_SPATIAL_SPLITS ) {
			UI.printWarning( "[BVH] Spatial Splits not implemented." );
		}
	}
	// Faster to build: Splitting at the midpoint of the longest axis
	else {
		UI.print( "[BVH] Too many faces in node for SAH. Splitting by midpoint." );
		this.buildWithMidpointSplit( containerNode, faces, leftFaces, rightFaces );
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
BVH.prototype.buildWithMidpointSplit = function( node, faces, leftFaces, rightFaces ) {
	var axis = this.longestAxis( node );
	var splitPos = 0.5 * ( node.bb.min[axis] + node.bb.max[axis] );

	this.splitFaces( faces, splitPos, axis, leftFaces, rightFaces );

	if( leftFaces.length <= 0 || rightFaces.length <= 0 ) {
		UI.printWarning( "[BVH] Splitting faces by midpoint didn't work. Trying again with mean." );

		leftFaces = [];
		rightFaces = [];
		splitPos = this.getMean( faces, axis );

		this.splitFaces( faces, splitPos, axis, leftFaces, rightFaces );
	}
};


/**
 *
 * @param  {BVHNode}    node
 * @param  {array<Tri>} faces
 * @param  {array<Tri>} leftFaces  Output.
 * @param  {array<Tri>} rightFaces Output.
 * @return {Object}
 */
BVH.prototype.buildWithSAH = function( node, faces, leftFaces, rightFaces ) {
	var lambda = Infinity;
	var nodeSA = MathHelp.getSurfaceArea( node.bb );
	var bestSAH = nodeSA * faces.length; // TODO
	bestSAH = Infinity;

	for( var axis = 0; axis <= 2; axis++ ) {
		var result = this.splitBySAH( 1.0 / nodeSA, bestSAH, axis, faces, leftFaces, rightFaces, lambda );
		bestSAH = result.bestSAH;
		lambda = result.lambda;
	}

	return {
		SAH: bestSAH,
		lambda: lambda
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
		leftBin[i].max[axis] = splitPos[i];

		rightBin.push( new THREE.Box3() );
		rightBin[i].min = node.bb.min.clone();
		rightBin[i].max = node.bb.max.clone();
		rightBin[i].min[axis] = splitPos[i];
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
	var lenSegment = ( node.bb.max[axis] - node.bb.min[axis] ) / ( splits + 1.0 );

	pos.push( node.bb.min[axis] + lenSegment );

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
		var center = faces[i].bb.min.clone();
		center.add( faces[i].bb.max );
		center.multiplyScalar( 0.5 );
		sum += center[axis];
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
		var center = nodes[i].bb.max.clone();
		center.sub( nodes[i].bb.min );
		center.multiplyScalar( 0.5 );
		sum += center[axis];
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

	var axis = this.longestAxis( parent );
	var midpoint = 0.5 * ( parent.bb.min[axis] + parent.bb.max[axis] );

	var leftGroup = [],
	    rightGroup = [];

	this.splitNodes( nodes, midpoint, axis, leftGroup, rightGroup );

	if( leftGroup.length <= 0 || rightGroup.length <= 0 ) {
		var mean = this.getMeanOfNodes( nodes, axis );
		this.splitNodes( nodes, mean, axis, leftGroup, rightGroup );
	}

	var leftNode = this.makeContainerNode( leftGroup, false );
	parent.leftChild = leftNode;
	this.groupTreesToNodes( leftGroup, parent.leftChild, depth + 1 );

	var rightNode = this.makeContainerNode( rightGroup, false );
	parent.rightChild = rightNode;
	this.groupTreesToNodes( rightGroup, parent.rightChild, depth + 1 );
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
 * @param  {array<Tri>} leftFaces
 * @param  {array<Tri>} rightFaces
 * @param  {float}      lambda
 * @return {Object}
 */
BVH.prototype.splitBySAH = function( nodeSA, bestSAH, axis, faces, leftFaces, rightFaces, lambda ) {
	faces.sort( function( a, b ) {
		var cenA = ( a.bb.max[axis] + a.bb.min[axis] ) * 0.5;
		var cenB = ( b.bb.max[axis] + b.bb.min[axis] ) * 0.5;

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
		lambda: lambda
	};
};


/**
 *
 * @param {array<Tri>} faces
 * @param {float}      midpoint
 * @param {int}        axis
 * @param {array<Tri>} leftFaces
 * @param {array<Tri>} rightFaces
 */
BVH.prototype.splitFaces = function( faces, midpoint, axis, leftFaces, rightFaces ) {
	for( var i = 0; i < faces.length; i++ ) {
		var tri = faces[i];
		var cen = tri.getCenter();

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
};


/**
 *
 * @param {array<BVHNode>} nodes
 * @param {float}          midpoint
 * @param {axis}           axis
 * @param {array<BVHNode>} leftGroup
 * @param {array<BVHNode>} rightGroup
 */
BVH.prototype.splitNodes = function( nodes, midpoint, axis, leftGroup, rightGroup ) {
	for( var i = 0; i < nodes.length; i++ ) {
		var node = nodes[i];
		var cen = 0.5 * ( node.bb.max[axis] - node.bb.min[axis] );

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
};
