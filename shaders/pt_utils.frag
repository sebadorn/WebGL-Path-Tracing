float seed = 0.0;

float rand() {
	return fract( sin( seed++ ) * 43758.5453123 );
}


#define bisect( v, w ) ( normalize( ( v ) + ( w ) ) )


int MOD_3[6];

void initArrayMod3() {
	MOD_3[0] = 0;
	MOD_3[1] = 1;
	MOD_3[2] = 2;
	MOD_3[3] = 0;
	MOD_3[4] = 1;
	MOD_3[5] = 2;
}


/**
 * Fresnel factor.
 * @param  {float} u
 * @param  {vec3}  c Reflection factor.
 * @return {vec3}
 */
vec3 fresnel( float u, vec3 c ) {
	float v = 1.0 - u;
	vec3 cm = vec3( 1.0 - c[0], 1.0 - c[1], 1.0 - c[2] );

	return c + cm * v * v * v * v * v;
}


/**
 * Swap two float values.
 * @param {inout float} a
 * @param {inout float} b
 */
void swap( inout float a, inout float b ) {
	float tmp = a;
	a = b;
	b = tmp;
}


/**
 * Decide if to extend the max depth of the path.
 * @param {material} mtl The last hit material.
 */
bool extendDepth( material mtl ) {
	#if BRDF == 1
		// TODO: Use rand() in some way instead of this fixed threshold.
		return max( mtl.nu, mlt.nv ) >= 50.0;
	#else
		return mtl.rough < rand();
	#endif
}


/**
 * Compute the cube-root.
 * @param  {float} a Value to compute the cube-root of.
 * @return {float}   The cube-root.
 */
float cbrt( float a ) {
	return ( a >= 0.0 ) ? pow( a, THIRD ) : -pow( -a, THIRD );
}


/**
 * Solve a cubic function: a0*x^3 + a1*x^2 + a2*x^1 + a3 = 0
 * @param  {float}    a0
 * @param  {float}    a1
 * @param  {float}    a2
 * @param  {float}    a3
 * @param  {inout vec3} x  Output. Found real solutions.
 * @return {int}        Number of found real solutions.
 */
int solveCubic( float a0, float a1, float a2, float a3, inout vec3 x ) {
	float w, p, q, dis, phi;

	if( abs( a0 ) > 0.0 ) {
		// cubic problem
		w = a1 / a0 * THIRD;
		p = a2 / a0 * THIRD - w * w;
		p = p * p * p;
		q = 0.5 * ( a2 * w - a3 ) / a0 - w * w * w;
		dis = q * q + p;

		if( dis < 0.0 ) {
			// three real solutions
			phi = acos( clamp( q / sqrt( -p ), -1.0, 1.0 ) );
			p = 2.0 * pow( -p, THIRD_HALF );

			float u[3];
			u[0] = p * cos( phi * THIRD ) - w;
			u[1] = p * cos( ( phi + 2.0 * M_PI ) * THIRD ) - w;
			u[2] = p * cos( ( phi + 4.0 * M_PI ) * THIRD ) - w;

			x[0] = min( u[0], min( u[1], u[2] ) );
			x[1] = max( min( u[0], u[1] ), max( min( u[0], u[2] ), min( u[1], u[2] ) ) );
			x[2] = max( u[0], max( u[1], u[2] ) );

			// Minimize rounding errors through a Newton iteration
			x[0] -= ( a3 + x[0] * ( a2 + x[0] * ( a1 + x[0] * a0 ) ) ) /
					( a2 + x[0] * ( 2.0 * a1 + x[0] * 3.0 * a0 ) );
			x[1] -= ( a3 + x[1] * ( a2 + x[1] * ( a1 + x[1] * a0 ) ) ) /
					( a2 + x[1] * ( 2.0 * a1 + x[1] * 3.0 * a0 ) );
			x[2] -= ( a3 + x[2] * ( a2 + x[2] * ( a1 + x[2] * a0 ) ) ) /
					( a2 + x[2] * ( 2.0 * a1 + x[2] * 3.0 * a0 ) );

			return 3;
		}
		else {
			// only one real solution!
			dis = sqrt( dis );
			x[0] = cbrt( q + dis ) + cbrt( q - dis ) - w;

			// Newton iteration
			x[0] -= ( a3 + x[0] * ( a2 + x[0] * ( a1 + x[0] * a0 ) ) ) /
					( a2 + x[0] * ( 2.0 * a1 + x[0] * 3.0 * a0 ) );

			return 1;
		}
	}
	else if( abs( a1 ) > 0.0 ) {
		// quadratic problem
		p = 0.5 * a2 / a1;
		dis = p * p - ( a3 / a1 );

		if( dis >= 0.0 ) {
			float dis_sqrt = sqrt( dis );

			// 2 real solutions
			x[0] = -p - dis_sqrt;
			x[1] = -p + dis_sqrt;

			// Newton iteration
			x[0] -= ( a3 + x[0] * ( a2 + x[0] * a1 ) ) /
					( a2 + x[0] * 2.0 * a1 );
			x[1] -= ( a3 + x[1] * ( a2 + x[1] * a1 ) ) /
					( a2 + x[1] * 2.0 * a1 );

			return 2;
		}
	}
	else if( abs( a2 ) > 0.0 ) {
		// linear equation
		x[0] = -a3 / a2;

		return 1;
	}

	return 0;
}


/**
 * Get two planes from a ray that have the ray as intersection.
 * The planes are described in the Hesse normal form.
 * @param  {ray}       r The ray.
 * @return {rayPlanes}   The planes describing the ray.
 */
