// Convert province ID map RGB (0-1 range) to a flat index
float rgbToIndex(vec3 color) {
    vec3 c = floor(color * 255.0 + 0.5);
    return c.r * 65536.0 + c.g * 256.0 + c.b;
}
