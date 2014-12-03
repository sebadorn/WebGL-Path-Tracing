face faces[NUM_FACES];
material materials[NUM_MATERIALS];

void initArrayFaces() {
	%DATA_FACES%
}

void initArrayMaterials() {
	%DATA_MATERIALS%
}


#if ACCEL_STRUCT == 0

	bvhNode bvh[NUM_BVH_NODES];
	int bvhFaces[NUM_BVH_FACES];

	void initArrayBVHNodes() {
		%DATA_BVH_NODES%
	}

	void initArrayBVHFaces() {
		%DATA_BVH_FACES%
	}

	void initArraysAccStruct() {
		initArrayBVHFaces();
		initArrayBVHNodes();
	}

#elif ACCEL_STRUCT == 1

	// TODO:
	bvhNode bvh[NUM_BVH_NODES];
	kdNonLeaf kdNonLeaves[NUM_KD_NONLEAVES];
	kdLeaf kdLeaves[NUM_KD_LEAVES];
	int kdFaces[NUM_FACES];

#endif