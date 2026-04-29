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

  const value = Math.abs(q * 23 + r * 41) % 100;

  if (value < 15) return 'battle';
  if (value < 25) return 'supply';
  if (value < 35) return 'ambush';
  if (value < 42) return 'merchant';
  if (value < 48) return 'story';

  return 'none';
}
