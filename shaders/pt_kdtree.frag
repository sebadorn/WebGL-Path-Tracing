// Traversal for the acceleration structure.
// Type: Combination of kD-tree (each object) and BVH (objects in the scene).

#define CALL_TRAVERSE         traverse( bvh, kdNonLeaves, kdLeaves, kdFaces, r, faces );
#define CALL_TRAVERSE_SHADOWS traverse_shadows( bvh, kdNonLeaves, kdLeaves, kdFaces, lightRay, faces );


/**
 * Check all faces of a leaf node for intersections with the given ray.
 */
void checkFaces(
	ray r, int faceIndex, int numFaces,
	uint kdFaces[NUM_KD_FACES], face faces[NUM_FACES],
	float tNear, float tFar
) {
	for( uint i = faceIndex; i < faceIndex + numFaces; i++ ) {
		vec3 tuv;
		uint j = kdFaces[i];

		vec3 normal = checkFaceIntersection( r, faces[j], tuv, tNear, tFar );

		if( tuv.x < INFINITY ) {
			tFar = tuv.x;

			if( r.t > tuv.x ) {
				r.normal = normal;
				r.faceIndex = j;
				r.t = tuv.x;
			}
		}
	}
}


/**
 * Traverse down the kD-tree to find a leaf node the given ray intersects.
 * @param  {int}                     nodeIndex
 * @param  {kdNonLeaf*} kdNonLeaves
 * @param  {vec3}       hitNear
 * @return {int}
 */
int goToLeafNode( uint nodeIndex, kdNonLeaf kdNonLeaves[NUM_KD_NONLEAVES], vec3 hitNear ) {
	bool isOnLeft;

	while( true ) {
		uint axis = kdNonLeaves[nodeIndex].axis;
		ivec2 children = kdNonLeaves[nodeIndex].children;
		bvec2 isLeaf = kdNonLeaves[nodeIndex].isLeaf;
		float split = kdNonLeaves[nodeIndex].split;

		isOnLeft = ( hitNear[axis] <= split );
		nodeIndex = isOnLeft ? children.x : children.y;

		if( ( isOnLeft && isLeaf.x ) || ( !isOnLeft && isLeaf.y ) ) {
			return nodeIndex;
		}
	}

	return -1;
}


/**
* Source: http://www.scratchapixel.com/old/lessons/3d-basic-lessons/lesson-7-intersecting-simple-shapes/ray-box-intersection/
* Which is based on: "An Efficient and Robust Ray–Box Intersection Algorithm", Williams et al.
* @param {ray}         r
* @param {vec3}        bbMin
* @param {vec3}        bbMax
* @param {inout float} tFar
* @param {out int}     exitRope
*/
void updateEntryDistanceAndExitRope(
	ray r, vec3 bbMin, vec3 bbMax, inout float tFar, out int exitRope
) {
	vec3 invDir = 1.0f / r.dir;
	bool signX = ( invDir.x < 0.0f );
	bool signY = ( invDir.y < 0.0f );
	bool signZ = ( invDir.z < 0.0f );

	vec3 t1 = ( bbMin - r.origin ) * invDir;
	vec3 tMax = ( bbMax - r.origin ) * invDir;
	tMax = max( t1, tMax );

	tFar = min( min( tMax.x, tMax.y ), tMax.z );
	exitRope = ( tFar == tMax.y ) ? 3 - signY : 1 - signX;
	exitRope = ( tFar == tMax.z ) ? 5 - signZ : exitRope;
}


/**
 * Find the closest hit of the ray with a surface.
 * Uses stackless kd-tree traversal.
 * @param {ray}         r
 * @param {kdNonLeaf[]} kdNonLeaves
 * @param {kdLeaf[]}    kdLeaves
 * @param {uint[]}      kdFaces
 * @param {face[]}      faces
 * @param {float}       tNear
 * @param {float}       tFar
 * @param {uint}        kdRoot
 */
