export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// 3x3 matrix stored as flat array (column-major for WebGL)
export type Mat3 = Float32Array;

export function mat3Identity(): Mat3 {
  return new Float32Array([
    1, 0, 0,
    0, 1, 0,
    0, 0, 1,
  ]);
}

export function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  const out = new Float32Array(9);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 3; row++) {
      out[col * 3 + row] =
        a[0 * 3 + row] * b[col * 3 + 0] +
        a[1 * 3 + row] * b[col * 3 + 1] +
        a[2 * 3 + row] * b[col * 3 + 2];
    }
  }
  return out;
}

export function mat3Translate(tx: number, ty: number): Mat3 {
  return new Float32Array([
    1, 0, 0,
    0, 1, 0,
    tx, ty, 1,
  ]);
}

export function mat3Scale(sx: number, sy: number): Mat3 {
  return new Float32Array([
    sx, 0, 0,
    0, sy, 0,
    0, 0, 1,
  ]);
}
