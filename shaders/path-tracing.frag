#ifdef GL_ES
	precision highp float;
#endif

#extension GL_OES_standard_derivatives : enable

uniform vec2 uResolution;
uniform float uGlobalTime;
// uniform vec4 iMouse;

#define SAMPLES %SAMPLES%
#define MAXDEPTH %MAX_DEPTH%

// TODO: Russian Roulette Termination
#define DEPTH_RUSSIAN 2

#define PI 3.14159265359
#define DIFF 0
#define SPEC 1
#define REFR 2
#define NUM_SPHERES 9

float seed = 0.0;

float rand() {
	return fract( sin( seed++ ) * 43758.5453123 );
}

struct Ray {
	vec3 orig;
	vec3 dir;
};

struct Sphere {
	float r;
	vec3 p, e, c;
	int refl;
};

Sphere lightSourceVolume = Sphere( 20.0, vec3( 50.0, 81.6, 81.6 ), vec3( 12.0 ), vec3( 0.0 ), DIFF );
Sphere spheres[NUM_SPHERES];


void initSpheres() {
	spheres[0] = Sphere( 1e5, vec3( -1e5 + 1.0, 40.8, 81.6 ), vec3( 0.0 ), vec3( 0.75, 0.25, 0.25 ), DIFF );
	spheres[1] = Sphere( 1e5, vec3( 1e5 + 99.0, 40.8, 81.6 ), vec3( 0.0 ), vec3(.25, .25, .75), DIFF );
	spheres[2] = Sphere( 1e5, vec3( 50.0, 40.8, -1e5 ), vec3( 0.0 ), vec3( 0.75 ), DIFF );
	spheres[3] = Sphere( 1e5, vec3( 50.0, 40.8,  1e5 + 170.0 ), vec3( 0.0 ), vec3( 0.0 ), DIFF );
	spheres[4] = Sphere( 1e5, vec3( 50.0, -1e5, 81.6 ), vec3( 0.0 ), vec3( 0.75 ), DIFF );
	spheres[5] = Sphere( 1e5, vec3( 50.0,  1e5 + 81.6, 81.6 ), vec3( 0.0 ), vec3( 0.75 ), DIFF );
	spheres[6] = Sphere( 16.5, vec3( 27.0, 16.5, 47.0 ), vec3( 0.0 ), vec3( 1.0 ), SPEC );
	spheres[7] = Sphere( 16.5, vec3( 73.0, 16.5, 78.0 ), vec3( 0.0 ), vec3( 0.7, 1.0, 0.9 ), REFR );
	spheres[8] = Sphere( 600.0, vec3( 50.0, 681.33, 81.6 ), vec3( 12.0 ), vec3( 0.0 ), DIFF );
}


float intersect( Sphere s, Ray r ) {
	vec3 op = s.p - r.orig;
	float t;
	float epsilon = 1e-3;
	float b = dot( op, r.dir );
	float det = b * b - dot( op, op ) + s.r * s.r;

	if( det < 0.0 ) {
		return 0.0;
	}
	else {
		det = sqrt( det );
	}

	t = b - det;

	if( t > epsilon ) {
		return t;
	}

	t = b + det;

	return ( t > epsilon ) ? t : 0.0;
}


int intersect( Ray r, out float t, out Sphere s, int avoid ) {
	int id = -1;
	t = 1e5;
	s = spheres[0];

	for( int i = 0; i < NUM_SPHERES; ++i ) {
		Sphere S = spheres[i];
		float d = intersect( S, r );

		if( i != avoid && d != 0.0 && d < t ) {
			t = d;
			id = i;
			s = S;
		}
	}

	return id;
}


vec3 jitter( vec3 d, float phi, float sina, float cosa ) {
	vec3 w = normalize( d );
	vec3 u = normalize( cross( w.yzx, w ) );
	vec3 v = cross( w, u );

	return ( u * cos( phi ) + v * sin( phi ) ) * sina + w * cosa;
}


/**
 * Accumulate radiance for the ray in the scene.
 */
