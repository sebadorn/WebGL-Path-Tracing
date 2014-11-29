#FILE:pt_header.frag:FILE#
#FILE:pt_data.frag:FILE#
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
	vec2 pos = vec2( get_global_id( 0 ), get_global_id( 1 ) ); // TODO:

	vec3 eye = vec3( eyeIn[0], eyeIn[1], eyeIn[2] );
	vec3 w = vec3( eyeIn[3], eyeIn[4], eyeIn[5] );
	vec3 u = vec3( eyeIn[6], eyeIn[7], eyeIn[8] );
	vec3 v = vec3( eyeIn[9], eyeIn[10], eyeIn[11] );

	vec3 initialRay = w + pxDim * 0.5 *
			          ( u - IMG_WIDTH * u + 2.0 * pos.x * u +
			            v - IMG_HEIGHT * v + 2.0 * pos.y * v );

	ray r;
	r.t = INFINITY;
	r.origin = eye;
	r.dir = normalize( initialRay );

	float rnd = rand();
	vec3 aaDir = jitter( r.dir, PI_X2 * rand(), sqrt( rnd ), sqrt( 1.0 - rnd ) );
	r.dir = normalize( r.dir +	aaDir * pxDim * ANTI_ALIASING );

	return r;
}


/**
 * Write the final color to the output image.
 * @param {vec2}                 pos         Pixel coordinate in the image to read from/write to.
 * @param {read_only image2d_t}  imageIn     The previously generated image.
 * @param {write_only image2d_t} imageOut    Output.
 * @param {float}                pixelWeight Mixing weight of the new color with the old one.
 * @param {float[40]}            spdLight    Spectral power distribution reaching this pixel.
 * @param {float}                focus       Value <t> of the ray.
 */
// void setColors(
// 	read_only image2d_t imageIn, write_only image2d_t imageOut,
// 	float pixelWeight, float spdLight[40], float focus
// ) {
// 	vec2 pos = { get_global_id( 0 ), get_global_id( 1 ) };
// 	sampler_t sampler = CLK_NORMALIZED_COORDS_FALSE | CLK_ADDRESS_CLAMP_TO_EDGE | CLK_FILTER_NEAREST;
// 	float4 imagePixel = read_imagef( imageIn, sampler, pos );
// 	float4 accumulatedColor = spectrumToRGB( spdLight );

// 	float4 color = mix(
// 		clamp( accumulatedColor, 0.0, 1.0 ),
// 		imagePixel, pixelWeight
// 	);
// 	color.w = focus;

// 	write_imagef( imageOut, pos, color );
// }


/**
 * Update the spectral power distribution according to the hit material and BRDF.
 * @param {ray4*}           ray
 * @param {ray4*}           newRay
 * @param {material*}       mtl
 * @param {ray4*}           lightRay
 * @param {int}             lightRaySource
 * @param {uint*}           secondaryPaths
 * @param {constant float*} specPowerDists
 * @param {float*}          spd
 * @param {float*}          spdTotal
 */
void updateColor(
	ray r, ray newRay, material mtl,
	ray lightRay, material lightMtl, uint secondaryPaths,
	inout vec3 color, inout vec3 colorTotal
) {
	// BRDF: Schlick
	#if BRDF == 0

		float brdf, pdf, u;

		#if IMPLICIT == 1

			if( lightMtl.x >= 0.0 ) {
				brdf = brdfSchlick( mtl, r, lightRay, r.normal, u, pdf );

				if( abs( pdf ) > 0.00001 ) {
					brdf *= lambert( r.normal, lightRay.dir );
					brdf = brdf / pdf;
					colorTotal += color * lightMtl.colorDiff * mtl.colorDiff * ( fresnel( u, mtl.colorSpec )
					              * brdf * mtl.d + ( 1.0 - mtl.d ) );

					*secondaryPaths += 1;
				}
			}

		#endif

		brdf = brdfSchlick( mtl, r, newRay, r.normal, u, pdf );
		brdf *= lambert( r.normal, newRay.dir );
		brdf = brdf / pdf;

		color *= mtl.colorDiff * ( fresnel( u, mtl.colorSpec ) * brdf * mtl.d + ( 1.0 - mtl.d ) );

	// BRDF: Shirley/Ashikhmin
	#elif BRDF == 1

		float brdfDiff, brdfSpec, pdf;
		float dotHK1;
		vec3 brdf_d, brdf_s;

		#if IMPLICIT == 1

			if( lightMtl.x >= 0.0 ) {
				brdfShirleyAshikhmin(
					mtl.nu, mtl.nv, mtl.Rs, mtl.Rd,
					r, lightRay, r.normal, brdfSpec, brdfDiff, dotHK1, pdf
				);

				if( abs( pdf ) > 0.00001 ) {
					brdf_s = brdfSpec / pdf * fresnel( dotHK1, mtl.Rs * mtl.colorSpec );
					brdf_d = brdfDiff / pdf * mtl.colorDiff * ( 1.0 - mtl.Rs * mtl.colorSpec );
					colorTotal += color * lightMtl.colorDiff * ( brdf_s + brdf_d ) * mtl.d + ( 1.0 - mtl.d );

					*secondaryPaths += 1;
				}
			}

		#endif

		brdfShirleyAshikhmin(
			mtl.nu, mtl.nv, mtl.Rs, mtl.Rd,
			r, newRay, r.normal, brdfSpec, brdfDiff, dotHK1, pdf
		);

		brdf_s = brdfSpec / pdf * fresnel( dotHK1, mtl.Rs * mtl.colorSpec );
		brdf_d = brdfDiff / pdf * mtl.colorDiff * ( 1.0 - mtl.Rs * mtl.colorSpec );
		color *= ( brdf_s + brdf_d ) * mtl.d + ( 1.0 - mtl.d );

	#endif
}


