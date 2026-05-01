// S33-06: pure BFS reveal helper for the Bellum encounter-effects pipeline.
// `revealWithinRadius` is the Bellum equivalent of `applyScoutReveal` in the
// spoke-scouting module — same reference-equality optimization so callers
// can detect no-ops cheaply.

import type { HexTile } from './campaign-types';
import { getHexNeighbors } from '../pixi/hex-math';

/**
 * BFS from origin up to `radius` rings; returns a NEW tile array with
 * `discovered = true` on every reached tile. Tiles outside the radius pass
 * through untouched (reference-equality preserved). When `toLevel` is given,
 * also writes `scoutedLevel` (max with existing level — never lowers).
 *
 * Returns the same array reference when nothing changed (no new discoveries
 * and no `scoutedLevel` change). This lets callers detect no-ops via `===`.
 *
 * If `tiles` is empty or origin missing, returns `tiles` unchanged.
 */
export function revealWithinRadius(
  tiles: readonly HexTile[],
  originId: string,
  radius: number,
  toLevel?: 1 | 2,
): HexTile[] {
  if (tiles.length === 0) return tiles as HexTile[];

  const tileMap = new Map<string, HexTile>();
  for (const t of tiles) tileMap.set(t.id, t);

  const origin = tileMap.get(originId);
  if (!origin) return tiles as HexTile[];

  // BFS — visited set keyed by tile id, depth-bounded at radius.
  const visited = new Set<string>();
  // queue entries: [tileId, depth]
  const queue: Array<[string, number]> = [[originId, 0]];
  visited.add(originId);

  const reached: HexTile[] = [];
  while (queue.length > 0) {
    const [currentId, depth] = queue.shift()!;
    const current = tileMap.get(currentId);
    if (!current) continue;
    reached.push(current);

    if (depth < radius) {
      for (const neighbor of getHexNeighbors(current, tiles as HexTile[])) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push([neighbor.id, depth + 1]);
        }
      }
    }
  }

  // Check if anything actually needs changing.
  let hasChange = false;
  for (const t of reached) {
    if (!t.discovered) {
      hasChange = true;
      break;
    }
    if (toLevel !== undefined) {
      const existing = t.scoutedLevel ?? 0;
      if (toLevel > existing) {
        hasChange = true;
        break;
      }
    }
  }

  if (!hasChange) return tiles as HexTile[];

  const reachedIds = new Set(reached.map((t) => t.id));
  return (tiles as HexTile[]).map((t) => {
    if (!reachedIds.has(t.id)) return t;

    let changed = false;
    let next = t;

    if (!t.discovered) {
      next = { ...next, discovered: true };
      changed = true;
    }

    if (toLevel !== undefined) {
      const existing = t.scoutedLevel ?? 0;
      if (toLevel > existing) {
        next = { ...next, scoutedLevel: toLevel };
        changed = true;
      }
    }

    return changed ? next : t;
  });
}
