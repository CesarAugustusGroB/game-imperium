/**
 * Named AI profiles — pre-composed MovementFn combinations ready to slot
 * into the role or lieutenant-order dispatch tables.
 *
 * Each profile is a single exported `MovementFn`. Swapping one line of a
 * profile changes battle behavior for every unit that uses it.
 */

import type { BattleFaction, UnitRole, LieutenantOrder } from '../battle-types';
import type { BattleEngine } from '../core/BattleEngine';
import type { MovementFn } from './resolver';
import { depthOf } from '../battle-zones';

import {
  forward, greedy, standGround, skirmish, flank, pathToStar,
} from './primitives';
import {
  findInterceptHex, findClosestTo, isInEnemyZone,
} from './helpers';
import { prioritize, sequence } from './combinators';
import { inEnemyZone, always } from './conditions';

// ── Vanguard — march forward, chase the enemy star when deep in enemy territory ──

export const VANGUARD_AI: MovementFn = prioritize([
  // Once we've broken into the enemy deployment zone, go for the star.
  { cond: inEnemyZone, move: pathToStar },
  // Default: march forward.
  { cond: always, move: forward },
]);

// ── Guard — attack adjacent enemies only, never leave your spot ──

export const GUARD_AI: MovementFn = standGround;

// ── Berserker — chase the nearest enemy at all times (no direction restriction) ──

export const BERSERKER_AI: MovementFn = greedy;

// ── Skirmisher — retreat after striking, approach when nothing is adjacent ──

export const SKIRMISHER_AI: MovementFn = skirmish;

// ── Flanker — approach via flank columns, chase the nearest enemy when close ──

export const FLANKER_AI: MovementFn = sequence(flank, greedy);

// ── Reserve — intercept enemy vanguards that entered our zone; become
//   vanguard when no enemy vanguards remain. Stateful: tracks assigned
//   targets so multiple reserves don't pile onto one threat. ──

/** Module-local map of reserve unit id → the enemy vanguard id they're chasing. */
const reserveBusyTargets = new Map<number, number>();

/** Called each frame (via the profile) to prune dead links. */
function pruneBusy(engine: BattleEngine): void {
  for (const [reserveId, targetId] of reserveBusyTargets) {
    const target = engine.units.get(targetId);
    const reserveUnit = engine.units.get(reserveId);
    if (!target || target.isDying || !reserveUnit || reserveUnit.isDying) {
      reserveBusyTargets.delete(reserveId);
    }
  }
}

export const RESERVE_AI: MovementFn = (engine, unit, ctx) => {
  pruneBusy(engine);

  const enemyFaction: BattleFaction = unit.faction === 'blue' ? 'red' : 'blue';
  const allEnemies = engine.getBattleFactionUnits(enemyFaction);
  const enemyVanguardAlive = allEnemies.filter(e => e.role === 'vanguard');

  // 1. No enemy vanguards left — behave like vanguard (go to star or march)
  if (enemyVanguardAlive.length === 0) {
    reserveBusyTargets.delete(unit.id);
    if (isInEnemyZone(engine, unit)) return pathToStar(engine, unit, ctx);
    return forward(engine, unit, ctx);
  }

  // 2. Busy — chase our locked-in target
  const busyTargetId = reserveBusyTargets.get(unit.id);
  if (busyTargetId !== undefined) {
    const target = engine.units.get(busyTargetId);
    if (target && !target.isDying) {
      return findInterceptHex(engine, unit, target);
    }
    reserveBusyTargets.delete(unit.id);
  }

  // 3. Idle — intercept enemy vanguards that have entered our zone
  const threats = enemyVanguardAlive.filter(e =>
    depthOf(e.hex, ctx.cols, ctx.rows, unit.faction, ctx.vertical) === 'back',
  );
  if (threats.length > 0) {
    const chased = new Set(reserveBusyTargets.values());
    const available = threats.filter(e => !chased.has(e.id));
    const target = available.length > 0
      ? findClosestTo(unit, available)
      : findClosestTo(unit, threats); // double up if all are taken
    if (target) {
      reserveBusyTargets.set(unit.id, target.id);
      return findInterceptHex(engine, unit, target);
    }
  }

  // 4. No threats — hold position
  return null;
};

// ── Dispatch tables ──

/** Default AI per role — used by the auto/capture dispatcher in battle-ai. */
export const ROLE_PROFILES: Record<UnitRole, MovementFn> = {
  vanguard: VANGUARD_AI,
  reserve:  RESERVE_AI,
  guard:    GUARD_AI,
};

/** Lieutenant-order → AI mapping. 'auto' uses the role-based dispatch above. */
export const LIEUTENANT_PROFILES: Record<Exclude<LieutenantOrder, 'auto'>, MovementFn> = {
  attack:   VANGUARD_AI,
  defend:   GUARD_AI,
  skirmish: SKIRMISHER_AI,
  mobile:   RESERVE_AI,
};
