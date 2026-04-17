import type { BattleState } from './battle-state';
import type { BattleFaction, BattleUnit } from './battle-types';
import type { Hex } from './hex';
import { hexNeighbors, offsetToAxialFlatTop } from './hex';
import { depthOf } from './battle-zones';
import {
  resolveMovement, whenEngaged, forward, greedy,
  pickWeakest, handlePinned, findInterceptHex, findClosestTo,
  findAdvanceTarget, moveForward,
  type MoveContext,
} from './movements';

/**
 * Football-style zonal battle AI.
 *
 * VANGUARD — always march forward; pathfind to star in enemy camp
 * GUARD — stationary; only attack adjacent enemies
 * RESERVE — hold position; intercept enemies in reserve zone (busy state);
 *           become vanguard when no enemy vanguard remains
 *
 * Supports both horizontal (left/right) and vertical (top/bottom) orientation
 * via `state.config.vertical`.
 */

// ── Reserve busy state (AI-local, not on BattleUnit) ──

const busyTargets = new Map<number, number>(); // reserveUnitId → enemyUnitId

// ── Pre-computed per-tick context ──

interface TickContext {
  dir: number;
  vertical: boolean;
  ownStar: Hex;
  enemyStar: Hex;
  cols: number;
  rows: number;
  faction: BattleFaction;
  enemyBattleFaction: BattleFaction;
  allEnemies: BattleUnit[];
}

// ── Entry point ──

export function tickAI(state: BattleState, faction: BattleFaction): void {
  if (state.config.victoryMode === 'capture') {
    tickCapture(state, faction);
  } else {
    tickLegacy(state, faction);
  }
}

// ── Capture Mode AI ──

function tickCapture(state: BattleState, faction: BattleFaction): void {
  const units = state.getBattleFactionUnits(faction);
  if (units.length === 0) return;

  const vertical = !!state.config.vertical;
  const enemyBattleFaction: BattleFaction = faction === 'blue' ? 'red' : 'blue';

  // Vertical: blue advances up (dir=-1 on r), red advances down (dir=+1 on r)
  // Horizontal: blue advances right (dir=+1 on q), red advances left (dir=-1 on q)
  const dir = vertical
    ? (faction === 'blue' ? -1 : 1)
    : (faction === 'blue' ? 1 : -1);

  const ctx: TickContext = {
    dir,
    vertical,
    ownStar: state.stars.get(faction)!,
    enemyStar: state.getEnemyStar(faction)!,
    cols: state.config.cols,
    rows: state.config.rows,
    faction,
    enemyBattleFaction,
    allEnemies: state.getBattleFactionUnits(enemyBattleFaction),
  };

  if (faction === 'blue' && state.lieutenantOrder !== 'auto') {
    // Player faction — dispatch ALL units according to the current lieutenant order
    switch (state.lieutenantOrder) {
      case 'attack':   tickVanguard(state, units, ctx); break;
      case 'defend':   tickGuard(state, units); break;
      case 'skirmish': tickSkirmish(state, units, ctx); break;
      case 'mobile':   tickReserve(state, units, ctx); break;
    }
  } else if (vertical) {
    // Vertical mode: all units charge forward like vanguard
    tickVanguard(state, units, ctx);
  } else {
    // Auto (default) or enemy — role-based dispatch: vanguard attacks, reserve intercepts, guard defends
    const vanguard: BattleUnit[] = [];
    const reserve: BattleUnit[] = [];
    const guard: BattleUnit[] = [];
    for (const u of units) {
      if (u.role === 'guard') guard.push(u);
      else if (u.role === 'reserve') reserve.push(u);
      else vanguard.push(u);
    }
    tickVanguard(state, vanguard, ctx);
    tickReserve(state, reserve, ctx);
    tickGuard(state, guard);
  }
}

// ── Position helpers (zone-aware, orientation-agnostic) ──

/** Is `hex` inside the enemy's own deployment zone (my front band)? */
function inEnemyBack(hex: Hex, ctx: TickContext): boolean {
  return depthOf(hex, ctx.cols, ctx.rows, ctx.faction, ctx.vertical) === 'front';
}

/** Is `hex` inside my own deployment zone (my back band)? */
function inOwnBack(hex: Hex, ctx: TickContext): boolean {
  return depthOf(hex, ctx.cols, ctx.rows, ctx.faction, ctx.vertical) === 'back';
}

// ── VANGUARD: always march forward ──

function tickVanguard(state: BattleState, units: BattleUnit[], ctx: TickContext): void {
  for (const unit of units) {
    if (!state.canAct(unit)) continue;
    if (handlePinned(state, unit)) continue;

    // 1. Attack adjacent enemy
    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      state.resolveCombat(unit, pickWeakest(enemies));
      state.resetCooldown(unit);
      continue;
    }

    // 2. In enemy deployment zone → pathfind to star (bypass forward-only)
    if (inEnemyBack(unit.hex, ctx)) {
      if (state.moveUnitAlongPath(unit.id, ctx.enemyStar)) {
        state.resetCooldown(unit);
        continue;
      }
    }

    // 3. Advance forward up to 3 steps
    const target = findAdvanceTarget(state, unit, ctx.dir, 3, ctx.vertical);
    if (target) {
      moveForward(state, unit.id, target, ctx.dir, ctx.vertical);
      state.resetCooldown(unit);
    }
  }
}

// ── GUARD: stationary, only attack adjacent ──

function tickGuard(state: BattleState, units: BattleUnit[]): void {
  for (const unit of units) {
    if (!state.canAct(unit)) continue;
    if (handlePinned(state, unit)) continue;

    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      state.resolveCombat(unit, pickWeakest(enemies));
      state.resetCooldown(unit);
    }
    // Otherwise: do nothing, hold position
  }
}

