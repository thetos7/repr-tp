precision highp float;

// #define POINT_LIGHT_COUNT 4

#define M_PI 3.1415926535897932384626433832795

#define EPSILON 0.000000000000000001

#define SPECULAR_ROUGH_LEVEL_COUNT 6.0

const float RECIPROCAL_PI = 0.31830988618;
const float RECIPROCAL_PI2 = 0.15915494;

vec2 cartesianToPolar(vec3 n) {
    vec2 uv;
    uv.x = atan(n.z, n.x) * RECIPROCAL_PI2 + 0.5;
    uv.y = asin(n.y) * RECIPROCAL_PI + 0.5;
    return uv;
}

vec3 rgbmDecode(vec4 rgbm) {
  return 6.0 * rgbm.rgb * rgbm.a;
}

out vec4 outFragColor;
struct Material
{
  vec3 albedo;
  float metallic;
  float roughness;
};

uniform Material uMaterial;
uniform vec3 uCamPos;

#ifdef LIGHT_PROBE
  uniform sampler2D uBrdfTex;
  uniform sampler2D uDiffuseTex;
  uniform sampler2D uSpecularTex;
#endif

struct PointLightsInfo{
  vec3 positions[POINT_LIGHT_COUNT];
  float powers[POINT_LIGHT_COUNT];
};

uniform PointLightsInfo uPointLightsInfo;

