/**
 * Phong tessellation of a given barycentric point.
 * @param  {vec3} P1
 * @param  {vec3} P2
 * @param  {vec3} P3
 * @param  {vec3} N1
 * @param  {vec3} N2
 * @param  {vec3} N3
 * @param  {float}  u
 * @param  {float}  v
 * @param  {float}  w
 * @return {vec3}          Phong tessellated point.
 */
vec3 phongTessellation(
	vec3 P1, vec3 P2, vec3 P3,
	vec3 N1, vec3 N2, vec3 N3,
	float u, float v, float w
) {
	vec3 pBary = P1 * u + P2 * v + P3 * w;
	vec3 pTessellated =
			u * projectOnPlane( pBary, P1, N1 ) +
			v * projectOnPlane( pBary, P2, N2 ) +
			w * projectOnPlane( pBary, P3, N3 );

	return ( 1.0 - PHONG_TESS_ALPHA ) * pBary + PHONG_TESS_ALPHA * pTessellated;
}


/**
 * Get the best axis of the ray direction in order to calculate the t factor later on.
 * Meaning: Get the axis with the biggest coordinate.
 * @param  {vec3} rd Ray direction.
 * @return {int}    Index of the axis (x: 0, y: 1, z: 2)
 */
int getBestRayDomain( vec3 rd ) {
	vec3 d = abs( rd );
	int domain = ( d.y > d.z ) ? 1 : 2;

	if( d.x > d.y ) {
		domain = ( d.x > d.z ) ? 0 : 2;
	}

	return domain;
}


/**
 * Find intersection of a triangle and a ray. (Phong tessellation.)
 * @param  {face}       f
 * @param  {ray}        r
 * @param  {inout vec3} tuv
 * @param  {float}      tNear
 * @param  {float}      tFar
 * @return {vec3}
 */
