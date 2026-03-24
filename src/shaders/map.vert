#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform mat3 uCameraMatrix;

out vec2 vTexCoord;

void main() {
    vec3 transformed = uCameraMatrix * vec3(aPosition, 1.0);
    gl_Position = vec4(transformed.xy, 0.0, 1.0);
    vTexCoord = aTexCoord;
}