// From three.js
vec4 sRGBToLinear( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

// From three.js
vec4 LinearTosRGB( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

in vec3 vNormalWS;
#ifdef USE_UV
  in vec2 vUv;
#endif
in vec3 vWorldPos;
vec3 normal;

float safeDot(vec3 a, vec3 b) {
  return max(dot(a,b), EPSILON);
}

vec3 sampleDiffuseEnv(sampler2D tex, vec3 dir) {
  return rgbmDecode(texture(tex, cartesianToPolar(dir)));
}

vec3 textureLod(sampler2D tex, vec2 uv, float level) {
  vec2 map_uv = uv;
  map_uv /= pow(2.0, level);
  map_uv.y /= 2.0;
  map_uv.y += 1.0 - (1.0 / pow(2.0, level));
  return rgbmDecode(texture(tex, map_uv));
}

vec3 sampleSpecularEnv(sampler2D tex, vec3 dir, float roughness) {
  vec2 coordinates = cartesianToPolar(dir);

  float prevLevel = max(floor(roughness * SPECULAR_ROUGH_LEVEL_COUNT), 0.0);
  float nextLevel = min(ceil(roughness * SPECULAR_ROUGH_LEVEL_COUNT), SPECULAR_ROUGH_LEVEL_COUNT-1.0);
  float prevLevelNorm = prevLevel/SPECULAR_ROUGH_LEVEL_COUNT;
  float nextLevelNorm = nextLevel/SPECULAR_ROUGH_LEVEL_COUNT;
  vec3 prevLevelSample = textureLod(tex, coordinates, prevLevel);
  vec3 nextLevelSample = textureLod(tex, coordinates, nextLevel);
  
  float fact = (roughness - prevLevelNorm) / (nextLevel - prevLevelNorm);
  
  return fact * nextLevelSample + (1.0 - fact) * nextLevelSample;
}

vec3 diffuseBRDF(vec3 albedo, vec3 _viewDirection, vec3 lightDirection) {
  return albedo/M_PI;
}

float distribGGX(vec3 normal, vec3 h, float roughness) {
  float rough_sq = roughness * roughness;
  return rough_sq
  /
  (M_PI * pow(pow(safeDot(normal, h), 2.0) * (rough_sq - 1.0) + 1.0, 2.0));
}

float shadowingSchlickGGX(vec3 normal, vec3 dir, float roughness) {
  float d = safeDot(normal, dir);
  return d / (d * (1.0 - roughness) + roughness);
}

float shadowingGGX(vec3 normal, vec3 viewDirection, vec3 lightDirection, float roughness) {
  return shadowingSchlickGGX(normal, viewDirection, roughness) * shadowingSchlickGGX(normal, lightDirection, roughness);
}

// float compute_f_0(float ior) {
//   return pow(ior - 1.0, 2.0) / (ior + 1.0, 2.0);
// }

vec3 fresnelSchlick(vec3 viewDirection, vec3 h, vec3 f_0) {
  return f_0 + (1.0 - f_0) * pow(1.0 - safeDot(viewDirection, h), 5.0);
}

vec3 specularBRDF(vec3 albedo, vec3 viewDirection, vec3 lightDirection) {
  vec3 h = normalize(viewDirection + lightDirection);
  float D = distribGGX(normal, h, uMaterial.roughness);
  float G = shadowingGGX(normal, viewDirection, lightDirection, uMaterial.roughness);
  vec3 f0 = mix(vec3(0.04), albedo, uMaterial.metallic);
  vec3 F = fresnelSchlick(viewDirection, h, f0);

  float ndo = safeDot(viewDirection, normal);
  float ndi = safeDot(lightDirection, normal);
  vec3 res = (D*F*G)/(4.0*ndo*ndi);
  // return vec3(F);
  return res;
}

float sampleLight(vec3 lightDir, vec3 pos, float lightPow) {
  float r = 1.0;
  float r2 = r * r;
  return lightPow/(4.0*M_PI*r2);
}

vec3 indirectDiffuse(vec3 albedo) {
  return albedo / M_PI * sampleDiffuseEnv(uDiffuseTex, normal);
}

vec3 indirectSpecular(vec3 albedo, vec3 viewDirection, vec3 f0, vec3 ks) {
  vec3 reflection = reflect(-viewDirection, normal);
  // float f0 = 0.04;
  vec3 specularSample = sampleSpecularEnv(uSpecularTex, reflection, uMaterial.roughness);
  float vDotN = dot(normal, viewDirection);
  vec2 brdf_uv;
  brdf_uv.x = vDotN;
  brdf_uv.y = uMaterial.roughness;
  vec2 brdf = texture(uBrdfTex, brdf_uv).rg;
  vec3 F =  ks * brdf.r + brdf.g;
  return specularSample * F;
}

vec3 indirectLighting(vec3 albedo, vec3 viewDirection) {
  vec3 f0 = mix(vec3(0.04), albedo, uMaterial.metallic);
  vec3 ks = fresnelSchlick(viewDirection, normal, f0);
  vec3 kd = (1.0 - ks) * (1.0 - uMaterial.metallic) * albedo;

  // diffuse
  vec3 diffuse = kd * sampleDiffuseEnv(uDiffuseTex, normal);

  vec3 specular = indirectSpecular(albedo, viewDirection, f0, ks);

  return diffuse + specular;
}

void
main()
{
  // **DO NOT** forget to do all your computation in linear space.
  vec3 albedo = sRGBToLinear(vec4(uMaterial.albedo, 1.0)).rgb;
  vec3 viewDirection = normalize(uCamPos - vWorldPos);
  normal = normalize(vNormalWS);
  vec3 directIrradiance = vec3(0);
  // float ks = 1.0; // TODO
  float kd = 1.0 - uMaterial.metallic; // TODO
  // float kd = 1.0 - ks;
  for(int i = 0; i < POINT_LIGHT_COUNT; ++i) {
    vec3 lightPos = uPointLightsInfo.positions[i];
    vec3 lightDirection =  lightPos - vWorldPos;
    float lightPower = uPointLightsInfo.powers[i];

    vec3 specular = specularBRDF(albedo, viewDirection, lightDirection);
    vec3 diffuse = kd * diffuseBRDF(albedo, viewDirection, lightDirection);
    
    float cosTheta = safeDot(normal, lightDirection);
    float illumination = sampleLight(lightDirection,lightPos, lightPower);
    directIrradiance += (diffuse + specular) * cosTheta * illumination;
  }

  vec3 indirectIrradiance = indirectLighting(albedo, viewDirection);
  // vec3 indirectIrradiance = sampleSpecularEnv(uSpecularTex, normal, uMaterial.roughness);

  // vec3 color = indirectIrradiance;
  // vec3 color = directIrradiance;
  vec3 color = directIrradiance+indirectIrradiance;
  // **DO NOT** forget to apply gamma correction as last step.
  outFragColor.rgba = LinearTosRGB(vec4(color, 1.0));
}
