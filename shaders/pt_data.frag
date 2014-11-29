int MOD_3[6];

void initMod3() {
	MOD_3[0] = 0;
	MOD_3[1] = 1;
	MOD_3[2] = 2;
	MOD_3[3] = 0;
	MOD_3[4] = 1;
	MOD_3[5] = 2;
}


#if ACCEL_STRUCT == 0

	// TODO: init like MOD_3, because WebGL uses GLSL #version 100 and everything is a nightmare.
	// Why is everything so horrible? Give me back OpenCL or GLSL 130. But I think WebGL GLSL will soon-ish
	// be raised to 120, so there's that. Hope for the future. Until then everything is horrible.
	bvhNode bvh[NUM_BVH_NODES] = bvhNode[NUM_BVH_NODES](
		%DATA_BVH_NODES%
	);

	// TODO: init like MOD_3
	int bvhFaces[NUM_BVH_FACES] = int[NUM_BVH_FACES](
		%DATA_BVH_FACES%
	);

#elif ACCEL_STRUCT == 1

	// TODO:
	bvhNode bvh[NUM_BVH_NODES];
	kdNonLeaf kdNonLeaves[NUM_KD_NONLEAVES];
	kdLeaf kdLeaves[NUM_KD_LEAVES];
	int kdFaces[NUM_FACES];

#endif