vec3 radiance( Ray r ) {
	vec3 acc = vec3( 0.0 );
	vec3 mask = vec3( 1.0 );
	int id = -1;

	for( int depth = 0; depth < MAXDEPTH; ++depth ) {
		float t;
		Sphere obj;
		id = intersect( r, t, obj, id );

		if( id < 0 ) {
			break;
		}

		vec3 x = t * r.dir + r.orig;
		vec3 n = normalize( x - obj.p );
		vec3 nl = n * sign( -dot( n, r.dir ) );

		//vec3 f = obj.c;
		//float p = dot(f, vec3(1.2126, 0.7152, 0.0722));
		//if (depth > DEPTH_RUSSIAN || p == 0.0) if (rand() < p) f /= p; else { acc += mask * obj.e * E; break; }

		if( obj.refl == DIFF ) {
			float r2 = rand();
			vec3 d = jitter( nl, 2.0 * PI * rand(), sqrt( r2 ), sqrt( 1.0 - r2 ) );
			vec3 e = vec3( 0.0 );

			//for( int i = 0; i < NUM_SPHERES; ++i ) {
				// Sphere s = sphere( i );
				// if( dot( s.e, vec3( 1.0 ) ) == 0.0 ) {
				// 	continue;
				// }

				// Normally we would loop over the light sources and
				// cast rays toward them, but since there is only one
				// light source, that is mostly occluded, here goes
				// the ad hoc optimization:
				Sphere s = lightSourceVolume;
				int i = 8;

				vec3 l0 = s.p - x;
				float cos_a_max = sqrt( 1.0 - clamp( s.r * s.r / dot( l0, l0 ), 0.0, 1.0 ) );
				float cosa = mix( cos_a_max, 1.0, rand() );
				vec3 l = jitter( l0, 2.0 * PI * rand(), sqrt( 1.0 - cosa * cosa ), cosa );

				if( intersect( Ray( x, l ), t, s, id ) == i ) {
					float omega = 2.0 * PI * ( 1.0 - cos_a_max );
					e += ( s.e * clamp( dot( l, n ), 0.0 ,1.0 ) * omega ) / PI;
				}
			// }

			float E = 1.0;//float(depth==0);
			acc += mask * obj.e * E + mask * obj.c * e;
			mask *= obj.c;
			r = Ray( x, d );
		}
		else if( obj.refl == SPEC ) {
			acc += mask * obj.e;
			mask *= obj.c;
			r = Ray( x, reflect( r.dir, n ) );
		}
		else {
			float a = dot( n, r.dir );
			float ddn = abs( a );
			float nc = 1.0;
			float nt = 1.5;
			float nnt = mix( nc / nt, nt / nc, float( a > 0.0 ) );
			float cos2t = 1.0 - nnt * nnt * ( 1.0 - ddn * ddn );
			r = Ray( x, reflect( r.dir, n ) );

			if( cos2t > 0.0 ) {
				vec3 tdir = normalize( r.dir * nnt + sign( a ) * n * ( ddn * nnt + sqrt( cos2t ) ) );
				float R0 = ( nt - nc ) * ( nt - nc ) / ( ( nt + nc ) * ( nt + nc ) );
				float c = 1.0 - mix( ddn, dot( tdir, n ), float( a > 0.0 ) );
				float Re = R0 + ( 1.0 - R0 ) * c * c * c * c * c;
				float P= 0.25 + 0.5 * Re;
				float RP = Re / P;
				float TP = ( 1.0 - Re ) / ( 1.0 - P );

				if( rand() < P ) {
					mask *= RP;
				}
				else {
					mask *= obj.c * TP;
					r = Ray( x, tdir );
				}
			}
		}
	}

	return acc;
}


/**
 * Main.
 */
void main( void ) {
	vec2 iMouse = vec2( 0.0, 0.0 );
	seed = uGlobalTime + uResolution.y * gl_FragCoord.x / uResolution.x + gl_FragCoord.y / uResolution.y;

	initSpheres();

	vec2 uv = 2.0 * gl_FragCoord.xy / uResolution.xy - 1.0;
	vec3 camPos = vec3(
		( 2.0 * ( iMouse.xy == vec2( 0.0 ) ? 0.5 * uResolution.xy : iMouse.xy ) / uResolution.xy - 1.0 ) * vec2( 48.0, 40.0 ) + vec2( 50.0, 40.8 ),
		169.0
	);
	vec3 cz = normalize( vec3( 50.0, 40.0, 81.6 ) - camPos );
	vec3 cx = vec3( 1.0, 0.0, 0.0 );
	vec3 cy = normalize( cross( cx, cz ) );
	vec3 color = vec3( 0.0 );

	cx = cross( cz, cy );

	for( int i = 0; i < SAMPLES; i++ ) {
		color += radiance(
			Ray( camPos, normalize( 0.53135 * ( uResolution.x / uResolution.y * uv.x * cx + uv.y * cy ) + cz ) )
		);
	}

	gl_FragColor = vec4( pow( clamp( color / float( SAMPLES ), 0.0, 1.0 ), vec3( 1.0 / 2.2 ) ), 1.0 );
}