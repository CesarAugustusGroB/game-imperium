import type { BattleState } from './battle-state';
import type { BattleFaction, BattleUnit } from './battle-types';
import type { Hex } from './hex';
import { hexDistance, hexNeighbors, offsetToAxialFlatTop } from './hex';
import {
  getZones, getVerticalZones,
  isInCamp, isInReserveOrDeeper, hexToCol,
  isInCampVertical, isInReserveOrDeeperVertical,
  type ZoneBounds,
} from './battle-zones';

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
  zones: ZoneBounds;
  enemyZones: ZoneBounds;
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
    zones: vertical
      ? getVerticalZones(state.config.rows, faction)
      : getZones(state.config.cols, faction),
    enemyZones: vertical
      ? getVerticalZones(state.config.rows, enemyBattleFaction)
      : getZones(state.config.cols, enemyBattleFaction),
    enemyBattleFaction,
    allEnemies: state.getBattleFactionUnits(enemyBattleFaction),
  };

  if (faction === 'blue' && state.lieutenantOrder !== 'auto') {
    // Player faction — dispatch ALL units according to the current lieutenant order
    switch (state.lieutenantOrder) {
      case 'attack':   tickVanguard(state, units, ctx); break;
      case 'defend':   tickGuard(state, units); break;
      case 'skirmish': tickSkirmish(state, units, ctx); break;
      case 'mobile':   tickReserve(state, units, faction, ctx); break;
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
    tickReserve(state, reserve, faction, ctx);
    tickGuard(state, guard);
  }
}

// ── Position helpers (abstract over orientation) ──

/** Check if a hex is in the enemy camp zone. */
function checkInCamp(hex: Hex, zones: ZoneBounds, faction: BattleFaction, vertical: boolean): boolean {
  return vertical
    ? isInCampVertical(hex.r + Math.floor(hex.q / 2), zones, faction)
    : isInCamp(hexToCol(hex), zones, faction);
}

/** Check if a hex is in reserve-or-deeper zone. */
function checkInReserveOrDeeper(hex: Hex, zones: ZoneBounds, faction: BattleFaction, vertical: boolean): boolean {
  return vertical
    ? isInReserveOrDeeperVertical(hex.r + Math.floor(hex.q / 2), zones, faction)
    : isInReserveOrDeeper(hexToCol(hex), zones, faction);
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

    // 2. In enemy camp → pathfind to star (bypass forward-only)
    if (checkInCamp(unit.hex, ctx.enemyZones, ctx.enemyBattleFaction, ctx.vertical)) {
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
  state: BattleState, units: BattleUnit[], faction: BattleFaction, ctx: TickContext,
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

      // In enemy camp → pathfind to star
      if (checkInCamp(unit.hex, ctx.enemyZones, ctx.enemyBattleFaction, ctx.vertical)) {
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

    // 4. Idle: intercept enemy vanguards that entered our reserve zone (or deeper)
    const reserveThreats = ctx.allEnemies.filter(e => {
      if (e.role !== 'vanguard') return false;
      return checkInReserveOrDeeper(e.hex, ctx.zones, faction, ctx.vertical);
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

// ── Pin Helper ──

/** If unit is pinned, it can only attack its pinner. Returns true if pinned (handled). */
function handlePinned(state: BattleState, unit: BattleUnit): boolean {
  if (unit.pinnedBy === null) return false;

  const pinner = state.units.get(unit.pinnedBy);
  // Pinner dead or gone — unpin
  if (!pinner || pinner.isDying) {
    unit.pinnedBy = null;
    return false;
  }

  // Pinner adjacent — attack it
  const enemies = state.getAdjacentEnemies(unit);
  const pinnerAdjacent = enemies.find(e => e.id === unit.pinnedBy);
  if (pinnerAdjacent) {
    state.resolveCombat(unit, pinnerAdjacent);
    state.resetCooldown(unit);
  }
  // Pinned — can't do anything else (don't move)
  return true;
}

// ── Movement Helpers ──

/** Move forward only — reject backward movement. */
function moveForward(state: BattleState, unitId: number, target: Hex, dir: number, vertical: boolean): boolean {
  const unit = state.units.get(unitId);
  if (!unit) return false;
  if (vertical) {
    // Compare in screen-row space: row = r + floor(q/2)
    const unitRow = unit.hex.r + Math.floor(unit.hex.q / 2);
    const targetRow = target.r + Math.floor(target.q / 2);
    if ((targetRow - unitRow) * dir < 0) return false;
  } else {
    if ((target.q - unit.hex.q) * dir < 0) return false;
  }
  return state.moveUnitAlongPath(unitId, target);
}

// ── Shared Helpers ──

/** Pick the weakest unit (lowest HP). */
function pickWeakest(units: BattleUnit[]): BattleUnit {
  return units.reduce((a, b) => a.currentHp < b.currentHp ? a : b);
}

/** Find the nearest empty hex adjacent to the target (for interception pathing). */
function findInterceptHex(state: BattleState, chaser: BattleUnit, target: BattleUnit): Hex | null {
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
function findClosestTo(unit: BattleUnit, targets: BattleUnit[]): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestDist = Infinity;
  for (const t of targets) {
    const d = hexDistance(unit.hex, t.hex);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

/** Find the best hex to advance forward (with diagonal fallback). */
function findAdvanceTarget(
  state: BattleState, unit: BattleUnit, dir: number, maxSteps: number, vertical: boolean,
): Hex | null {
  if (vertical) {
    // Work in offset coords (col, row) for square grid
    const col = unit.hex.q;
    let row = unit.hex.r + Math.floor(unit.hex.q / 2);
    const startRow = row;

    // Step straight forward (same col, row ± dir)
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

    // Blocked — try diagonal (col±1, row+dir)
    for (const colOff of [-1, 1]) {
      const diagHex = offsetToAxialFlatTop(col + colOff, startRow + dir);
      if (state.isValidHex(diagHex) && !state.getUnitAt(diagHex)) {
        return diagHex;
      }
    }
    return null;
  }

  // Horizontal mode: step along q
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

// ── Greedy AI: march forward, then chase nearest enemy after first combat ──

function tickGreedy(state: BattleState, units: BattleUnit[], dir: number, vertical: boolean): void {
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

    if (unit.hasEngaged) {
      // POST-ENGAGEMENT: chase nearest enemy (no direction restriction)
      const nearest = state.findNearestEnemy(unit);
      if (nearest) {
        const interceptHex = findInterceptHex(state, unit, nearest);
        if (interceptHex) {
          state.moveUnitAlongPath(unit.id, interceptHex);
        }
      }
    } else {
      // PRE-ENGAGEMENT: march straight forward
      const target = findAdvanceTarget(state, unit, dir, 3, vertical);
      if (target) {
        moveForward(state, unit.id, target, dir, vertical);
      }
    }
    state.resetCooldown(unit);
  }
}

// ── Legacy AI (morale / annihilation modes) ──

function tickLegacy(state: BattleState, faction: BattleFaction): void {
  const vertical = !!state.config.vertical;
  const dir = vertical
    ? (faction === 'blue' ? -1 : 1)
    : (faction === 'blue' ? 1 : -1);
  const units = state.getBattleFactionUnits(faction);
  if (units.length === 0) return;

  tickGreedy(state, units, dir, vertical);
}