vec3 phongTessTriAndRayIntersect(
	face fc, ray r, inout vec3 tuv, float tNear, float tFar
) {
	#define P1 ( fc.a )
	#define P2 ( fc.b )
	#define P3 ( fc.c )
	#define N1 ( fc.an )
	#define N2 ( fc.bn )
	#define N3 ( fc.cn )

	vec3 normal = vec3( 0.0 );
	tuv.x = INFINITY;

	vec3 E01 = P2 - P1;
	vec3 E12 = P3 - P2;
	vec3 E20 = P1 - P3;

	vec3 C1 = PHONG_TESS_ALPHA * ( dot( N2, E01 ) * N2 - dot( N1, E01 ) * N1 );
	vec3 C2 = PHONG_TESS_ALPHA * ( dot( N3, E12 ) * N3 - dot( N2, E12 ) * N2 );
	vec3 C3 = PHONG_TESS_ALPHA * ( dot( N1, E20 ) * N1 - dot( N3, E20 ) * N3 );

	float a, b, c, d, e, f, l, m, n, o, p, q;

	{
		rayPlanes rp = getPlanesFromRay( r );

		a = dot( -rp.n1, C3 );
		b = dot( -rp.n1, C2 );
		c = dot( rp.n1, P3 ) - rp.o1;
		d = dot( rp.n1, C1 - C2 - C3 ) * 0.5;
		e = dot( rp.n1, C3 + E20 ) * 0.5;
		f = dot( rp.n1, C2 - E12 ) * 0.5;
		l = dot( -rp.n2, C3 );
		m = dot( -rp.n2, C2 );
		n = dot( rp.n2, P3 ) - rp.o2;
		o = dot( rp.n2, C1 - C2 - C3 ) * 0.5;
		p = dot( rp.n2, C3 + E20 ) * 0.5;
		q = dot( rp.n2, C2 - E12 ) * 0.5;
	}


	// Solve cubic

	vec3 xs = vec3( -1.0, -1.0, -1.0 );
	int numCubicRoots = 0;

	{
		float a3 = ( l*m*n + 2.0*o*p*q ) - ( l*q*q + m*p*p + n*o*o );
		float a2 = ( a*m*n + l*b*n + l*m*c + 2.0*( d*p*q + o*e*q + o*p*f ) ) -
		           ( a*q*q + b*p*p + c*o*o + 2.0*( l*f*q + m*e*p + n*d*o ) );
		float a1 = ( a*b*n + a*m*c + l*b*c + 2.0*( o*e*f + d*e*q + d*p*f ) ) -
		           ( l*f*f + m*e*e + n*d*d + 2.0*( a*f*q + b*e*p + c*d*o ) );
		float a0 = ( a*b*c + 2.0*d*e*f ) - ( a*f*f + b*e*e + c*d*d );

		numCubicRoots = solveCubic( a0, a1, a2, a3, xs );
	}

	if( 0 == numCubicRoots ) {
		return normal;
	}

	float x = 0.0;
	float determinant = INFINITY;
	float mA, mB, mC, mD, mE, mF;

	for( int i = 0; i < 3; i++ ) {
		if( i >= numCubicRoots ) {
			break;
		}

		mA = a * xs[i] + l;
		mB = b * xs[i] + m;
		mD = d * xs[i] + o;
		float tmp = mD * mD - mA * mB;

		x = ( determinant > tmp ) ? xs[i] : x;
		determinant = min( determinant, tmp );
	}

	if( 0.0 >= determinant ) {
		return normal;
	}


	int domain = getBestRayDomain( r.dir );

	mA = a * x + l;
	mB = b * x + m;
	mC = c * x + n;
	mD = d * x + o;
	mE = e * x + p;
	mF = f * x + q;

	bool AlessB = ( abs( mA ) < abs( mB ) );

	float mBorA = AlessB ? mB : mA;
	mA = mA / mBorA;
	mB = mB / mBorA;
	mC = mC / mBorA;
	mD = mD / mBorA;
	mE = mE / mBorA;
	mF = mF / mBorA;

	float mAorB = AlessB ? mA : mB;
	float mEorF = AlessB ? 2.0 * mE : 2.0 * mF;
	float mForE = AlessB ? mF : mE;
	float ab = AlessB ? a : b;
	float ba = AlessB ? b : a;
	float ef = AlessB ? e : f;
	float fe = AlessB ? f : e;

	float sqrtAorB = sqrt( mD * mD - mAorB );
	float sqrtC = sqrt( mForE * mForE - mC );
	float lab1 = mD + sqrtAorB;
	float lab2 = mD - sqrtAorB;
	float lc1 = mForE + sqrtC;
	float lc2 = mForE - sqrtC;

	if( abs( mEorF - lab1 * lc1 - lab2 * lc2 ) < abs( mEorF - lab1 * lc2 - lab2 * lc1 ) ) {
		swap( lc1, lc2 );
	}

	for( int loop = 0; loop < 2; loop++ ) {
		float g = ( 0 == loop ) ? -lab1 : -lab2;
		float h = ( 0 == loop ) ? -lc1 : -lc2;

		// Solve quadratic function: c0*u*u + c1*u + c2 = 0
		float c0 = ab + g * ( 2.0 * d + ba * g );
		float c1 = 2.0 * ( h * ( d + ba * g ) + ef + fe * g );
		float c2 = h * ( ba * h + 2.0 * fe ) + c;
		int numResults = solveCubic( 0.0, c0, c1, c2, xs );

		for( int i = 0; i < 3; i++ ) {
			if( i >= numResults ) {
				break;
			}

			float u = xs[i];
			float v = g * u + h;
			float w = 1.0 - u - v;

			if( u < 0.0 || v < 0.0 || w < 0.0 ) {
				continue;
			}

			if( !AlessB ) {
				swap( u, v );
			}

			vec3 pTessellated = phongTessellation( P1, P2, P3, N1, N2, N3, u, v, w ) - r.origin;
			float t;

			if( domain == 0 ) {
				t = pTessellated.x / r.dir.x;
			}
			else if( domain == 1 ) {
				t = pTessellated.y / r.dir.y;
			}
			else {
				t = pTessellated.z / r.dir.z;
			}

			// tuv.x -- best hit in this AABB so far
			// r.t   -- best hit found in other AABBs so far
			// tFar  -- far limit of this AABB
			// tNear -- near limit of this AABB
			if( t >= abs( tNear ) && t <= min( tuv.x, min( r.t, tFar ) ) ) {
				tuv.x = t;
				tuv.y = u;
				tuv.z = v;
				normal = getPhongTessNormal( fc, r.dir, u, v, w, C1, C2, C3, E12, E20 );
			}
		}
	}

	return normal;

	#undef P1
	#undef P2
	#undef P3
	#undef N1
	#undef N2
	#undef N3
}
