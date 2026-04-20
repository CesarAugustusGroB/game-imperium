/**
 * Named AI profiles — pre-composed MovementFn combinations ready to slot
 * into the unit-level `MOVEMENT_PROFILES` registry.
 *
 * Each profile is a single exported `MovementFn`. Swapping one line of a
 * profile changes battle behavior for every unit that uses it.
 *
 * The `MOVEMENT_PROFILES` record at the bottom is the single source of truth
 * the dispatcher reads from; `BattleUnit.movementProfile` is a string key into
 * it. Adding a new profile = one `MovementFn` export + one map entry + one
 * entry on the `MovementProfileId` union in `battle-types.ts`.
 */

import type {
  BattleFaction, MovementProfileId,
} from '../battle-types';
import type { BattleEngine } from '../core/BattleEngine';
import type { MovementFn } from './resolver';
import { depthOf } from '../battle-zones';

import {
  forward, greedy, standGround, skirmish, flank, pathToStar,
} from './primitives';
import {
  findInterceptHex, findClosestTo, isInEnemyZone,
} from './helpers';
import { prioritize, sequence, fallback } from './combinators';
import { inEnemyZone, always } from './conditions';

// ── Vanguard — march forward, chase the enemy star when deep in enemy territory ──
// In the enemy zone we try `pathToStar` first; if the star hex is blocked by
// another unit (engine.moveUnitAlongPath returns false) the `pathToStar`
// primitive returns null (see implementation), so we fall back to `forward`
// so vanguards don't freeze waiting for an unreachable tile.

export const VANGUARD_AI: MovementFn = prioritize([
  { cond: inEnemyZone, move: fallback(pathToStar, forward) },
  { cond: always,      move: forward },
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

/** Clear the reserve busy-target state. Call on battle enter so stale IDs
 *  from a previous battle don't leak into the new one. */
export function resetReserveAIState(): void {
  reserveBusyTargets.clear();
}

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

// ── Dispatch table ──

/**
 * The single registry `tickAI` reads from. Keys are `BattleUnit.movementProfile`
 * ids (declared in `battle-types.ts`); values are the composed `MovementFn`s.
 *
 * `lieutenant:*` entries are produced by `tickAI` when the player has a
 * non-`auto` order active — they route lieutenant orders through the same
 * lookup instead of a parallel dispatch path.
 */
export const MOVEMENT_PROFILES: Record<MovementProfileId, MovementFn> = {
  'vanguard-march':      greedy,
  'reserve-intercept':   greedy,
  'guard-stand':         greedy,
  'berserker':           greedy,
  'skirmisher':          greedy,
  'flanker':             greedy,
  'lieutenant:attack':   greedy,
  'lieutenant:defend':   greedy,
  'lieutenant:skirmish': greedy,
  'lieutenant:mobile':   greedy,
};
