// Schlick
#if BRDF == 0


	/**
	 * Zenith angle.
	 * @param  {float} t
	 * @param  {float} r Roughness factor (0: perfect specular, 1: perfect diffuse).
	 * @return {float}
	 */
	float Z( float t, float r ) {
		float x = 1.0f + r * t * t - t * t;
		return ( x == 0.0f ) ? 0.0f : r / ( x * x );
	}


	/**
	 * Azimuth angle.
	 * @param  {float} w
	 * @param  {float} p Isotropy factor (0: perfect anisotropic, 1: perfect isotropic).
	 * @return {float}
	 */
	float A( float w, float p ) {
		float p2 = p * p;
		float w2 = w * w;
		float x = p2 - p2 * w2 + w2;
		return ( x == 0.0f ) ? 0.0f : sqrt( p / x );
	}


	/**
	 * Smith factor.
	 * @param  {float} v
	 * @param  {float} r Roughness factor (0: perfect specular, 1: perfect diffuse)
	 * @return {float}
	 */
	float G( float v, float r ) {
		float x = r - r * v + v;
		return ( x == 0.0f ) ? 0.0f : v / x;
	}


	/**
	 * Directional factor.
	 * @param  {float} t
	 * @param  {float} v
	 * @param  {float} vIn
	 * @param  {float} w
	 * @param  {float} r
	 * @param  {float} p
	 * @return {float}
	 */
	float B1( float t, float vOut, float vIn, float w, float r, float p ) {
		return Z( t, r ) * A( w, p );
	}


	/**
	 * Directional factor.
	 * @param  {float} t
	 * @param  {float} v
	 * @param  {float} vIn
	 * @param  {float} w
	 * @param  {float} r
	 * @param  {float} p
	 * @return {float}
	 */
	float B2( float t, float vOut, float vIn, float w, float r, float p ) {
		float gp = G( vOut, r ) * G( vIn, r );
		float obstructed = gp * Z( t, r ) * A( w, p );
		float reemission = 1.0f - gp;

		return obstructed + reemission;
	}


	/**
	 * Directional factor.
	 * @param  {float} t
	 * @param  {float} v
	 * @param  {float} vIn
	 * @param  {float} w
	 * @param  {float} r
	 * @param  {float} p
	 * @return {float}
	 */
	float D( float t, float vOut, float vIn, float w, float r, float p ) {
		float b = 4.0f * r * ( 1.0f - r );
		float a = ( r < 0.5f ) ? 0.0f : 1.0f - b;
		float c = ( r < 0.5f ) ? 1.0f - b : 0.0f;

		float d = 4.0f * M_PI * vOut * vIn;

		float lam = a * M_1_PI;
		float ani = ( b == 0.0f || d == 0.0f ) ? 0.0f : b / d * B2( t, vOut, vIn, w, r, p );
		float fres = ( vIn == 0.0f ) ? 0.0f : c / vIn;

		return lam + ani + fres;
	}


	/**
	 *
	 * @param  {material}  mtl
	 * @param  {ray}       rayLightOut
	 * @param  {ray}       rayLightIn
	 * @param  {vec3}      normal
	 * @param  {out float} u
	 * @param  {out float} pdf
	 * @return {float}
	 */
	float brdfSchlick(
		material mtl, ray lightOut, ray lightIn, vec3 normal,
		out float u, out float pdf
	) {
		#define V_IN ( lightIn.dir )
		#define V_OUT ( -lightOut.dir )

		vec3 un = normalize( cross( normal.yzx, normal ) );

		vec3 h = bisect( V_OUT, V_IN );
		float t = dot( h, normal );
		float vIn = dot( V_IN, normal );
		float vOut = dot( V_OUT, normal );
		// float w = dot( un, projection( h, normal ) );
		vec3 hp = normalize( cross( cross( h, normal ), normal ) );
		float w = dot( un, hp );

		u = dot( h, V_OUT );
		pdf = t / ( 4.0f * M_PI * dot( V_OUT, h ) );

		return D( t, vOut, vIn, w, mtl.rough, mtl.p );

		#undef V_IN
		#undef V_OUT
	}


	/**
	 *
	 * @param  {ray}      r
	 * @param  {material} mtl
	 * @return {vec3}
	 */
	vec3 newRaySchlick( ray r, material mtl ) {
		vec3 newRay;

		if( mtl.rough == 0.0f ) {
			return reflect( DIR, N );
		}

		float a = rand();
		float b = rand();
		float iso2 = mtl.p * mtl.p;
		float alpha = acos( sqrt( a / ( mtl.rough - a * mtl.rough + a ) ) );
		float phi;

		if( b < 0.25f ) {
			b = 1.0f - 4.0f * ( 0.25f - b );
			float b2 = b * b;
			phi = M_PI_2 * sqrt( ( iso2 * b2 ) / ( 1.0f - b2 + b2 * iso2 ) );
		}
		else if( b < 0.5f ) {
			b = 1.0f - 4.0f * ( 0.5f - b );
			float b2 = b * b;
			phi = M_PI_2 * sqrt( ( iso2 * b2 ) / ( 1.0f - b2 + b2 * iso2 ) );
			phi = M_PI - phi;
		}
		else if( b < 0.75f ) {
			b = 1.0f - 4.0f * ( 0.75f - b );
			float b2 = b * b;
			phi = M_PI_2 * sqrt( ( iso2 * b2 ) / ( 1.0f - b2 + b2 * iso2 ) );
			phi = M_PI + phi;
		}
		else {
			b = 1.0f - 4.0f * ( 1.0f - b );
			float b2 = b * b;
			phi = M_PI_2 * sqrt( ( iso2 * b2 ) / ( 1.0f - b2 + b2 * iso2 ) );
			phi = 2.0f * M_PI - phi;
		}

		if( mtl.p < 1.0f ) {
			phi += M_PI_2;
		}

		vec3 H = jitter( N, phi, sin( alpha ), cos( alpha ) );
		newRay = reflect( DIR, H );

		if( dot( newRay, N ) <= 0.0f ) {
			newRay = jitter( N, PI_X2 * rand() * 2.0f, sqrt( a ), sqrt( 1.0f - a ) );
		}

		return newRay;
	}


