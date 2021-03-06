// Traversal for the acceleration structure.
// Type: Bounding Volume Hierarchy (BVH)

#define CALL_TRAVERSE         traverse( r, faces );
#define CALL_TRAVERSE_SHADOWS traverse_shadows( lightRay, faces );


/**
 * Test faces of the given node for intersections with the given ray.
 * @param {inout ray} r
 * @param {bvhNode}   node
 * @param {face}      faces
 * @param {float}     tNear
 * @param {float}     tFar
 */
void intersectFaces(
	inout ray r, bvhNode node, face faces[NUM_FACES], float tNear, float tFar
) {
	for( int i = 0; i < NUM_FACES; i++ ) {
		if( i >= node.facesInterval.y ) {
			break;
		}

		int index = node.facesInterval.x + i;
		int index2 = bvhFaces[index];
		vec3 tuv;
		vec3 normal = checkFaceIntersection(
			r, faces[index2], tuv, tNear, tFar
		);

		if( tuv.x < INFINITY ) {
			tFar = tuv.x;

			if( r.t > tuv.x ) {
				r.normal = normal;
				r.faceIndex = bvhFaces[node.facesInterval.x + i];
				r.t = tuv.x;
			}
		}
	}
}


/**
 * Traverse the BVH and test the faces against the given ray.
 * @param {inout ray} r
 * @param {face[]}    faces
 */
void traverse( inout ray r, face faces[NUM_FACES] ) {
	int bvhStack[BVH_STACKSIZE];
	int stackIndex = 0;
	bvhStack[0] = 0; // Node 0 is always the BVH root node

	vec3 invDir = 1.0 / r.dir;

	for( int i = 0; i < NUM_BVH_NODES; i++ ) { // Fuck GLSL 1.0 for not having while or endless loops.
		if( stackIndex < 0 ) {
			break;
		}

		bvhNode node = bvh[bvhStack[stackIndex--]];
		float tNearL = 0.0;
		float tFarL = INFINITY;

		// Is a leaf node
		if( node.leftChild < 0 ) {
			if(
				intersectBox( r, invDir, node.bbMin, node.bbMax, tNearL, tFarL ) &&
				r.t > tNearL
			) {
				intersectFaces( r, node, faces, tNearL, tFarL );
			}

			continue;
		}


		// Add child nodes to stack, if hit by ray

		bvhNode childNode = bvh[node.leftChild];

		bool addLeftToStack = (
			intersectBox( r, invDir, childNode.bbMin, childNode.bbMax, tNearL, tFarL ) &&
			r.t > tNearL
		);

		float tNearR = 0.0;
		float tFarR = INFINITY;
		childNode = bvh[node.rightChild];

		bool addRightToStack = (
			intersectBox( r, invDir, childNode.bbMin, childNode.bbMax, tNearR, tFarR ) &&
			r.t > tNearR
		);


		// The node that is pushed on the stack first will be evaluated last.
		// So the nearer one should be pushed last, because it will be popped first then.
		bool rightThenLeft = ( tNearR > tNearL );

		if( rightThenLeft && addRightToStack ) {
			bvhStack[++stackIndex] = node.rightChild;
		}
		if( rightThenLeft && addLeftToStack ) {
			bvhStack[++stackIndex] = node.leftChild;
		}

		if( !rightThenLeft && addLeftToStack ) {
			bvhStack[++stackIndex] = node.leftChild;
		}
		if( !rightThenLeft && addRightToStack ) {
			bvhStack[++stackIndex] = node.rightChild;
		}
	}
}


/**
 * Traverse the BVH and test the faces against the given ray.
 * This version is for the shadow ray test, so it only checks IF there
 * is an intersection and terminates on the first hit.
 * @param {bvhNode[]} bvh
 * @param {ray}       r
 * @param {face[]}    faces
 */
void traverse_shadows( ray r, face faces[NUM_FACES] ) {
	bool addLeftToStack, addRightToStack, rightThenLeft;
	float tFarL, tFarR, tNearL, tNearR;

	int bvhStack[BVH_STACKSIZE];
	int stackIndex = 0;
	bvhStack[0] = 0; // Node 0 is always the BVH root node

	vec3 invDir = 1.0 / r.dir;

	for( int i = 0; i < NUM_BVH_NODES; i++ ) { // Fuck GLSL 1.0 for not having while or endless loops.
		if( stackIndex < 0 ) {
			break;
		}
		bvhNode node = bvh[bvhStack[stackIndex--]];
		tNearL = 0.0;
		tFarL = INFINITY;

		// Is a leaf node with faces
		if( node.leftChild < 0 && node.rightChild < 0 ) {
			if( intersectBox( r, invDir, node.bbMin, node.bbMax, tNearL, tFarL ) ) {
				intersectFaces( r, node, faces, tNearL, tFarL );

				if( r.t < INFINITY ) {
					break;
				}
			}

			continue;
		}

		// Add child nodes to stack, if hit by ray

		bvhNode childNode = bvh[node.leftChild];

		bool addLeftToStack = intersectBox( r, invDir, childNode.bbMin, childNode.bbMax, tNearL, tFarL );

		float tNearR = 0.0;
		float tFarR = INFINITY;
		childNode = bvh[node.rightChild];

		bool addRightToStack = intersectBox( r, invDir, childNode.bbMin, childNode.bbMax, tNearR, tFarR );


		// The node that is pushed on the stack first will be evaluated last.
		// So the nearer one should be pushed last, because it will be popped first then.
		rightThenLeft = ( tNearR > tNearL );

		if( rightThenLeft && addRightToStack) {
			bvhStack[++stackIndex] = node.rightChild;
		}
		if( rightThenLeft && addLeftToStack) {
			bvhStack[++stackIndex] = node.leftChild;
		}

		if( !rightThenLeft && addLeftToStack) {
			bvhStack[++stackIndex] = node.leftChild;
		}
		if( !rightThenLeft && addRightToStack) {
			bvhStack[++stackIndex] = node.rightChild;
		}
	}
}