rayPlanes getPlanesFromRay( ray r ) {
	rayPlanes rp;

	rp.n1 = normalize( cross( r.origin, r.dir ) );
	rp.n2 = normalize( cross( rp.n1, r.dir ) );

	rp.o1 = dot( rp.n1, r.origin );
	rp.o2 = dot( rp.n2, r.origin );

	return rp;
}


/**
 *
 * @param  {face}  f Face/triangle data.
 * @param  {float} u
 * @param  {float} v
 * @param  {float} w
 * @return {vec3}    Normal of the triangle.
 */
vec3 getTriangleNormal( face f, float u, float v, float w ) {
	return normalize( f.an * u + f.bn * v + f.cn * w );
}


/**
 *
 * @param  {float} u
 * @param  {float} v
 * @param  {float} w
 * @param  {vec3}  C12
 * @param  {vec3}  C23
 * @param  {vec3}  C31
 * @param  {vec3}  E23
 * @param  {vec3}  E31
 * @return {vec3}      Normal of the triangle.
 */
vec3 getTriangleNormalS(
	float u, float v, float w,
	vec3 C12, vec3 C23, vec3 C31, vec3 E23, vec3 E31
) {
	vec3 du = ( w - u ) * C31 + v * ( C12 - C23 ) + E31;
	vec3 dv = ( w - v ) * C23 + u * ( C12 - C31 ) - E23;

	return normalize( cross( du, dv ) );
}


/**
 *
 * @param  {vec3} view
 * @param  {vec3} np
 * @return {vec3}      Reflection vector.
 */
vec3 getTriangleReflectionVec( vec3 view, vec3 np ) {
	return view - 2.0 * np * dot( view, np );
}


/**
 *
 * @param  {face}  f      Face/triangle data.
 * @param  {vec3}  rayDir Direction of the ray vector.
 * @param  {float} u
 * @param  {float} v
 * @param  {float} w
 * @param  {vec3}  C1
 * @param  {vec3}  C2
 * @param  {vec3}  C3
 * @param  {vec3}  E12
 * @param  {vec3}  E20
 * @return {vec3}         Normal of the triangle.
 */
vec3 getPhongTessNormal(
	face f, vec3 rayDir, float u, float v, float w,
	vec3 C1, vec3 C2, vec3 C3, vec3 E12, vec3 E20
) {
	vec3 ns = getTriangleNormalS( u, v, w, C1, C2, C3, E12, E20 );
	vec3 np = getTriangleNormal( f, u, v, w );
	vec3 r = getTriangleReflectionVec( rayDir, np );

	return ( dot( ns, r ) > 0.0 ) ? ns : np;
}


/**
 * Create a random ray reflected from a surface given by a normal vector.
 * @param  {vec3}  nl   Normal (unit vector).
 * @param  {float} phi
 * @param  {float} sina
 * @param  {float} cosa
 * @param  {vec3}       New ray direction.
 */
vec3 jitter( vec3 nl, float phi, float sina, float cosa ) {
	vec3 u = normalize( cross( nl.yzx, nl ) );
	vec3 v = normalize( cross( nl, u ) );

	return normalize(
		normalize(
			u * cos( phi ) + v * sin( phi )
		) * sina + nl * cosa
	);
}


/**
 * Project a point on a plane.
 * @param  {vec3} q Point to project.
 * @param  {vec3} p Point of plane.
 * @param  {vec3} n Normal of plane.
 * @return {vec3}   Projected point.
 */
vec3 projectOnPlane( vec3 q, vec3 p, vec3 n ) {
	return q - dot( q - p, n ) * n;
}


/**
 * MACRO: Apply Lambert's cosine law for light sources.
 * @param  {vec3}  n Normal of the surface the light hits.
 * @param  {vec3}  l Normalized direction to the light source.
 * @return {float}
 */
#define lambert( n, l ) ( max( dot( ( n ), ( l ) ), 0.0 ) )


/**
 * MACRO: Projection of h orthogonal n, with n being a unit vector.
 * @param  {vec3} h Vector orthogonal to n.
 * @param  {vec3} n Normal vector.
 * @return {vec3}   Projection of h onto n.
 */
#define projection( h, n ) ( dot( ( h ), ( n ) ) * ( n ) )


/**
 * Get a new direction for a ray hitting a transparent surface (glass etc.).
 * @param  {ray}      r   Current ray.
 * @param  {material} mtl Material of the hit surface.
 * @return {vec3}         New ray direction.
 */
vec3 refract( ray r, material mtl ) {
	bool into = dot( r.normal, r.dir ) < 0.0;
	// vec3 nl = into ? r.normal : -r.normal;

	float m1 = into ? NI_AIR : mtl.Ni;
	float m2 = into ? mtl.Ni : NI_AIR;
	float m = m1 / m2;
	// float cosI = -dot( r.dir, nl );
	// float sinT2 = m * m * ( 1.0 - cosI * cosI );

	// // Critical angle. Total internal reflection.
	// if( sinT2 > 1.0 ) {
	// 	return reflect( r.dir, nl );
	// }

	// // Reflectance and transmission.

	// float r0 = ( m1 - m2 ) / ( m1 + m2 );
	// float c = ( m1 > m2 ) ? sqrt( 1.0 - sinT2 ) : cosI;
	// float reflectance = fresnel( c, r0 * r0 );

	// vec3 newRay = ( reflectance < rand() )
	//             ? m * r.dir + ( m * cosI - sqrt( 1.0 - sinT2 ) ) * nl
	//             : reflect( r.dir, nl );

	// return normalize( newRay );

	return refract( r.dir, r.normal, m );
}