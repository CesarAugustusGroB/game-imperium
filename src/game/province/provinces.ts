import type { GameState } from '../core/state';
import { createDataTexture } from '../../renderer/textures';
import { rgbToIndex } from '../../utils/color';

export class ProvinceRegistry {
  private gl: WebGL2RenderingContext;
  private gameState: GameState;
  private lutTexture: WebGLTexture | null = null;
  private lutData: Uint8Array;
  private lutWidth: number;

  constructor(gl: WebGL2RenderingContext, gameState: GameState) {
    this.gl = gl;
    this.gameState = gameState;
    // Support up to 4096 provinces in the LUT texture
    this.lutWidth = 4096;
    this.lutData = new Uint8Array(this.lutWidth * 4);
  }

  buildLUT(): void {
    // Clear LUT
    this.lutData.fill(0);

    // Fill in nation colors for each province
    for (const [, province] of this.gameState.provinces) {
      const nation = this.gameState.nations.get(province.owner);
      if (!nation) continue;

      const index = rgbToIndex(province.color[0], province.color[1], province.color[2]);
      if (index >= this.lutWidth) continue;

      const offset = index * 4;
      this.lutData[offset + 0] = nation.color[0];
      this.lutData[offset + 1] = nation.color[1];
      this.lutData[offset + 2] = nation.color[2];
      this.lutData[offset + 3] = 255; // Alpha = owned
    }

    // Upload to GPU
    if (this.lutTexture) {
      this.gl.deleteTexture(this.lutTexture);
    }
    this.lutTexture = createDataTexture(this.gl, this.lutData, this.lutWidth);
  }

  updateProvince(provinceKey: string): void {
    const province = this.gameState.getProvince(provinceKey);
    if (!province) return;

    const nation = this.gameState.nations.get(province.owner);
    if (!nation) return;

    const index = rgbToIndex(province.color[0], province.color[1], province.color[2]);
    if (index >= this.lutWidth) return;

    const offset = index * 4;
    this.lutData[offset + 0] = nation.color[0];
    this.lutData[offset + 1] = nation.color[1];
    this.lutData[offset + 2] = nation.color[2];
    this.lutData[offset + 3] = 255;

    // Partial GPU update
    if (this.lutTexture) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.lutTexture);
      const pixel = new Uint8Array(this.lutData.buffer, offset, 4);
      this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, index, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel);
    }
  }

  getLUTTexture(): WebGLTexture {
    if (!this.lutTexture) throw new Error('LUT texture not built');
    return this.lutTexture;
  }

  getProvinceByKey(key: string) {
    return this.gameState.getProvince(key);
  }
}
