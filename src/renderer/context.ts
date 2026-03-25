export function createWebGL2Context(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });

  if (!gl) {
    throw new Error('WebGL2 is not supported in this browser');
  }

  gl.clearColor(0.06, 0.06, 0.12, 1.0);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  return gl;
}

export function resizeViewport(gl: WebGL2RenderingContext, width: number, height: number): void {
  gl.viewport(0, 0, width, height);
}
