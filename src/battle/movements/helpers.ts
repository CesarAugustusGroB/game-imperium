/**
 * Shared helpers used by primitives + resolver.
 *
 * Small pure utilities — no movement logic of their own. Movement behavior
 * lives in `./primitives`; combining logic lives in `./combinators`.
 */

import type { BattleEngine } from '../core/BattleEngine';
import type { BattleUnit } from '../battle-types';
import type { Hex } from '../hex';
import { hexDistance, hexNeighbors, offsetToAxialFlatTop } from '../hex';

// ── Target selection ──

/** Pick the weakest unit (lowest HP). */
export function pickWeakest(units: BattleUnit[]): BattleUnit {
  return units.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

/** Find the closest target by hex distance. */
export function findClosestTo(unit: BattleUnit, targets: BattleUnit[]): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    if (t.isDying) continue;
    const d = hexDistance(unit.hex, t.hex);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

/** Find the nearest empty hex adjacent to a target unit. */
export function findInterceptHex(
  engine: BattleEngine,
  chaser: BattleUnit,
  target: BattleUnit,
): Hex | null {
  let bestHex: Hex | null = null;
  let bestDist = Infinity;
  for (const nb of hexNeighbors(target.hex)) {
    if (!engine.isValidHex(nb)) continue;
    if (engine.getUnitAt(nb)) continue;
    const d = hexDistance(chaser.hex, nb);
    if (d < bestDist) { bestDist = d; bestHex = nb; }
  }
  return bestHex;
}

// ── Pin handling ──

/** If unit is pinned, it can only attack its pinner. Returns true if handled. */
export function handlePinned(engine: BattleEngine, unit: BattleUnit): boolean {
  if (unit.pinnedBy === null) return false;

  const pinner = engine.units.get(unit.pinnedBy);
  if (!pinner || pinner.isDying) {
    unit.pinnedBy = null;
    return false;
  }

  const enemies = engine.getAdjacentEnemies(unit);
  const pinnerAdjacent = enemies.find(e => e.id === unit.pinnedBy);
  if (pinnerAdjacent) {
    engine.resolveCombat(unit, pinnerAdjacent);
    engine.resetCooldown(unit);
  }
  return true;
}

// ── Zone queries ──

/** True if the unit has crossed into the enemy's third of the battlefield. */
export function isInEnemyZone(engine: BattleEngine, unit: BattleUnit): boolean {
  if (!engine.config.vertical) return false;
  const offsetRow = unit.hex.r + Math.floor(unit.hex.q / 2);
  const zoneRows = Math.floor(engine.config.rows / 3);
  if (unit.faction === 'blue') return offsetRow < zoneRows;
  return offsetRow >= zoneRows * 2;
}

/** True if the unit is still inside its own third of the battlefield. */
export function isInOwnZone(engine: BattleEngine, unit: BattleUnit): boolean {
  if (!engine.config.vertical) return false;
  const offsetRow = unit.hex.r + Math.floor(unit.hex.q / 2);
  const zoneRows = Math.floor(engine.config.rows / 3);
  if (unit.faction === 'blue') return offsetRow >= zoneRows * 2;
  return offsetRow < zoneRows;
}

// ── Forward-motion helpers ──

/** Reject a target that would send the unit backward relative to `dir`. */
export function validateForward(
  unit: BattleUnit, target: Hex, dir: number, vertical: boolean,
): Hex | null {
  if (vertical) {
    const unitRow = unit.hex.r + Math.floor(unit.hex.q / 2);
    const targetRow = target.r + Math.floor(target.q / 2);
    if ((targetRow - unitRow) * dir < 0) return null;
  } else {
    if ((target.q - unit.hex.q) * dir < 0) return null;
  }
  return target;
}

/** Find the best hex to advance forward up to `maxSteps`, with diagonal fallback. */
export function findAdvanceTarget(
  engine: BattleEngine,
  unit: BattleUnit,
  dir: number,
  maxSteps: number,
  vertical: boolean,
): Hex | null {
  if (vertical) {
    const col = unit.hex.q;
    let row = unit.hex.r + Math.floor(unit.hex.q / 2);
    const startRow = row;

    for (let s = 0; s < maxSteps; s++) {
      const nextRow = row + dir;
      const next = offsetToAxialFlatTop(col, nextRow);
      if (!engine.isValidHex(next)) break;
      if (engine.getUnitAt(next)) break;
      row = nextRow;
    }

    if (row !== startRow) {
      return offsetToAxialFlatTop(col, row);
    }

    // Blocked — try diagonal
    for (const colOff of [-1, 1]) {
      const diagHex = offsetToAxialFlatTop(col + colOff, startRow + dir);
      if (engine.isValidHex(diagHex) && !engine.getUnitAt(diagHex)) {
        return diagHex;
      }
    }
    return null;
  }

  // Horizontal mode
  let target: Hex = { q: unit.hex.q, r: unit.hex.r };
  for (let s = 0; s < maxSteps; s++) {
    const next: Hex = { q: target.q + dir, r: target.r };
    if (!engine.isValidHex(next)) break;
    if (engine.getUnitAt(next)) break;
    target = next;
  }

  if (target.q === unit.hex.q && target.r === unit.hex.r) {
    for (const rOffset of [-1, 1]) {
      const diag: Hex = { q: unit.hex.q + dir, r: unit.hex.r + rOffset };
      if (engine.isValidHex(diag) && !engine.getUnitAt(diag)) {
        return diag;
      }
    }
    return null;
  }
  return target;
}

/** Validate forward direction and move. Used by capture-mode vanguard AI. */
export function moveForward(
  engine: BattleEngine, unitId: number, target: Hex, dir: number, vertical: boolean,
): boolean {
  const unit = engine.units.get(unitId);
  if (!unit) return false;
  if (!validateForward(unit, target, dir, vertical)) return false;
  return engine.moveUnitAlongPath(unitId, target);
}

/** Find an empty hex one step backward (opposite of dir). */
export function findRetreatHex(
  engine: BattleEngine, unit: BattleUnit, dir: number, vertical: boolean,
): Hex | null {
  if (vertical) {
    const col = unit.hex.q;
    const row = unit.hex.r + Math.floor(unit.hex.q / 2);
    const hex = offsetToAxialFlatTop(col, row - dir);
    if (engine.isValidHex(hex) && !engine.getUnitAt(hex)) return hex;
    return null;
  }
  for (const neighbor of hexNeighbors(unit.hex)) {
    if ((neighbor.q - unit.hex.q) * dir < 0 && engine.isValidHex(neighbor) && !engine.getUnitAt(neighbor)) {
      return neighbor;
    }
  }
  return null;
}
