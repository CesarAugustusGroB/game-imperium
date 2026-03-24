import type { MapTextures } from '../types/index';
import type { QuadMesh } from './quad';
import type { Camera } from '../camera/camera';
import type { ProvinceRegistry } from '../game/provinces';
import { getUniformLocation } from './shader';
import { rgbToIndex, keyToRgb } from '../utils/color';

export class MapRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private quad: QuadMesh;
  private textures: MapTextures;
  private camera: Camera;
  private registry: ProvinceRegistry;

  // Uniform locations
  private uCameraMatrix: WebGLUniformLocation | null;
  private uIdMap: WebGLUniformLocation | null;
  private uTerrain: WebGLUniformLocation | null;
  private uHeightmap: WebGLUniformLocation | null;
  private uNormalMap: WebGLUniformLocation | null;
  private uBorders: WebGLUniformLocation | null;
  private uProvinceColors: WebGLUniformLocation | null;
  private uSunDirection: WebGLUniformLocation | null;
  private uAmbientStrength: WebGLUniformLocation | null;
  private uPoliticalOpacity: WebGLUniformLocation | null;
  private uTexelSize: WebGLUniformLocation | null;
  private uHoveredIndex: WebGLUniformLocation | null;
  private uSelectedIndex: WebGLUniformLocation | null;
  private uResolution: WebGLUniformLocation | null;
  private uMapMode: WebGLUniformLocation | null;

  private hoveredIndex: number = -1;
  private selectedIndex: number = -1;
  mapMode: number = 0;

  constructor(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    quad: QuadMesh,
    textures: MapTextures,
    camera: Camera,
    registry: ProvinceRegistry,
  ) {
    this.gl = gl;
    this.program = program;
    this.quad = quad;
    this.textures = textures;
    this.camera = camera;
    this.registry = registry;

    // Cache uniform locations
    gl.useProgram(program);
    this.uCameraMatrix = getUniformLocation(gl, program, 'uCameraMatrix');
    this.uIdMap = getUniformLocation(gl, program, 'uIdMap');
    this.uTerrain = getUniformLocation(gl, program, 'uTerrain');
    this.uHeightmap = getUniformLocation(gl, program, 'uHeightmap');
    this.uNormalMap = getUniformLocation(gl, program, 'uNormalMap');
    this.uBorders = getUniformLocation(gl, program, 'uBorders');
    this.uProvinceColors = getUniformLocation(gl, program, 'uProvinceColors');
    this.uSunDirection = getUniformLocation(gl, program, 'uSunDirection');
    this.uAmbientStrength = getUniformLocation(gl, program, 'uAmbientStrength');
    this.uPoliticalOpacity = getUniformLocation(gl, program, 'uPoliticalOpacity');
    this.uTexelSize = getUniformLocation(gl, program, 'uTexelSize');
    this.uHoveredIndex = getUniformLocation(gl, program, 'uHoveredIndex');
    this.uSelectedIndex = getUniformLocation(gl, program, 'uSelectedIndex');
    this.uResolution = getUniformLocation(gl, program, 'uResolution');
    this.uMapMode = getUniformLocation(gl, program, 'uMapMode');

    // Set texture unit bindings (these don't change)
    gl.uniform1i(this.uIdMap, 0);
    gl.uniform1i(this.uTerrain, 1);
    gl.uniform1i(this.uHeightmap, 2);
    gl.uniform1i(this.uNormalMap, 3);
    gl.uniform1i(this.uBorders, 4);
    gl.uniform1i(this.uProvinceColors, 5);
  }

  setHoveredProvince(key: string | null): void {
    if (key) {
      const rgb = keyToRgb(key);
      this.hoveredIndex = rgbToIndex(rgb[0], rgb[1], rgb[2]);
    } else {
      this.hoveredIndex = -1;
    }
  }

  setSelectedProvince(key: string | null): void {
    if (key) {
      const rgb = keyToRgb(key);
      this.selectedIndex = rgbToIndex(rgb[0], rgb[1], rgb[2]);
    } else {
      this.selectedIndex = -1;
    }
  }

  render(): void {
    const { gl } = this;

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    // Camera
    gl.uniformMatrix3fv(this.uCameraMatrix, false, this.camera.getMatrix());

    // Sun direction (normalized, from top-left)
    gl.uniform3f(this.uSunDirection, 0.5, 0.8, 0.6);
    gl.uniform1f(this.uAmbientStrength, 0.55);
    gl.uniform1f(this.uPoliticalOpacity, 0.4);

    // Texel size for border detection (dynamic from actual texture dimensions)
    gl.uniform2f(this.uTexelSize, 1.0 / this.textures.mapWidth, 1.0 / this.textures.mapHeight);

    // Interaction state
    gl.uniform1f(this.uHoveredIndex, this.hoveredIndex);
    gl.uniform1f(this.uSelectedIndex, this.selectedIndex);

    // Resolution + map mode
    gl.uniform2f(this.uResolution, gl.canvas.width, gl.canvas.height);
    gl.uniform1i(this.uMapMode, this.mapMode);

    // Bind textures to units
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.idMap);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.terrain);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.heightmap);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.normalMap);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.borders);

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.registry.getLUTTexture());

    // Draw
    gl.bindVertexArray(this.quad.vao);
    gl.drawElements(gl.TRIANGLES, this.quad.indexCount, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }
}
