attribute vec2 vertexPos;

void main( void ) {
	gl_Position = vec4( vertexPos, 0.0, 1.0 );
}