void traverseKdTree(
	ray r, kdNonLeaf kdNonLeaves[NUM_KD_NONLEAVES],
	kdLeaf kdLeaves[NUM_KD_LEAVES], uint kdFaces[NUM_KD_FACES], face faces[NUM_FACES],
	float tNear, float tFar, uint kdRoot
) {
	int exitRope;
	int nodeIndex = goToLeafNode( kdRoot, kdNonLeaves, r.origin + tNear * r.dir );

	while( nodeIndex >= 0 && tNear < tFar ) {
		kdLeaf currentNode = kdLeaves[nodeIndex];

		checkFaces( r, currentNode.facesIndex, currentNode.numFaces, kdFaces, faces, tNear, tFar );

		// Exit leaf node
		updateEntryDistanceAndExitRope(
			r, currentNode.bbMin, currentNode.bbMax, tNear, exitRope
		);

		if( tNear > tFar ) {
			break;
		}

		if( exitRope < 4 ) {
			nodeIndex = currentNode.ropes1[exitRope];
		}
		else {
			nodeIndex = currentNode.ropes2[6 - exitRope];
		}

		nodeIndex = ( nodeIndex < 1 )
		          ? -( nodeIndex + 1 )
		          : goToLeafNode( nodeIndex - 1, kdNonLeaves, r.origin + tNear * r.dir );
	}
}


/**
 * Traverse the BVH and test the kD-trees against the given ray.
 * @param {bvhNode[]}   bvh
 * @param {kdNonLeaf[]} kdNonLeaves
 * @param {kdLeaf[]}    kdLeaves
 * @param {uint[]}      kdFaces
 * @param {ray}         r
 * @param {face[]}      faces
 */
void traverse(
	bvhNode bvh[NUM_BVH_NODES], kdNonLeaf kdNonLeaves[NUM_KD_NONLEAVES],
	kdLeaf kdLeaves[NUM_KD_LEAVES], uint kdFaces[NUM_KD_FACES],
	ray r, face faces[NUM_FACES]
) {
	uint bvhStack[BVH_STACKSIZE];
	int stackIndex = 0;
	bvhStack[stackIndex] = 0; // Node 0 is always the BVH root node

	float3 invDir = native_recip( r.dir );

	while( stackIndex >= 0 ) {
		bvhNode node = bvh[bvhStack[stackIndex--]];
		float tNearL = 0.0f;
		float tFarL = INFINITY;

		int leftChildIndex = node.leftChild;


		// Is a leaf node and contains a kD-tree
		if( leftChildIndex < 0 ) {
			if(
				intersectBox( r, invDir, node.bbMin, node.bbMax, tNearL, tFarL ) &&
				r.t > tNearL
			) {
				traverseKdTree(
					r, kdNonLeaves, kdLeaves, kdFaces, faces,
					tNearL, tFarL, -( leftChildIndex + 1 )
				);
			}

			continue;
		}


		// Add child nodes to stack, if hit by ray

		bvhNode childNode = bvh[leftChildIndex - 1];

		bool addLeftToStack = (
			intersectBox( r, invDir, childNode.bbMin, childNode.bbMax, tNearL, tFarL ) &&
			r.t > tNearL
		);

		float tNearR = 0.0f;
		float tFarR = INFINITY;
		childNode = bvh[node.rightChild - 1];

		bool addRightToStack = (
			intersectBox( r, invDir, childNode.bbMin, childNode.bbMax, tNearR, tFarR ) &&
			r.t > tNearR
		);


		// The node that is pushed on the stack first will be evaluated last.
		// So the nearer one should be pushed last, because it will be popped first then.
		bool rightThenLeft = ( tNearR > tNearL );

		if( rightThenLeft && addRightToStack ) {
			bvhStack[++stackIndex] = node.rightChild - 1;
		}
		if( rightThenLeft && addLeftToStack ) {
			bvhStack[++stackIndex] = leftChildIndex - 1;
		}

		if( !rightThenLeft && addLeftToStack ) {
			bvhStack[++stackIndex] = leftChildIndex - 1;
		}
		if( !rightThenLeft && addRightToStack ) {
			bvhStack[++stackIndex] = node.rightChild - 1;
		}
	}
}
