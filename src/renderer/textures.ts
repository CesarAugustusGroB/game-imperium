import type { MapTextures } from '../types/index';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function createTexture(
  gl: WebGL2RenderingContext,
  image: HTMLImageElement,
  nearest: boolean = false,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create texture');

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  const filter = nearest ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}

export async function loadAllTextures(gl: WebGL2RenderingContext): Promise<MapTextures> {
  const [idMapImg, terrainImg, heightmapImg, normalMapImg, bordersImg] = await Promise.all([
    loadImage('/textures/id-map.png'),
    loadImage('/textures/terrain_map.png'),
    loadImage('/textures/heightmap.png'),
    loadImage('/textures/normalmap.png'),
    loadImage('/textures/borders.png'),
  ]);

  return {
    idMap: createTexture(gl, idMapImg, true),       // NEAREST — exact color preservation
    terrain: createTexture(gl, terrainImg),           // LINEAR
    heightmap: createTexture(gl, heightmapImg),       // LINEAR
    normalMap: createTexture(gl, normalMapImg),       // LINEAR
    borders: createTexture(gl, bordersImg),           // LINEAR
    mapWidth: idMapImg.naturalWidth,
    mapHeight: idMapImg.naturalHeight,
  };
}

export function createDataTexture(
  gl: WebGL2RenderingContext,
  data: Uint8Array,
  width: number,
): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error('Failed to create data texture');

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}

export function updateDataTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  data: Uint8Array,
  offset: number,
): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, offset, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
}
