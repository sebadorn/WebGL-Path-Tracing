/**
 * Find intersection of a triangle and a ray. (No tessellation.)
 * @param  {face_t*} face
 * @param  {ray4*}   ray
 * @param  {vec3*}       tuv
 * @param  {float}   tNear
 * @param  {float}   tFar
 * @return {vec3}
 */
vec3 flatTriAndRayIntersect( face f, ray r, inout vec3 tuv, float tNear, float tFar ) {
	vec3 edge1 = f.b - f.a;
	vec3 edge2 = f.c - f.a;
	vec3 tVec = r.origin - f.a;
	vec3 pVec = cross( r.dir, edge2 );
	vec3 qVec = cross( tVec, edge1 );
	float invDet = 1.0 / dot( edge1, pVec );

	tuv.x = dot( edge2, qVec ) * invDet;

	if( tuv.x < EPSILON || max( tuv.x - tFar, tNear - tuv.x ) > EPSILON ) {
		tuv.x = INFINITY;
		return vec3( 0.0 );
	}

	tuv.y = dot( tVec, pVec ) * invDet;
	tuv.z = dot( r.dir, qVec ) * invDet;
	tuv.x = ( min( tuv.y, tuv.z ) < 0.0 || tuv.y > 1.0 || tuv.y + tuv.z > 1.0 ) ? INFINITY : tuv.x;

	return getTriangleNormal( f, 1.0 - tuv.y - tuv.z, tuv.y, tuv.z );
}


/**
 * Face intersection test after Möller and Trumbore.
 * @param  {ray}        r
 * @param  {face}       f
 * @param  {inout vec3} tuv
 * @param  {float}      tNear
 * @param  {float}      tFar
 */
vec3 checkFaceIntersection( ray r, face f, inout vec3 tuv, float tNear, float tFar ) {
	#if PHONG_TESS == 1

		bvec3 cmp = equal( f.an, equal( f.bn, f.cn ) );

		if( cmp.x && cmp.y && cmp.z )

	#endif

	{
		return flatTriAndRayIntersect( f, r, tuv, tNear, tFar );
	}


	// Phong Tessellation
	// Based on: "Direct Ray Tracing of Phong Tessellation" by Shinji Ogaki, Yusuke Tokuyoshi
	#if PHONG_TESS == 1

		return phongTessTriAndRayIntersect( f, r, tuv, tNear, tFar );

	#endif
}


/**
 * Based on: "An Efficient and Robust Ray–Box Intersection Algorithm", Williams et al.
 * @param  {ray}         r
 * @param  {float}       bbMin
 * @param  {float}       bbMax
 * @param  {inout float} tNear
 * @param  {inout float} tFar
 * @return {bool}        True, if ray intersects box, false otherwise.
 */
bool intersectBox(
	ray r, vec3 invDir, vec3 bbMin, vec3 bbMax,
	inout float tNear, inout float tFar
) {
	vec3 t1 = ( bbMin - r.origin ) * invDir;
	vec3 tMax = ( bbMax - r.origin ) * invDir;
	vec3 tMin = min( t1, tMax );
	tMax = max( t1, tMax );

	tNear = max( max( tMin.x, tMin.y ), tMin.z );
	tFar = min( min( tMax.x, tMax.y ), min( tMax.z, tFar ) );

	return ( tNear <= tFar );
}


/**
 * Calculate intersection of a ray with a sphere.
 * @param  {ray}         r            The ray.
 * @param  {vec3}        sphereCenter Center of the sphere.
 * @param  {float}       radius       Radius of the sphere.
 * @param  {inout float} tNear        <t> near of the intersection (ray entering the sphere).
 * @param  {inout float} tFar         <t> far of the intersection (ray leaving the sphere).
 * @return {bool}                     True, if ray intersects sphere, false otherwise.
 */
bool intersectSphere(
	ray r, vec3 sphereCenter, float radius, inout float tNear, inout float tFar
) {
	vec3 op = sphereCenter - r.origin;
	float b = dot( op, r.dir );
	float det = b * b - dot( op, op ) + radius * radius;

	if( det < 0.0 ) {
		return false;
	}

	det = sqrt( det );
	tNear = b - det;
	tFar = b + det;

	return ( max( tNear, tFar ) > 0.0 );
}
