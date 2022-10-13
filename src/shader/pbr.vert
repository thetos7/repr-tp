precision highp float;

in vec3 in_position;
in vec3 in_normal;
#ifdef USE_UV
  in vec2 in_uv;
#endif // USE_UV

/**
 * Varyings.
 */

out vec3 vNormalWS;
#ifdef USE_UV
  out vec2 vUv;
#endif // USE_UV

/**
 * Uniforms List
 */

struct Model
{
  mat4 localToProjection;
  mat4 transform;
};

uniform Model uModel;

out vec3 vViewDirection;

void
main()
{
  vec4 positionLocal = vec4(in_position, 1.0);
  vNormalWS = in_normal;
#ifdef USE_UV
  vUv = in_uv;
#endif
  // vViewDirection = uModel.localToProjection * vec4(0.0,0.0,1.0,1.0);
  gl_Position = uModel.localToProjection * uModel.transform * positionLocal;
}
