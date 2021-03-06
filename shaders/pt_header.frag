#if GL_FRAGMENT_PRECISION_HIGH == 1
	precision highp float;
#else
	precision mediump float;
#endif

#define ACCEL_STRUCT %ACCEL_STRUCT%
#define ANTI_ALIASING %ANTI_ALIASING%
#define BRDF %BRDF%
#define BVH_STACKSIZE %BVH_STACKSIZE%
#define EPSILON 0.00001
#define IMPLICIT %IMPLICIT%
#define M_1_PI 0.31830988618
#define M_PI 3.14159265359
#define M_PI_2 1.57079632679
#define M_PI_X2 6.28318530718
#define MAX_ADDED_DEPTH %MAX_ADDED_DEPTH%
#define MAX_DEPTH %MAX_DEPTH%
#define NI_AIR 1.00028
#define NUM_BVH_FACES %NUM_BVH_FACES%
#define NUM_BVH_NODES %NUM_BVH_NODES%
#define NUM_FACES %NUM_FACES%
// #define NUM_KD_FACES %NUM_KD_FACES%
// #define NUM_KD_LEAVES %NUM_KD_LEAVES%
// #define NUM_KD_NONLEAVES %NUM_KD_NONLEAVES%
#define NUM_MATERIALS %NUM_MATERIALS%
#define PHONG_TESS %PHONG_TESS%
#define PHONG_TESS_ALPHA %PHONG_TESS_ALPHA%
#define SAMPLES %SAMPLES%
#define SKY_LIGHT %SKY_LIGHT%
#define THIRD 0.3333333333
#define THIRD_HALF 0.1666666666


const float INFINITY = 1.0 / 0.0;

struct ray {
	vec3 origin;
	vec3 dir;
	vec3 normal;
	float t;
	int faceIndex;
};

struct rayPlanes {
	vec3 n1; // Normal of plane 1
	vec3 n2; // Normal of plane 2
	float o1; // Distance of plane 1 to the origin
	float o2; // Distance of plane 2 to the origin
};

struct face {
	// vertices
	vec3 a;
	vec3 b;
	vec3 c;
	// vertex normals
	vec3 an;
	vec3 bn;
	vec3 cn;
	int material;
};

// BVH
#if ACCEL_STRUCT == 0

	struct bvhNode {
		vec3 bbMin;
		vec3 bbMax;
		ivec2 facesInterval; // x = start index; y = number of faces
		int leftChild;
		int rightChild;
	};

// kd-tree
#elif ACCEL_STRUCT == 1

	struct bvhNode {
		vec3 bbMin;
		vec3 bbMax;
		int leftChild;
		int rightChild;
	};

	struct kdNonLeaf {
		ivec2 children; // [left, right]
		bvec2 isLeaf; // [isLeftLeaf, isRightLeaf]
		float split;
		int axis;
	};

	struct kdLeaf {
		vec4 bbMin;
		vec4 bbMax;
		ivec4 ropes1; // [left, right, bottom, top]
		ivec2 ropes2; // [back, front]
		int facesIndex;
		int numFaces;
	};

#endif


// Schlick
#if BRDF == 0

	struct material {
		float d;
		float Ni;
		float p;
		float rough;
		vec3 colorDiff;
		vec3 colorSpec;
		bool isLight;
	};

// Shirly-Ashikhmin
#elif BRDF == 1

	struct material {
		float nu;
		float nv;
		float Rs;
		float Rd;
		float d;
		float Ni;
		vec3 colorDiff;
		vec3 colorSpec;
		bool isLight;
	};

#endif


// Uniform values passed to shader
uniform vec3 uCamEye;
uniform vec3 uCamU;
uniform vec3 uCamV;
uniform vec3 uCamW;
uniform float uGlobalTime;
uniform float uPixelDimension;
uniform float uPixelWeight;
uniform vec2 uResolution;
uniform vec3 uSunPos;
