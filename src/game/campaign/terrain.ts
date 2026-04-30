// S30-04: pure terrain rules — movement cost, blocked check, palette.
// Hex literals match the guide's palette so PixiJS draws muted Roman tones,
// not arcade primaries. No Pixi imports here — this stays a data module.

import type { TerrainType } from './campaign-types';

export function getMovementCost(terrain: TerrainType): number {
  // Every walkable hex costs 1 MP — one move = one month. Terrain difficulty
  // is expressed through supplies/morale (consumeBellumTraversal), not time.
  // Mountains stay 999 as a pathfinding sentinel for impassable terrain.
  if (terrain === 'mountains') return 999;
  return 1;
}

export function isBlockedTerrain(terrain: TerrainType): boolean {
  return terrain === 'mountains';
}

export function getTerrainColor(terrain: TerrainType): number {
  switch (terrain) {
    case 'plains':
      return 0x6b6f32;
    case 'forest':
      return 0x1f4a24;
    case 'hills':
      return 0x7a5b32;
    case 'mountains':
      return 0x77706a;
    case 'river':
      return 0x1e5d7a;
    case 'road':
      return 0x9b7a45;
    case 'camp':
      return 0x284f35;
    case 'ruins':
      return 0x5a5046;
    default:
      return 0x333333;
  }
}
