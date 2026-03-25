import type { QuadMesh } from '../renderer/quad';
import type { Camera } from '../camera/camera';
import { createShaderProgram } from '../renderer/shader';
import { rgbToKey } from '../utils/color';

// Minimal shader for offscreen ID map rendering
const pickVert = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;
uniform mat3 uCameraMatrix;
out vec2 vTexCoord;
void main() {
    vec3 transformed = uCameraMatrix * vec3(aPosition, 1.0);
    gl_Position = vec4(transformed.xy, 0.0, 1.0);
    vTexCoord = aTexCoord;
}`;

const pickFrag = `#version 300 es
precision highp float;
uniform sampler2D uIdMap;
in vec2 vTexCoord;
out vec4 fragColor;
void main() {
    fragColor = texture(uIdMap, vTexCoord);
}`;

export class ProvincePicker {
  private gl: WebGL2RenderingContext;
  private pickProgram: WebGLProgram;
  private quad: QuadMesh;
  private idMapTexture: WebGLTexture;
  private fbo: WebGLFramebuffer;
  private fboTexture: WebGLTexture;
  private width: number;
  private height: number;
  private pixel = new Uint8Array(4);
  private uCam: WebGLUniformLocation | null;
  private uIdMap: WebGLUniformLocation | null;

  constructor(
    gl: WebGL2RenderingContext,
    _mainProgram: WebGLProgram,
    quad: QuadMesh,
    idMapTexture: WebGLTexture,
  ) {
    this.gl = gl;
    this.quad = quad;
    this.idMapTexture = idMapTexture;
    this.width = gl.canvas.width;
    this.height = gl.canvas.height;

    // Create a simple pick shader
    this.pickProgram = createShaderProgram(gl, pickVert, pickFrag);

    // Cache uniform locations
    this.uCam = gl.getUniformLocation(this.pickProgram, 'uCameraMatrix');
    this.uIdMap = gl.getUniformLocation(this.pickProgram, 'uIdMap');

    // Create offscreen FBO
    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error('Failed to create FBO');
    this.fbo = fbo;

    this.fboTexture = this.createFBOTexture();
  }

  private createFBOTexture(): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create FBO texture');

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.width, this.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return tex;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.gl.deleteTexture(this.fboTexture);
    this.fboTexture = this.createFBOTexture();
  }

  pick(screenX: number, screenY: number, camera: Camera): string | null {
    const { gl } = this;

    // Render ID map to offscreen FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.width, this.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.pickProgram);
    gl.uniformMatrix3fv(this.uCam, false, camera.getMatrix());
    gl.uniform1i(this.uIdMap, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.idMapTexture);

    gl.bindVertexArray(this.quad.vao);
    gl.drawElements(gl.TRIANGLES, this.quad.indexCount, gl.UNSIGNED_SHORT, 0);

    // Read pixel at mouse position (flip Y for WebGL coords)
    const flippedY = this.height - screenY;
    gl.readPixels(screenX, flippedY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.pixel);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);

    const [r, g, b] = this.pixel;
    // Skip black pixels (no province)
    if (r === 0 && g === 0 && b === 0) return null;

    return rgbToKey(r, g, b);
  }
}