// ── SKIRMISH: strike adjacent enemies then retreat; approach when none are adjacent ──

function tickSkirmish(state: BattleState, units: BattleUnit[], ctx: TickContext): void {
  for (const unit of units) {
    if (!state.canAct(unit)) continue;
    if (handlePinned(state, unit)) continue;

    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      // Strike the weakest adjacent enemy
      state.resolveCombat(unit, pickWeakest(enemies));
      // Then retreat one step backward
      const retreatHex = findRetreatHex(state, unit, ctx.dir, ctx.vertical);
      if (retreatHex) {
        state.moveUnitAlongPath(unit.id, retreatHex);
      }
      state.resetCooldown(unit);
      continue;
    }

    // No adjacent enemies — approach the nearest enemy
    const target = findClosestTo(unit, ctx.allEnemies);
    if (target) {
      state.moveUnitAlongPath(unit.id, target.hex);
      state.resetCooldown(unit);
    }
  }
}

/** Find an empty hex one step backward (opposite of dir) from the unit's current hex. */
function findRetreatHex(state: BattleState, unit: BattleUnit, dir: number, vertical: boolean): Hex | null {
  if (vertical) {
    // Retreat = opposite row direction in offset coords
    const col = unit.hex.q;
    const row = unit.hex.r + Math.floor(unit.hex.q / 2);
    const retreatHex = offsetToAxialFlatTop(col, row - dir);
    if (state.isValidHex(retreatHex) && !state.getUnitAt(retreatHex)) return retreatHex;
    return null;
  }
  for (const neighbor of hexNeighbors(unit.hex)) {
    if ((neighbor.q - unit.hex.q) * dir < 0 && state.isValidHex(neighbor) && !state.getUnitAt(neighbor)) {
      return neighbor;
    }
  }
  return null;
}

// ── RESERVE: intercept with busy state, become vanguard when enemy vanguard dies ──

function tickReserve(
  state: BattleState, units: BattleUnit[], ctx: TickContext,
): void {
  const enemyVanguardAlive = ctx.allEnemies.filter(e => e.role === 'vanguard');

  // Clean up stale busy targets (dead enemies or dead reserves)
  for (const [reserveId, targetId] of busyTargets) {
    const target = state.units.get(targetId);
    const reserveUnit = state.units.get(reserveId);
    if (!target || target.isDying || !reserveUnit || reserveUnit.isDying) {
      busyTargets.delete(reserveId);
    }
  }

  for (const unit of units) {
    if (!state.canAct(unit)) continue;
    if (handlePinned(state, unit)) continue;

    // 1. Attack adjacent enemy
    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      state.resolveCombat(unit, pickWeakest(enemies));
      state.resetCooldown(unit);
      continue;
    }

    // 2. No enemy vanguard left → behave like vanguard
    if (enemyVanguardAlive.length === 0) {
      busyTargets.delete(unit.id);

      // In enemy deployment zone → pathfind to star
      if (inEnemyBack(unit.hex, ctx)) {
        if (state.moveUnitAlongPath(unit.id, ctx.enemyStar)) {
          state.resetCooldown(unit);
          continue;
        }
      }
      // Otherwise advance forward
      const target = findAdvanceTarget(state, unit, ctx.dir, 3, ctx.vertical);
      if (target) {
        moveForward(state, unit.id, target, ctx.dir, ctx.vertical);
        state.resetCooldown(unit);
      }
      continue;
    }

    // 3. Busy: chasing a specific target (no direction restriction)
    const busyTargetId = busyTargets.get(unit.id);
    if (busyTargetId !== undefined) {
      const target = state.units.get(busyTargetId);
      if (target && !target.isDying) {
        const interceptHex = findInterceptHex(state, unit, target);
        if (interceptHex) {
          state.moveUnitAlongPath(unit.id, interceptHex);
        }
        state.resetCooldown(unit);
        continue;
      }
      // Target gone — become idle
      busyTargets.delete(unit.id);
    }

    // 4. Idle: intercept enemy vanguards that have reached our deployment zone
    const reserveThreats = ctx.allEnemies.filter(e => {
      if (e.role !== 'vanguard') return false;
      return inOwnBack(e.hex, ctx);
    });
    if (reserveThreats.length > 0) {
      // Find nearest threat not already being chased by another reserve
      const chasedIds = new Set(busyTargets.values());
      const available = reserveThreats.filter(e => !chasedIds.has(e.id));
      const target = available.length > 0
        ? findClosestTo(unit, available)
        : findClosestTo(unit, reserveThreats); // all taken — double up
      if (target) {
        busyTargets.set(unit.id, target.id);
        const interceptHex = findInterceptHex(state, unit, target);
        if (interceptHex) {
          state.moveUnitAlongPath(unit.id, interceptHex);
        }
        state.resetCooldown(unit);
        continue;
      }
    }

    // 5. No threat — stay in place (don't move)
  }
}

// ── Helpers re-exported from movements.ts ──
// handlePinned, pickWeakest, findInterceptHex, findClosestTo,
// findAdvanceTarget, moveForward — all imported above

// ── Composed movement: forward → greedy on engagement ──
const greedyAdvance = whenEngaged(forward, greedy);

// ── Legacy AI (morale / annihilation modes) ──

function tickLegacy(state: BattleState, faction: BattleFaction): void {
  const vertical = !!state.config.vertical;
  const dir = vertical
    ? (faction === 'blue' ? -1 : 1)
    : (faction === 'blue' ? 1 : -1);
  const units = state.getBattleFactionUnits(faction);
  if (units.length === 0) return;

  const ctx: MoveContext = {
    dir,
    vertical,
    rows: state.config.rows,
    cols: state.config.cols,
  };
  resolveMovement(state, units, greedyAdvance, ctx);
}