// Shirley-Ashikhmin
#elif BRDF == 1


	/**
	 *
	 * @param  {float}       nu
	 * @param  {float}       nv
	 * @param  {float}       Rs
	 * @param  {float}       Rd
	 * @param  {ray}         lightOut
	 * @param  {ray}         lightIn
	 * @param  {vec3}        normal
	 * @param  {out float}   brdfSpec
	 * @param  {out float}   brdfDiff
	 * @param  {inout float} dotHK1
	 * @param  {out float}   pdf
	 * @return {float}
	 */
	float brdfShirleyAshikhmin(
		float nu, float nv, float Rs, float Rd,
		ray lightOut, ray lightIn, vec3 normal,
		out float brdfSpec, out float brdfDiff, inout float dotHK1, out float pdf
	) {
		// Surface tangent vectors orthonormal to the surface normal
		vec3 un = normalize( cross( normal.yzx, normal ) );
		vec3 vn = normalize( cross( normal, un ) );

		vec3 k1 = lightIn.dir;   // to light
		vec3 k2 = -lightOut.dir; // to viewer
		vec3 h = bisect( k1, k2 );

		float dotHU = dot( h, un );
		float dotHV = dot( h, vn );
		float dotHN = dot( h, normal );
		float dotNK1 = dot( normal, k1 );
		float dotNK2 = dot( normal, k2 );
		dotHK1 = dot( h, k1 ); // Needed for the Fresnel term later

		// Specular
		float ps_e = nu * dotHU * dotHU + nv * dotHV * dotHV;
		ps_e = ( dotHN == 1.0f ) ? 0.0f : ps_e / ( 1.0f - dotHN * dotHN );
		float ps0 = sqrt( ( nu + 1.0f ) * ( nv + 1.0f ) ) * 0.125f * M_1_PI;
		float ps1_num = pow( dotHN, ps_e );
		float ps1 = ps1_num / ( dotHK1 * max( dotNK1, dotNK2 ) );

		// Diffuse
		float pd = Rd * 0.38750768752f; // M_1_PI * 28.0f / 23.0f;
		float a = 1.0f - dotNK1 * 0.5f;
		float b = 1.0f - dotNK2 * 0.5f;
		pd *= 1.0f - a * a * a * a * a;
		pd *= 1.0f - b * b * b * b * b;

		brdfSpec = ps0 * ps1;
		brdfDiff = pd;

		// Probability Distribution Function
		float ph = ps0 * ps1_num;
		pdf = ph / dotHK1;
	}


	/**
	 *
	 * @param  {ray}      r
	 * @param  {material} mtl
	 * @return {vec3}
	 */
	vec3 newRayShirleyAshikhmin( ray r, material mtl ) {
		// // Just do it perfectly specular at such high and identical lobe values
		// if( mtl.nu == mtl.nv && mtl.nu >= 100000.0f ) {
		// 	return reflect( r.dir, r.normal );
		// }

		float a = rand();
		float b = rand();
		float phi_flip = M_PI;
		float phi_flipf = 1.0f;
		float aMax = 1.0f;

		if( a < 0.25f ) {
			aMax = 0.25f;
			phi_flip = 0.0f;
		}
		else if( a < 0.5f ) {
			aMax = 0.5f;
			phi_flipf = -1.0f;
		}
		else if( a < 0.75f ) {
			aMax = 0.75f;
		}
		else {
			phi_flip = 2.0f * M_PI;
			phi_flipf = -1.0f;
		}

		a = 1.0f - 4.0f * ( aMax - a );

		float phi = atan(
			sqrt( ( mtl.nu + 1.0f ) / ( mtl.nv + 1.0f ) ) * tan( M_PI_2 * a )
		);
		float phi_full = phi_flip + phi_flipf * phi;

		float cosphi = cos( phi );
		float sinphi = sin( phi );
		float theta_e = 1.0f / ( mtl.nu * cosphi * cosphi + mtl.nv * sinphi * sinphi + 1.0f );
		float theta = acos( pow( 1.0f - b, theta_e ) );

		vec3 normal = ( mtl.d < 1.0f || dot( r.normal, -r.dir ) >= 0.0f ) ? r.normal : -r.normal;

		vec3 h = jitter( normal, phi_full, sin( theta ), cos( theta ) );
		vec3 spec = reflect( r.dir, h );
		vec3 diff = jitter( normal, 2.0f * M_PI * rand(), sqrt( b ), sqrt( 1.0f - b ) );

		// If new ray direction points under the hemisphere,
		// use a cosine-weighted sample instead.
		vec3 newRay = ( dot( spec, normal ) <= 0.0f ) ? diff : spec;

		return newRay;
	}


#endif


/**
 * Calculate the new ray depending on the current one and the hit surface.
 * @param  {ray}        currentRay  The current ray
 * @param  {material}   mtl         Material of the hit surface.
 * @param  {inout bool} addDepth    Flag.
 * @return {ray}                    The new ray.
 */
ray getNewRay( ray r, material mtl, inout bool addDepth ) {
	ray newRay;
	newRay.t = INFINITY;
	newRay.origin = r.t * r.dir + r.origin;
	// newRay.origin += r.normal * EPSILON7;

	// Transparency and refraction
	bool doTransRefr = ( mtl.d < 1.0f && mtl.d <= rand() );

	addDepth = ( addDepth || doTransRefr );

	if( doTransRefr ) {
		newRay.dir = refract( r, mtl );
	}
	else {

		#if BRDF == 0

			// BRDF: Schlick.
			// Supports specular, diffuse, glossy, and anisotropic surfaces.
			newRay.dir = newRaySchlick( r, mtl );

		#elif BRDF == 1

			// BRDF: Shirley-Ashikhmin.
			// Supports specular, diffuse, glossy, and anisotropic surfaces.
			newRay.dir = newRayShirleyAshikhmin( r, mtl );

		#endif

	}

	return newRay;
}
