/**
 * Composable movement primitives for battle AI.
 *
 * Each primitive is a pure function: (state, unit, ctx) → Hex | null
 * They answer "where should this unit go?" without looping, attacking, or resetting cooldowns.
 *
 * The `resolveMovement` loop handles the shared boilerplate (canAct, pinned, attack adjacent).
 * Combinators (`whenEngaged`, `fallback`) compose primitives into complex behaviors.
 */

import type { BattleState } from './battle-state';
import type { BattleUnit } from './battle-types';
import type { Hex } from './hex';
import { hexDistance, hexNeighbors, offsetToAxialFlatTop } from './hex';

// ── Types ──

export interface MoveContext {
  dir: number;       // +1 or -1 advance direction
  vertical: boolean;
  rows: number;      // grid rows (for zone calculation)
  cols: number;      // grid cols
}

export type MovementFn = (state: BattleState, unit: BattleUnit, ctx: MoveContext) => Hex | null;

// ── Shared helpers ──

/** Pick the weakest unit (lowest HP). */
export function pickWeakest(units: BattleUnit[]): BattleUnit {
  return units.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

/** If unit is pinned, it can only attack its pinner. Returns true if pinned (handled). */
export function handlePinned(state: BattleState, unit: BattleUnit): boolean {
  if (unit.pinnedBy === null) return false;

  const pinner = state.units.get(unit.pinnedBy);
  if (!pinner || pinner.isDying) {
    unit.pinnedBy = null;
    return false;
  }

  const enemies = state.getAdjacentEnemies(unit);
  const pinnerAdjacent = enemies.find(e => e.id === unit.pinnedBy);
  if (pinnerAdjacent) {
    state.resolveCombat(unit, pinnerAdjacent);
    state.resetCooldown(unit);
  }
  return true;
}

/** Find the nearest empty hex adjacent to a target unit. */
export function findInterceptHex(state: BattleState, chaser: BattleUnit, target: BattleUnit): Hex | null {
  let bestHex: Hex | null = null;
  let bestDist = Infinity;
  for (const nb of hexNeighbors(target.hex)) {
    if (!state.isValidHex(nb)) continue;
    if (state.getUnitAt(nb)) continue;
    const d = hexDistance(chaser.hex, nb);
    if (d < bestDist) { bestDist = d; bestHex = nb; }
  }
  return bestHex;
}

/** Find the closest target by hex distance. */
export function findClosestTo(unit: BattleUnit, targets: BattleUnit[]): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const d = hexDistance(unit.hex, t.hex);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

/** Check if a unit is in the enemy's zone (top third for blue, bottom third for red). */
export function isInEnemyZone(state: BattleState, unit: BattleUnit): boolean {
  if (!state.config.vertical) return false;
  const offsetRow = unit.hex.r + Math.floor(unit.hex.q / 2);
  const zoneRows = Math.floor(state.config.rows / 3);
  if (unit.faction === 'blue') return offsetRow < zoneRows;
  return offsetRow >= zoneRows * 2;
}

/** Move forward only — reject backward movement. Returns the target hex or null. */
export function validateForward(unit: BattleUnit, target: Hex, dir: number, vertical: boolean): Hex | null {
  if (vertical) {
    const unitRow = unit.hex.r + Math.floor(unit.hex.q / 2);
    const targetRow = target.r + Math.floor(target.q / 2);
    if ((targetRow - unitRow) * dir < 0) return null;
  } else {
    if ((target.q - unit.hex.q) * dir < 0) return null;
  }
  return target;
}

/** Find the best hex to advance forward (with diagonal fallback). */
export function findAdvanceTarget(
  state: BattleState, unit: BattleUnit, dir: number, maxSteps: number, vertical: boolean,
): Hex | null {
  if (vertical) {
    const col = unit.hex.q;
    let row = unit.hex.r + Math.floor(unit.hex.q / 2);
    const startRow = row;

    for (let s = 0; s < maxSteps; s++) {
      const nextRow = row + dir;
      const next = offsetToAxialFlatTop(col, nextRow);
      if (!state.isValidHex(next)) break;
      if (state.getUnitAt(next)) break;
      row = nextRow;
    }

    if (row !== startRow) {
      return offsetToAxialFlatTop(col, row);
    }

    // Blocked — try diagonal
    for (const colOff of [-1, 1]) {
      const diagHex = offsetToAxialFlatTop(col + colOff, startRow + dir);
      if (state.isValidHex(diagHex) && !state.getUnitAt(diagHex)) {
        return diagHex;
      }
    }
    return null;
  }

  // Horizontal mode
  let target: Hex = { q: unit.hex.q, r: unit.hex.r };
  for (let s = 0; s < maxSteps; s++) {
    const next: Hex = { q: target.q + dir, r: target.r };
    if (!state.isValidHex(next)) break;
    if (state.getUnitAt(next)) break;
    target = next;
  }

  if (target.q === unit.hex.q && target.r === unit.hex.r) {
    for (const rOffset of [-1, 1]) {
      const diag: Hex = { q: unit.hex.q + dir, r: unit.hex.r + rOffset };
      if (state.isValidHex(diag) && !state.getUnitAt(diag)) {
        return diag;
      }
    }
    return null;
  }
  return target;
}

/** Validate forward direction and move. Used by capture-mode AI. */
export function moveForward(state: BattleState, unitId: number, target: Hex, dir: number, vertical: boolean): boolean {
  const unit = state.units.get(unitId);
  if (!unit) return false;
  if (!validateForward(unit, target, dir, vertical)) return false;
  return state.moveUnitAlongPath(unitId, target);
}

// ── Movement primitives ──

/** March straight forward up to 3 steps. */
export function forward(state: BattleState, unit: BattleUnit, ctx: MoveContext): Hex | null {
  const target = findAdvanceTarget(state, unit, ctx.dir, 3, ctx.vertical);
  if (!target) return null;
  return validateForward(unit, target, ctx.dir, ctx.vertical);
}

/** Chase the nearest enemy — no direction restriction. */
export function greedy(state: BattleState, unit: BattleUnit, _ctx: MoveContext): Hex | null {
  const nearest = state.findNearestEnemy(unit);
  if (!nearest) return null;
  return findInterceptHex(state, unit, nearest);
}

/** Stay in place. */
export function hold(_state: BattleState, _unit: BattleUnit, _ctx: MoveContext): null {
  return null;
}

/** Retreat one step backward. */
export function retreat(state: BattleState, unit: BattleUnit, ctx: MoveContext): Hex | null {
  if (ctx.vertical) {
    const col = unit.hex.q;
    const row = unit.hex.r + Math.floor(unit.hex.q / 2);
    const hex = offsetToAxialFlatTop(col, row - ctx.dir);
    if (state.isValidHex(hex) && !state.getUnitAt(hex)) return hex;
    return null;
  }
  for (const neighbor of hexNeighbors(unit.hex)) {
    if ((neighbor.q - unit.hex.q) * ctx.dir < 0 && state.isValidHex(neighbor) && !state.getUnitAt(neighbor)) {
      return neighbor;
    }
  }
  return null;
}

// ── Combinators ──

/** Switch from `before` to `after` when the unit has engaged or entered the enemy zone.
 *  Entering the enemy zone permanently flips `hasEngaged` so the unit stays greedy. */
export function whenEngaged(before: MovementFn, after: MovementFn): MovementFn {
  return (state, unit, ctx) => {
    if (!unit.hasEngaged && isInEnemyZone(state, unit)) {
      unit.hasEngaged = true;
    }
    return unit.hasEngaged ? after(state, unit, ctx) : before(state, unit, ctx);
  };
}

/** Try `primary`; if it returns null, try `secondary`. */
export function fallback(primary: MovementFn, secondary: MovementFn): MovementFn {
  return (state, unit, ctx) => {
    return primary(state, unit, ctx) ?? secondary(state, unit, ctx);
  };
}

// ── Movement resolver (the shared loop) ──

/**
 * Process a list of units with a given movement function.
 * Handles the shared boilerplate: canAct, pinned, attack adjacent, move, cooldown.
 */
export function resolveMovement(
  state: BattleState,
  units: BattleUnit[],
  moveFn: MovementFn,
  ctx: MoveContext,
): void {
  for (const unit of units) {
    if (!state.canAct(unit)) continue;
    if (handlePinned(state, unit)) continue;

    // Always attack adjacent enemies first
    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      state.resolveCombat(unit, pickWeakest(enemies));
      state.resetCooldown(unit);
      continue;
    }

    const target = moveFn(state, unit, ctx);
    if (target) {
      state.moveUnitAlongPath(unit.id, target);
    }
    state.resetCooldown(unit);
  }
}
