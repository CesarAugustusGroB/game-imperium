import type { BattleState } from './battle-state';
import type { Faction, BattleUnit } from './battle-types';
import type { Hex } from './hex';
import { hexDistance, hexNeighbors } from './hex';
import { getZones, isInCamp, isInReserveOrDeeper, hexToCol, type ZoneBounds } from './battle-zones';

/**
 * Football-style zonal battle AI.
 *
 * VANGUARD — always march forward; pathfind to star in enemy camp
 * GUARD — stationary; only attack adjacent enemies
 * RESERVE — hold position; intercept enemies in reserve zone (busy state);
 *           become vanguard when no enemy vanguard remains
 */

// ── Reserve busy state (AI-local, not on BattleUnit) ──

const busyTargets = new Map<number, number>(); // reserveUnitId → enemyUnitId

// ── Pre-computed per-tick context ──

interface TickContext {
  dir: number;
  ownStar: Hex;
  enemyStar: Hex;
  zones: ZoneBounds;
  enemyZones: ZoneBounds;
  enemyFaction: Faction;
  allEnemies: BattleUnit[];
}

// ── Entry point ──

export function tickAI(state: BattleState, faction: Faction): void {
  if (state.config.victoryMode === 'capture') {
    tickCapture(state, faction);
  } else {
    tickLegacy(state, faction);
  }
}

// ── Capture Mode AI ──

function tickCapture(state: BattleState, faction: Faction): void {
  const units = state.getFactionUnits(faction);
  if (units.length === 0) return;

  const enemyFaction: Faction = faction === 'blue' ? 'red' : 'blue';
  const ctx: TickContext = {
    dir: faction === 'blue' ? 1 : -1,
    ownStar: state.stars.get(faction)!,
    enemyStar: state.getEnemyStar(faction)!,
    zones: getZones(state.config.cols, faction),
    enemyZones: getZones(state.config.cols, enemyFaction),
    enemyFaction,
    allEnemies: state.getFactionUnits(enemyFaction),
  };

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
    if (isInCamp(hexToCol(unit.hex), ctx.enemyZones, ctx.enemyFaction)) {
      if (state.moveUnitAlongPath(unit.id, ctx.enemyStar)) {
        state.resetCooldown(unit);
        continue;
      }
    }

    // 3. Advance forward up to 3 steps
    const target = findAdvanceTarget(state, unit, ctx.dir, 3);
    if (target) {
      moveForward(state, unit.id, target, ctx.dir);
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

// ── RESERVE: intercept with busy state, become vanguard when enemy vanguard dies ──

function tickReserve(
  state: BattleState, units: BattleUnit[], faction: Faction, ctx: TickContext,
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
      if (isInCamp(hexToCol(unit.hex), ctx.enemyZones, ctx.enemyFaction)) {
        if (state.moveUnitAlongPath(unit.id, ctx.enemyStar)) {
          state.resetCooldown(unit);
          continue;
        }
      }
      // Otherwise advance forward
      const target = findAdvanceTarget(state, unit, ctx.dir, 1);
      if (target) {
        moveForward(state, unit.id, target, ctx.dir);
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
      const col = hexToCol(e.hex);
      return isInReserveOrDeeper(col, ctx.zones, faction);
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
function moveForward(state: BattleState, unitId: number, target: Hex, dir: number): boolean {
  const unit = state.units.get(unitId);
  if (!unit) return false;
  if ((target.q - unit.hex.q) * dir < 0) return false;
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
  state: BattleState, unit: BattleUnit, dir: number, maxSteps: number,
): Hex | null {
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

  if (target.q === unit.hex.q && target.r === unit.hex.r) return null;
  return target;
}

// ── Legacy AI (morale / annihilation modes) ──

function tickLegacy(state: BattleState, faction: Faction): void {
  const dir = faction === 'blue' ? 1 : -1;
  const units = state.getFactionUnits(faction);
  if (units.length === 0) return;

  const frontQ = units.reduce((best, u) =>
    dir > 0 ? Math.max(best, u.hex.q) : Math.min(best, u.hex.q),
    dir > 0 ? -Infinity : Infinity,
  );

  for (const unit of units) {
    if (!state.canAct(unit)) continue;

    const enemies = state.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      state.resolveCombat(unit, pickWeakest(enemies));
      state.resetCooldown(unit);
      continue;
    }

    const nearest = state.findNearestEnemy(unit);
    if (!nearest) continue;

    const distBehindFront = Math.abs(unit.hex.q - frontQ);
    const steps = distBehindFront > 1 ? 2 : 1;
    const target = findAdvanceTarget(state, unit, dir, steps);
    if (target) {
      state.moveUnitAlongPath(unit.id, target);
      state.resetCooldown(unit);
    }
  }
}
