#FILE:pt_header.frag:FILE#
#FILE:pt_utils.frag:FILE#
#FILE:pt_spectral_precalc.frag:FILE#
#FILE:pt_brdf.frag:FILE#
#FILE:pt_phongtess.frag:FILE#
#FILE:pt_intersect.frag:FILE#

#if ACCEL_STRUCT == 0
	#FILE:pt_bvh.frag:FILE#
#elif ACCEL_STRUCT == 1
	#FILE:pt_kdtree.frag:FILE#
#endif



/**
 * Generate the initial ray into the scene.
 * @param  {float}     pxDim
 * @param  {float[12]} eyeIn Camera eye position.
 * @return {ray}
 */
ray initRay( float pxDim, float eyeIn[12] ) {
	vec2 pos = vec2( get_global_id( 0 ), get_global_id( 1 ) ); // TODO

	vec3 eye = vec3( eyeIn[0], eyeIn[1], eyeIn[2] );
	vec3 w = vec3( eyeIn[3], eyeIn[4], eyeIn[5] );
	vec3 u = vec3( eyeIn[6], eyeIn[7], eyeIn[8] );
	vec3 v = vec3( eyeIn[9], eyeIn[10], eyeIn[11] );

	vec3 initialRay = w + pxDim * 0.5f *
			          ( u - IMG_WIDTH * u + 2.0f * pos.x * u +
			            v - IMG_HEIGHT * v + 2.0f * pos.y * v );

	ray r;
	r.t = INFINITY;
	r.origin = eye;
	r.dir = normalize( initialRay );

	float rnd = rand();
	vec3 aaDir = jitter( r.dir, PI_X2 * rand(), sqrt( rnd ), sqrt( 1.0f - rnd ) );
	r.dir = normalize( r.dir +	aaDir * pxDim * ANTI_ALIASING );

	return r;
}


/**
 * Write the final color to the output image.
 * @param {vec2}           pos         Pixel coordinate in the image to read from/write to.
 * @param {read_only image2d_t}  imageIn     The previously generated image.
 * @param {write_only image2d_t} imageOut    Output.
 * @param {float}          pixelWeight Mixing weight of the new color with the old one.
 * @param {float[40]}            spdLight    Spectral power distribution reaching this pixel.
 * @param {float}                focus       Value <t> of the ray.
 */
void setColors(
	read_only image2d_t imageIn, write_only image2d_t imageOut,
	float pixelWeight, float spdLight[40], float focus
) {
	vec2 pos = { get_global_id( 0 ), get_global_id( 1 ) };
	sampler_t sampler = CLK_NORMALIZED_COORDS_FALSE | CLK_ADDRESS_CLAMP_TO_EDGE | CLK_FILTER_NEAREST;
	float4 imagePixel = read_imagef( imageIn, sampler, pos );
	float4 accumulatedColor = spectrumToRGB( spdLight );

	float4 color = mix(
		clamp( accumulatedColor, 0.0f, 1.0f ),
		imagePixel, pixelWeight
	);
	color.w = focus;

	write_imagef( imageOut, pos, color );
}


/**
 * Update the spectral power distribution according to the hit material and BRDF.
 * @param {ray4*}           ray
 * @param {ray4*}           newRay
 * @param {material*}       mtl
 * @param {ray4*}           lightRay
 * @param {int}             lightRaySource
 * @param {uint*}                 secondaryPaths
 * @param {constant float*} specPowerDists
 * @param {float*}                spd
 * @param {float*}                spdTotal
 * @param {float*}                maxValSpd
 */
