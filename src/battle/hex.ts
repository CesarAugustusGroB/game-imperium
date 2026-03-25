export interface Hex {
  q: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

export const HEX_SIZE = 40;

const SQRT3 = Math.sqrt(3);

// Pointy-top hex directions (axial coordinates)
const HEX_DIRS: ReadonlyArray<Hex> = [
  { q: 1, r: 0 },  { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

// ── Coordinate conversions (pointy-top) ──

export function hexToPixel(hex: Hex, size: number, origin: Point): Point {
  return {
    x: size * (SQRT3 * hex.q + SQRT3 / 2 * hex.r) + origin.x,
    y: size * (3 / 2 * hex.r) + origin.y,
  };
}

export function pixelToHex(px: number, py: number, size: number, origin: Point): Hex {
  const x = px - origin.x;
  const y = py - origin.y;
  const q = (SQRT3 / 3 * x - 1 / 3 * y) / size;
  const r = (2 / 3 * y) / size;
  return hexRound(q, r);
}

export function hexRound(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) {
    q = -r - s;
  } else if (dr > ds) {
    r = -q - s;
  }
  return { q, r };
}

// ── Grid helpers ──

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function hexEqual(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r;
}

export function hexDistance(a: Hex, b: Hex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function hexNeighbors(hex: Hex): Hex[] {
  return HEX_DIRS.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

// ── Drawing helpers ──

export function hexCorners(center: Point, size: number): Point[] {
  const corners: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i + 30; // +30° offset for pointy-top
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    });
  }
  return corners;
}

// ── Grid generation (pointy-top offset "even-r") ──

export function offsetToAxial(col: number, row: number): Hex {
  const q = col - Math.floor(row / 2);
  const r = row;
  return { q, r };
}
