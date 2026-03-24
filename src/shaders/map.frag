#version 300 es
precision highp float;

// Texture samplers (bound to units 0-5)
uniform sampler2D uIdMap;           // unit 0: Province ID colors (NEAREST)
uniform sampler2D uTerrain;         // unit 1: Albedo/diffuse (LINEAR)
uniform sampler2D uHeightmap;       // unit 2: Grayscale elevation (LINEAR)
uniform sampler2D uNormalMap;       // unit 3: RGB normals (LINEAR)
uniform sampler2D uBorders;         // unit 4: Border overlay (LINEAR)
uniform sampler2D uProvinceColors;  // unit 5: 1D LUT — province index → nation RGBA

// Uniforms
uniform vec3  uSunDirection;
uniform float uAmbientStrength;
uniform float uPoliticalOpacity;
uniform vec2  uTexelSize;
uniform float uHoveredIndex;
uniform float uSelectedIndex;
uniform vec2  uResolution;
uniform int   uMapMode;  // 0=full, 1=terrain, 2=idmap, 3=normals, 4=heightmap, 5=borders

in vec2 vTexCoord;
out vec4 fragColor;

#include "common.glsl"
#include "lighting.glsl"
#include "borders.glsl"

void main() {
    // Debug map modes — short-circuit for single-layer view
    if (uMapMode == 1) { fragColor = vec4(texture(uTerrain, vTexCoord).rgb, 1.0); return; }
    if (uMapMode == 2) { fragColor = texture(uIdMap, vTexCoord); return; }
    if (uMapMode == 3) { fragColor = vec4(texture(uNormalMap, vTexCoord).rgb, 1.0); return; }
    if (uMapMode == 4) { fragColor = vec4(vec3(texture(uHeightmap, vTexCoord).r), 1.0); return; }
    if (uMapMode == 5) {
        float b = detectBorder(uIdMap, vTexCoord, uTexelSize);
        fragColor = vec4(vec3(1.0 - b), 1.0); return;
    }

    // 1. Sample ID map (NEAREST filtering preserves exact colors)
    vec4 idColor = texture(uIdMap, vTexCoord);

    // 2. Province index → nation color from LUT
    float provinceIndex = rgbToIndex(idColor.rgb);
    int idx = int(provinceIndex);
    vec4 nationColor = texelFetch(uProvinceColors, ivec2(idx, 0), 0);

    // 3. Sample terrain and boost brightness
    vec3 terrain = texture(uTerrain, vTexCoord).rgb;
    terrain = pow(terrain, vec3(0.75)) * 1.3; // gamma lift + brightness boost

    // 4. Blend terrain with political color (additive tint to preserve brightness)
    vec3 nationTint = nationColor.rgb / 255.0;
    vec3 politicalBlend = mix(terrain, terrain * 0.6 + nationTint * 0.5, uPoliticalOpacity * nationColor.a);

    // 5. Normal map → lighting
    vec3 normalSample = texture(uNormalMap, vTexCoord).rgb * 2.0 - 1.0;
    vec3 lighting = computeLighting(normalSample, uSunDirection, uAmbientStrength);

    // 6. Apply lighting (softened to avoid over-darkening)
    vec3 lit = politicalBlend * (lighting * 0.6 + 0.4);

    // 7. Border detection from ID map
    float border = detectBorder(uIdMap, vTexCoord, uTexelSize);

    // Also sample pre-rendered border overlay
    vec4 borderOverlay = texture(uBorders, vTexCoord);
    border = max(border, borderOverlay.a);

    // Subtle borders (less darkening)
    vec3 borderColor = vec3(0.25, 0.22, 0.18);
    lit = mix(lit, borderColor, border * 0.5);

    // 8. Hover highlight
    float hoveredMask = step(0.5, 1.0 - abs(provinceIndex - uHoveredIndex));
    lit = mix(lit, lit * 1.35, hoveredMask * 0.4);

    // 9. Selection highlight (brighter glow)
    float selectedMask = step(0.5, 1.0 - abs(provinceIndex - uSelectedIndex));
    lit = mix(lit, lit * 1.5 + vec3(0.05, 0.04, 0.02), selectedMask * 0.3);

    fragColor = vec4(lit, 1.0);
}
