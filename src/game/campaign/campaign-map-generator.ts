// S30-05: deterministic procedural hex map generator.
// Stand-in until later sprints introduce handcrafted campaign maps.
// Pure: no signals, no Pixi — feeds HexTile[] into setTiles() (S30-03)
// and HexMapView (S30-07).

import type { EventType, HexTile, TerrainType } from './campaign-types';
import { getHexId } from '../pixi/hex-math';
import { getMovementCost } from './terrain';

export function generateCampaignMap(radius = 5): HexTile[] {
  const tiles: HexTile[] = [];

  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      // Cube-coord check: skip cells outside the hexagonal radius.
      const s = -q - r;
      if (Math.abs(s) > radius) continue;

      const terrain = generateTerrain(q, r);
      const event = generateEvent(q, r, terrain);
      const isStart = q === 0 && r === 0;

      tiles.push({
        id: getHexId(q, r),
        q,
        r,
        terrain,
        event: isStart ? 'rest' : event,
        discovered: isStart,
        visited: isStart,
        reachable: false,
        current: isStart,
        movementCost: getMovementCost(terrain),
      });
    }
  }

  return tiles;
}

function generateTerrain(q: number, r: number): TerrainType {
  if (q === 0 && r === 0) return 'camp';

  const value = Math.abs(q * 17 + r * 31) % 100;

  if (value < 20) return 'forest';
  if (value < 35) return 'hills';
  if (value < 45) return 'mountains';
  if (value < 55) return 'river';
  if (value < 65) return 'road';

  return 'plains';
}

function generateEvent(q: number, r: number, terrain: TerrainType): EventType {
  if (terrain === 'mountains') return 'none';

  // Deterministic 0..99 hash, same RNG idiom as before
  const value = Math.abs(q * 23 + r * 41) % 100;

  // Terrain-biased event selection. Ranges are non-overlapping so each tile
  // resolves to exactly one event type. The total active-event budget is
  // ~55–60% across the map; the rest is `none`.
  switch (terrain) {
    case 'hills':
      // Vantage points → scout-heavy, fewer ambush
      if (value < 6)  return 'battle';
      if (value < 11) return 'supply';
      if (value < 16) return 'ambush';
      if (value < 22) return 'merchant';
      if (value < 27) return 'story';
      if (value < 30) return 'elite';
      if (value < 42) return 'scout';   // +12% scout
      if (value < 47) return 'recruit';
      if (value < 50) return 'hazard';
      return 'none';

    case 'ruins':
      // Old battlefields → hazard + ambush bias, no recruit
      if (value < 12) return 'battle';
      if (value < 18) return 'supply';
      if (value < 28) return 'ambush';
      if (value < 33) return 'merchant';
      if (value < 38) return 'story';
      if (value < 41) return 'elite';
      if (value < 45) return 'scout';
      if (value < 58) return 'hazard';  // +13% hazard
      return 'none';

    case 'river':
      // Crossings → hazard + supply bias
      if (value < 12) return 'battle';
      if (value < 22) return 'supply';
      if (value < 28) return 'ambush';
      if (value < 33) return 'merchant';
      if (value < 38) return 'story';
      if (value < 50) return 'hazard';  // +12% hazard
      return 'none';

    case 'forest':
      // Hostile woods → ambush-heavy, scout useful
      if (value < 10) return 'battle';
      if (value < 16) return 'supply';
      if (value < 30) return 'ambush';  // +14% ambush
      if (value < 35) return 'merchant';
      if (value < 40) return 'story';
      if (value < 43) return 'elite';
      if (value < 50) return 'scout';
      if (value < 53) return 'recruit';
      return 'none';

    case 'plains':
    case 'road':
      // Open ground / paved road → recruit + merchant friendly
      if (value < 12) return 'battle';
      if (value < 22) return 'supply';
      if (value < 28) return 'ambush';
      if (value < 36) return 'merchant';  // +6%
      if (value < 41) return 'story';
      if (value < 44) return 'elite';
      if (value < 48) return 'scout';
      if (value < 60) return 'recruit';   // +12% recruit
      return 'none';

    case 'camp':
      // Friendly camps shouldn't randomly fire bad events; the start tile
      // is forced to 'rest' by the caller, so this branch only matters for
      // any future generated camp tiles.
      if (value < 5)  return 'merchant';
      if (value < 10) return 'recruit';
      return 'none';

    default:
      return 'none';
  }
}
