// Detect province borders by sampling ID map neighbors
float detectBorder(sampler2D idMap, vec2 uv, vec2 texelSize) {
    vec3 center = texture(idMap, uv).rgb;
    vec3 right  = texture(idMap, uv + vec2(texelSize.x, 0.0)).rgb;
    vec3 up     = texture(idMap, uv + vec2(0.0, texelSize.y)).rgb;
    vec3 left   = texture(idMap, uv - vec2(texelSize.x, 0.0)).rgb;
    vec3 down   = texture(idMap, uv - vec2(0.0, texelSize.y)).rgb;

    float diff = 0.0;
    diff += step(0.002, distance(center, right));
    diff += step(0.002, distance(center, up));
    diff += step(0.002, distance(center, left));
    diff += step(0.002, distance(center, down));
    return clamp(diff, 0.0, 1.0);
}