void updateSPD(
	ray4* ray, ray4* newRay, material* mtl,
	ray4* lightRay, int lightRaySource, uint* secondaryPaths,
	constant float* specPowerDists, float* spd, float* spdTotal, float* maxValSpd
) {
	#define COLOR_DIFF ( specPowerDists[index0 + i] )
	#define COLOR_SPEC ( specPowerDists[index1 + i] )

	uint index0 = mtl.spd.x * SPEC;
	uint index1 = mtl.spd.y * SPEC;


	// BRDF: Schlick
	#if BRDF == 0

		float brdf, pdf, u;

		#if IMPLICIT == 1

			if( lightRaySource >= 0 ) {
				brdf = brdfSchlick( mtl, ray, lightRay, &( ray.normal ), &u, &pdf );

				if( fabs( pdf ) > 0.00001f ) {
					brdf *= lambert( ray.normal, lightRay.dir );
					brdf = native_divide( brdf, pdf );

					for( int i = 0; i < SPEC; i++ ) {
						spdTotal[i] += spd[i] * specPowerDists[lightRaySource + i] *
						               COLOR_DIFF * ( fresnel( u, COLOR_SPEC ) * brdf *
						               mtl.d + ( 1.0f - mtl.d ) );
					}

					*secondaryPaths += 1;
				}
			}

		#endif

		brdf = brdfSchlick( mtl, ray, newRay, &( ray.normal ), &u, &pdf );
		brdf *= lambert( ray.normal, newRay.dir );
		brdf = native_divide( brdf, pdf );

		for( int i = 0; i < SPEC; i++ ) {
			spd[i] *= COLOR_DIFF * ( fresnel( u, COLOR_SPEC ) * brdf * mtl.d + ( 1.0f - mtl.d ) );
			*maxValSpd = fmax( spd[i], *maxValSpd );
		}

	// BRDF: Shirley/Ashikhmin
	#elif BRDF == 1

		float brdf_d, brdf_s, brdfDiff, brdfSpec, pdf;
		float dotHK1;

		#if IMPLICIT == 1

			if( lightRaySource >= 0 ) {
				brdfShirleyAshikhmin(
					mtl.nu, mtl.nv, mtl.Rs, mtl.Rd,
					ray, lightRay, &( ray.normal ), &brdfSpec, &brdfDiff, &dotHK1, &pdf
				);

				if( fabs( pdf ) > 0.00001f ) {
					brdfSpec = native_divide( brdfSpec, pdf );
					brdfDiff = native_divide( brdfDiff, pdf );

					for( int i = 0; i < SPEC; i++ ) {
						brdf_s = brdfSpec * fresnel( dotHK1, mtl.Rs * COLOR_SPEC );
						brdf_d = brdfDiff * COLOR_DIFF * ( 1.0f - mtl.Rs * COLOR_SPEC );

						spdTotal[i] += spd[i] * specPowerDists[lightRaySource + i] *
						               ( brdf_s + brdf_d ) *
						               mtl.d + ( 1.0f - mtl.d );
					}

					*secondaryPaths += 1;
				}
			}

		#endif

		brdfShirleyAshikhmin(
			mtl.nu, mtl.nv, mtl.Rs, mtl.Rd,
			ray, newRay, &( ray.normal ), &brdfSpec, &brdfDiff, &dotHK1, &pdf
		);

		brdfSpec = native_divide( brdfSpec, pdf );
		brdfDiff = native_divide( brdfDiff, pdf );

		for( int i = 0; i < SPEC; i++ ) {
			brdf_s = brdfSpec * fresnel( dotHK1, mtl.Rs * COLOR_SPEC );
			brdf_d = brdfDiff * COLOR_DIFF * ( 1.0f - mtl.Rs * COLOR_SPEC );

			spd[i] *= ( brdf_s + brdf_d ) * mtl.d + ( 1.0f - mtl.d );
			*maxValSpd = fmax( spd[i], *maxValSpd );
		}

	#endif

	#undef COLOR_DIFF
	#undef COLOR_SPEC
}



// KERNELS


/**
 * KERNEL.
 * Do the path tracing and calculate the final color for the pixel.
 * @param {uvec2}            offset
 * @param {float}                  seed
 * @param {float}                  pixelWeight
 * @param {global face_t*}   faces
 * @param {global bvhNode*}  bvh
 * @param {global rayBase*}  initRays
 * @param {global material*} materials
 * @param {global float*}    specPowerDists
 * @param {read_only image2d_t}    imageIn
 * @param {write_only image2d_t}   imageOut
 */
