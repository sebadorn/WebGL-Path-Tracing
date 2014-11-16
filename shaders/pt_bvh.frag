// Traversal for the acceleration structure.
// Type: Bounding Volume Hierarchy (BVH)

#define CALL_TRAVERSE         traverse( bvh, bvhFaces, r, faces );
#define CALL_TRAVERSE_SHADOWS traverse_shadows( bvh, bvhFaces, lightRay, faces );


/**
 * Test faces of the given node for intersections with the given ray.
 * @param {inout ray} r
 * @param {bvhNode}   node
 * @param {face}      faces
 * @param {float}     tNear
 * @param {float}     tFar
 */
void intersectFaces(
	inout ray r, bvhNode node, uint bvhFaces[NUM_BVH_FACES], face faces[NUM_FACES],
	float tNear, float tFar
) {
	for( char i = 0; i < node.facesInterval.y; i++ ) {
		vec3 tuv;
		vec3 normal = checkFaceIntersection(
			r, faces[bvhFaces[node.facesInterval.x + i]], tuv, tNear, tFar
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
 * @param {bvhNode[]} bvh
 * @param {uint[]}    bvhFaces
 * @param {ray}       r
 * @param {face[]}    faces
 */
void traverse(
	bvhNode bvh[NUM_BVH_NODES], uint bvhFaces[NUM_BVH_FACES], inout ray r, face faces[NUM_FACES]
) {
	uint bvhStack[BVH_STACKSIZE];
	int stackIndex = 0;
	bvhStack[stackIndex] = 0; // Node 0 is always the BVH root node

	vec3 invDir = 1.0f / r.dir;

	while( stackIndex >= 0 ) {
		bvhNode node = bvh[bvhStack[stackIndex--]];
		float tNearL = 0.0f;
		float tFarL = INFINITY;

		// Is a leaf node
		if( node.leftChild < 0 ) {
			if(
				intersectBox( r, invDir, node.bbMin, node.bbMax, tNearL, tFarL ) &&
				r.t > tNearL
			) {
				intersectFaces( r, node, bvhFaces, faces, tNearL, tFarL );
			}

			continue;
		}


		// Add child nodes to stack, if hit by ray

		bvhNode childNode = bvh[node.leftChild];

		bool addLeftToStack = (
			intersectBox( r, invDir, childNode.bbMin, childNode.bbMax, tNearL, tFarL ) &&
			r.t > tNearL
		);

		float tNearR = 0.0f;
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
void traverse_shadows(
	bvhNode bvh[NUM_BVH_NODES], uint bvhFaces[NUM_BVH_FACES], ray r, face faces[NUM_FACES]
) {
	bool addLeftToStack, addRightToStack, rightThenLeft;
	float tFarL, tFarR, tNearL, tNearR;

	uint bvhStack[BVH_STACKSIZE];
	int stackIndex = 0;
	bvhStack[stackIndex] = 0; // Node 0 is always the BVH root node

	vec3 invDir = 1.0f / r.dir;

	while( stackIndex >= 0 ) {
		bvhNode node = bvh[bvhStack[stackIndex--]];
		tNearL = 0.0f;
		tFarL = INFINITY;

		// Is a leaf node with faces
		if( node.leftChild < 0 && node.rightChild < 0 ) {
			if( intersectBox( r, invDir, node.bbMin, node.bbMax, tNearL, tFarL ) ) {
				intersectFaces( r, node, bvhFaces, faces, tNearL, tFarL );

				if( r.t < INFINITY ) {
					break;
				}
			}

			continue;
		}

		// Add child nodes to stack, if hit by ray

		bvhNode childNode = bvh[node.leftChild];

		bool addLeftToStack = intersectBox( r, invDir, childNode.bbMin, childNode.bbMax, tNearL, tFarL );

		float tNearR = 0.0f;
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
