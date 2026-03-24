// Blinn-Phong style directional lighting from normal map
vec3 computeLighting(vec3 normal, vec3 sunDir, float ambient) {
    vec3 n = normalize(normal);
    vec3 l = normalize(sunDir);
    float diffuse = max(dot(n, l), 0.0);
    return vec3(ambient + (1.0 - ambient) * diffuse);
}
