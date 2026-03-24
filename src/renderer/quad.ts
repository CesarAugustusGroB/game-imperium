export interface QuadMesh {
  vao: WebGLVertexArrayObject;
  indexCount: number;
}

export function createFullScreenQuad(gl: WebGL2RenderingContext): QuadMesh {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('Failed to create VAO');
  gl.bindVertexArray(vao);

  // Positions (xy) + UVs (st)
  const vertices = new Float32Array([
    // x,    y,    u,  v
    -1.0, -1.0,  0.0, 0.0,
     1.0, -1.0,  1.0, 0.0,
     1.0,  1.0,  1.0, 1.0,
    -1.0,  1.0,  0.0, 1.0,
  ]);

  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  // Vertex buffer
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // Position attribute (location 0)
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);

  // UV attribute (location 1)
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);

  // Index buffer
  const ebo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  return { vao, indexCount: 6 };
}