kernel void pathTracing(
	// changing values
	float seed,
	float pixelWeight,
	float4 sunPos,

	// view
	float pxDim,
	global float* eyeIn,

	// acceleration structure
	#if ACCEL_STRUCT == 0

		global bvhNode* bvh,
		global uint* bvhFaces,

	#elif ACCEL_STRUCT == 1

		global bvhNode* bvh,
		global kdNonLeaf* kdNonLeaves,
		global kdLeaf* kdLeaves,
		global uint* kdFaces,

	#endif

	// geometry and color related
	global face_t* faces,
	global material* materials,
	constant float* specPowerDists,

	// old and new frame
	read_only image2d_t imageIn,
	write_only image2d_t imageOut
) {
	float spd[SPEC], spdTotal[SPEC];
	setArray( spdTotal, 0.0f );

	float focus;
	bool addDepth;
	uint secondaryPaths = 1; // Start at 1 instead of 0, because we are going to divide through it.

	for( uint sample = 0; sample < SAMPLES; sample++ ) {
		setArray( spd, 1.0f );
		int light = -1;
		ray4 ray = initRay( pxDim, eyeIn, &seed );
		float maxValSpd = 0.0f;
		int depthAdded = 0;

		for( uint depth = 0; depth < MAX_DEPTH + depthAdded; depth++ ) {
			CALL_TRAVERSE

			if( ray.t == INFINITY ) {
				light = SKY_LIGHT * SPEC;
				break;
			}

			focus = ( depth == 0 ) ? ray.t : focus;

			material mtl = materials[(uint) faces[(uint) ray.normal.w].a.w];
			ray.normal.w = 0.0f;

			// Implicit connection to a light found
			if( mtl.light == 1 ) {
				light = mtl.spd.x * SPEC;
				break;
			}

			// Last round, no need to calculate a new ray.
			// Unless we hit a material that extends the path.
			addDepth = extendDepth( &mtl, &seed );

			if( mtl.d == 1.0f && !addDepth && depth == MAX_DEPTH + depthAdded - 1 ) {
				break;
			}

			seed += ray.t;

			int lightRaySource = -1;
			ray4 lightRay;
			lightRay.t = INFINITY;

			#if IMPLICIT == 1

				if( mtl.d > 0.0f ) {
					lightRay.origin = fma( ray.t, ray.dir, ray.origin ) + ray.normal * EPSILON5;
					float rnd2 = rand( &seed );
					lightRay.dir = normalize( sunPos - lightRay.origin );

					CALL_TRAVERSE_SHADOW

					if( lightRay.t == INFINITY ) {
						lightRaySource = SKY_LIGHT * SPEC;
					}
					else {
						material lightMTL = materials[(uint) faces[(uint) lightRay.normal.w].a.w];
						lightRaySource = ( lightMTL.light == 1 ) ? lightMTL.spd.x : -1;
					}

					lightRay.normal.w = 0.0f;
				}

			#endif

			// New direction of the ray (bouncing of the hit surface)
			ray4 newRay = getNewRay( &ray, &mtl, &seed, &addDepth );

			updateSPD(
				&ray, &newRay, &mtl, &lightRay, lightRaySource, &secondaryPaths,
				specPowerDists, spd, spdTotal, &maxValSpd
			);

			// Extend max path depth
			depthAdded += ( addDepth && depthAdded < MAX_ADDED_DEPTH );

			// Russian roulette termination
			if( depth > 2 + depthAdded && maxValSpd < rand( &seed ) ) {
				break;
			}

			ray = newRay;
		} // end bounces

		if( light >= 0 ) {
			for( int i = 0; i < SPEC; i++ ) {
				spdTotal[i] += spd[i] * specPowerDists[light + i];
			}
		}
	} // end samples

	for( int i = 0; i < SPEC; i++ ) {
		spdTotal[i] = native_divide( spdTotal[i], (float) secondaryPaths );
	}

	#if SAMPLES > 1

		for( int i = 0; i < SPEC; i++ ) {
			spdTotal[i] = native_divide( spdTotal[i], (float) SAMPLES );
		}

	#endif

	setColors( imageIn, imageOut, pixelWeight, spdTotal, focus );
}