/**
 * Do the path tracing and calculate the final color for the pixel.
 * @param {uvec2}            offset
 * @param {float}                  seed
 * @param {float}                  pixelWeight
 * @param {face_t*}   faces
 * @param {bvhNode*}  bvh
 * @param {rayBase*}  initRays
 * @param {material*} materials
 * @param {float*}    specPowerDists
 * @param {read_only image2d_t}    imageIn
 * @param {write_only image2d_t}   imageOut
 */
void main(
	// changing values
	float initialSeed,
	float pixelWeight,
	vec3 sunPos,

	// view
	float pxDim,
	float eyeIn[12],

	// geometry and material related
	face faces[NUM_FACES],
	material materials[NUM_MATERIALS]
) {
	initMod3();
	seed = initalSeed;
	vec3 color, colorTotal;

	bool addDepth;
	uint secondaryPaths = 1; // Start at 1 instead of 0, because we are going to divide through it.

	for( uint sample = 0; sample < SAMPLES; sample++ ) {
		color = vec3( 1.0 );
		vec3 lightColor = vec3( -1.0 );
		ray r = initRay( pxDim, eyeIn );
		float maxValSpd = 0.0;
		int depthAdded = 0;

		for( uint depth = 0; depth < MAX_DEPTH + depthAdded; depth++ ) {
			CALL_TRAVERSE

			if( r.t == INFINITY ) {
				lightColor = SKY_LIGHT;
				break;
			}

			material mtl = materials[faces[r.faceIndex].material];

			// Implicit connection to a light found
			if( mtl.light == 1 ) {
				lightColor = mtl.colorDiff;
				break;
			}

			// Last round, no need to calculate a new ray.
			// Unless we hit a material that extends the path.
			addDepth = extendDepth( mtl );

			if( mtl.d == 1.0 && !addDepth && depth == MAX_DEPTH + depthAdded - 1 ) {
				break;
			}

			// seed += r.t;

			vec3 lightRaySource = vec3( -1.0 );
			ray lightRay;
			lightRay.t = INFINITY;

			#if IMPLICIT == 1

				if( mtl.d > 0.0 ) {
					lightRay.origin = r.t * r.dir + r.origin + r.normal * EPSILON;
					float rnd2 = rand();
					lightRay.dir = normalize( sunPos - lightRay.origin );

					CALL_TRAVERSE_SHADOW

					if( lightRay.t == INFINITY ) {
						lightRaySource = SKY_LIGHT;
					}
					else {
						material lightMTL = materials[faces[lightRay.faceIndex].material];
						lightRaySource = lightMTL.isLight ? lightMTL.color : vec3( -1.0 );
					}
				}

			#endif

			// New direction of the ray (bouncing off the hit surface)
			ray newRay = getNewRay( r, mtl, addDepth );

			updateColor(
				r, newRay, mtl, lightRay, lightRaySource, secondaryPaths,
				color, colorTotal
			);

			// Extend max path depth
			depthAdded += ( addDepth && depthAdded < MAX_ADDED_DEPTH );

			// TODO:
			// // Russian roulette termination
			// if( depth > 2 + depthAdded && maxValSpd < rand() ) {
			// 	break;
			// }

			r = newRay;
		} // end bounces

		if( lightColor.x >= 0.0 ) {
			colorTotal += color * lightColor;
		}
	} // end samples


	colorTotal /= (float) secondaryPaths;

	#if SAMPLES > 1

		colorTotal /= (float) SAMPLES;

	#endif

	// setColors( imageIn, imageOut, pixelWeight, spdTotal, focus );
	gl_FragColor = vec4( colorTotal, 1.0 );
}
