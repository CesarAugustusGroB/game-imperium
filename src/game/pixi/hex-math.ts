// Pointy-top axial hex coordinates (q, r). No Pixi imports.
// Single source of truth for hex geometry across the campaign map.

export type HexCoord = {
  q: number;
  r: number;
};

export const HEX_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
] as const;

export function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  return {
    x: size * Math.sqrt(3) * (q + r / 2),
    y: size * 1.5 * r,
  };
}

export function getHexId(q: number, r: number): string {
  return `${q},${r}`;
}

export function getHexNeighbors<T extends HexCoord>(tile: T, tiles: readonly T[]): T[] {
  const out: T[] = [];
  for (const dir of HEX_DIRECTIONS) {
    const q = tile.q + dir.q;
    const r = tile.r + dir.r;
    const found = tiles.find((candidate) => candidate.q === q && candidate.r === r);
    if (found) out.push(found);
  }
  return out;
}
