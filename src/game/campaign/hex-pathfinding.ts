import type { HexTile } from './campaign-types';
import type { HexCoord } from '../pixi/hex-math';
import { getHexNeighbors } from '../pixi/hex-math';
import { isBlockedTerrain } from './terrain';

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

function isWall(tile: HexTile): boolean {
  return isBlockedTerrain(tile.terrain) || !tile.discovered;
}

export function reachableSet(
  start: HexTile,
  tiles: HexTile[],
  mpBudget: number,
): Map<string, number> {
  const tileById = new Map<string, HexTile>();
  for (const t of tiles) tileById.set(t.id, t);

  const dist = new Map<string, number>();
  dist.set(start.id, 0);

  // Sorted-array priority queue: [id, cost]
  const queue: [string, number][] = [[start.id, 0]];

  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i][1] < queue[minIdx][1]) minIdx = i;
    }
    const [currentId, currentCost] = queue[minIdx];
    queue.splice(minIdx, 1);

    if (currentCost > (dist.get(currentId) ?? Infinity)) continue;

    const current = tileById.get(currentId);
    if (!current) continue;

    for (const neighbor of getHexNeighbors(current, tiles)) {
      if (isWall(neighbor)) continue;

      const newCost = currentCost + neighbor.movementCost;
      if (newCost > mpBudget) continue;

      const best = dist.get(neighbor.id) ?? Infinity;
      if (newCost < best) {
        dist.set(neighbor.id, newCost);
        queue.push([neighbor.id, newCost]);
      }
    }
  }

  return dist;
}

export function findPath(
  start: HexTile,
  goal: HexTile,
  tiles: HexTile[],
  mpBudget: number,
): HexTile[] | null {
  const tileById = new Map<string, HexTile>();
  for (const t of tiles) tileById.set(t.id, t);

  if (!tileById.has(goal.id)) return null;
  if (isWall(goal)) return null;

  const dist = new Map<string, number>();
  dist.set(start.id, 0);

  const prev = new Map<string, string>();

  // Sorted-array priority queue: [id, f-score]
  const queue: [string, number][] = [[start.id, hexDistance(start, goal)]];

  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i][1] < queue[minIdx][1]) minIdx = i;
    }
    const [currentId] = queue[minIdx];
    queue.splice(minIdx, 1);

    if (currentId === goal.id) {
      const path: HexTile[] = [];
      let id: string | undefined = goal.id;
      while (id !== undefined) {
        const tile = tileById.get(id);
        if (tile) path.unshift(tile);
        id = prev.get(id);
      }
      return path;
    }

    const currentCost = dist.get(currentId) ?? Infinity;
    const current = tileById.get(currentId);
    if (!current) continue;

    for (const neighbor of getHexNeighbors(current, tiles)) {
      if (isWall(neighbor)) continue;

      const newCost = currentCost + neighbor.movementCost;
      if (newCost > mpBudget) continue;

      const best = dist.get(neighbor.id) ?? Infinity;
      if (newCost < best) {
        dist.set(neighbor.id, newCost);
        prev.set(neighbor.id, currentId);
        const f = newCost + hexDistance(neighbor, goal);
        queue.push([neighbor.id, f]);
      }
    }
  }

  return null;
}
