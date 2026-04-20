/**
 * grid-system — hex grid geometry, validation, and pathfinding.
 *
 * Pure stateless functions operating on a `BattleWorld`. The only writes to
 * the world are `generateGrid` which populates `world.grid` and `world.gridHexes`.
 */

import type { BattleWorld } from '../core/BattleWorld';
import type { Hex, Point } from '../hex';
import { hexKey, hexNeighbors, hexToPixel, offsetToAxial, offsetToAxialFlatTop } from '../hex';
import { MOVE_RANGE } from '../battle-config';
import { getUnitAt } from './unit-system';

/** Populate `world.grid` and `world.gridHexes` from the config's cols/rows. */
export function generateGrid(world: BattleWorld): void {
  world.grid.clear();
  world.gridHexes.length = 0;
  const flatTop = !!world.config.vertical;
  for (let col = 0; col < world.config.cols; col++) {
    for (let row = 0; row < world.config.rows; row++) {
      if (!flatTop) {
        // Pointy-top: skip col 0 even rows (jagged left edge)
        if (col === 0 && row % 2 === 0) continue;
      }
      const hex = flatTop ? offsetToAxialFlatTop(col, row) : offsetToAxial(col, row);
      const key = hexKey(hex.q, hex.r);
      if (!world.grid.has(key)) {
        world.grid.add(key);
        world.gridHexes.push(hex);
      }
    }
  }
}

/** True if `hex` is a cell on this battlefield. */
export function isValidHex(world: BattleWorld, hex: Hex): boolean {
  return world.grid.has(hexKey(hex.q, hex.r));
}

/** Compute canvas-centered origin point for the grid. */
export function getGridOrigin(world: BattleWorld, canvasW: number, canvasH: number): Point {
  const s = world.config.hexSize;
  const flatTop = !!world.config.vertical;

  const zero = { x: 0, y: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const hex of world.gridHexes) {
    const p = hexToPixel(hex, s, zero, flatTop);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const pad = s;
  const totalW = (maxX - minX) + pad * 2;
  const totalH = (maxY - minY) + pad * 2;

  return {
    x: (canvasW - totalW) / 2 + pad - minX,
    y: (canvasH - totalH) / 2 + pad - minY,
  };
}

/** BFS flood-fill: all empty hexes reachable within `maxSteps`. */
export function getReachableHexes(world: BattleWorld, from: Hex, maxSteps: number): Hex[] {
  const result: Hex[] = [];
  const visited = new Set<string>();
  const queue: { hex: Hex; dist: number }[] = [{ hex: from, dist: 0 }];
  visited.add(hexKey(from.q, from.r));

  while (queue.length > 0) {
    const { hex: current, dist } = queue.shift()!;
    if (dist > 0) result.push(current);
    if (dist >= maxSteps) continue;

    for (const nb of hexNeighbors(current)) {
      const key = hexKey(nb.q, nb.r);
      if (visited.has(key)) continue;
      if (!isValidHex(world, nb)) continue;
      if (getUnitAt(world, nb)) continue;
      visited.add(key);
      queue.push({ hex: nb, dist: dist + 1 });
    }
  }
  return result;
}

/** All hexes reachable within `MOVE_RANGE` from `hex`. */
export function getMovementRange(world: BattleWorld, hex: Hex): Hex[] {
  return getReachableHexes(world, hex, MOVE_RANGE);
}

/** BFS shortest path from `-> to`, avoiding occupied hexes (except destination). */
export function findPath(world: BattleWorld, from: Hex, to: Hex): Hex[] | null {
  const fromKey = hexKey(from.q, from.r);
  const toKey = hexKey(to.q, to.r);
  if (fromKey === toKey) return [from];

  const visited = new Set<string>();
  const parent = new Map<string, string>();
  const hexMap = new Map<string, Hex>();
  const queue: Hex[] = [from];
  visited.add(fromKey);
  hexMap.set(fromKey, from);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const curKey = hexKey(current.q, current.r);

    if (curKey === toKey) {
      const path: Hex[] = [];
      let key = toKey;
      while (key !== fromKey) {
        path.unshift(hexMap.get(key)!);
        key = parent.get(key)!;
      }
      path.unshift(from);
      return path;
    }

    for (const nb of hexNeighbors(current)) {
      const nbKey = hexKey(nb.q, nb.r);
      if (visited.has(nbKey)) continue;
      if (!isValidHex(world, nb)) continue;
      const occupant = getUnitAt(world, nb);
      if (occupant && nbKey !== toKey) continue;
      visited.add(nbKey);
      parent.set(nbKey, curKey);
      hexMap.set(nbKey, nb);
      queue.push(nb);
    }
  }
  return null;
}

/** First step on the shortest path from `from` to `to`. */
export function findStepToward(world: BattleWorld, from: Hex, to: Hex): Hex | null {
  const path = findPath(world, from, to);
  if (!path || path.length < 2) return null;
  return path[1];
}
