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
  forward, greedy, skirmish, flank, pathToStar,
} from './primitives';
import { hexDistance } from '../hex';
import {
  findInterceptHex, findClosestTo, findRetreatHex, isInEnemyZone,
} from './helpers';
import { sequence, fallback, whenEngaged } from './combinators';

// ── Vanguard — march forward until first engagement, then greedy-chase ──
// Once a vanguard hits or is hit (or enters enemy zone), it drops the march
// and pursues the nearest enemy at all costs.

export const VANGUARD_AI: MovementFn = whenEngaged(
  fallback(forward, greedy),
  greedy,
);

// ── Guard — advance toward enemies until first engagement, then greedy-chase ──

export const GUARD_AI: MovementFn = whenEngaged(
  fallback(forward, greedy),
  greedy,
);

// ── Berserker — chase the nearest enemy at all times (no direction restriction) ──

export const BERSERKER_AI: MovementFn = greedy;

// ── Skirmisher — skirmish approach until engaged, then greedy-chase ──

export const SKIRMISHER_AI: MovementFn = whenEngaged(
  fallback(skirmish, greedy),
  greedy,
);

// ── Flanker — approach via flank columns, greedy-chase after first engagement ──

export const FLANKER_AI: MovementFn = whenEngaged(
  sequence(flank, greedy),
  greedy,
);

// ── Ranged skirmisher — 3-state arc with a proximity kite override.
//    Kite: enemy within 3 hexes → retreat backward.
//    1) Still in own back zone → advance forward out of camp.
//    2) Out of camp → intercept enemies in the same depth band.
//    3) Zone clear → greedy chase anywhere on the map. ──

const RANGED_KITE_DIST = 3;

export const RANGED_SKIRMISHER_AI: MovementFn = (engine, unit, ctx) => {
  const enemyFaction: BattleFaction = unit.faction === 'blue' ? 'red' : 'blue';
  const enemies = engine.getBattleFactionUnits(enemyFaction).filter(e => !e.isDying);
  if (enemies.length === 0) return null;

  const closest = findClosestTo(unit, enemies);
  if (closest && hexDistance(unit.hex, closest.hex) <= RANGED_KITE_DIST) {
    return findRetreatHex(engine, unit, ctx.dir, ctx.vertical);
  }

  const myDepth = depthOf(unit.hex, ctx.cols, ctx.rows, unit.faction, ctx.vertical);
  if (myDepth === 'back') {
    return forward(engine, unit, ctx);
  }

  const inZone = enemies.filter(e =>
    depthOf(e.hex, ctx.cols, ctx.rows, unit.faction, ctx.vertical) === myDepth,
  );
  if (inZone.length > 0) {
    const target = findClosestTo(unit, inZone);
    if (target) return findInterceptHex(engine, unit, target);
  }

  return greedy(engine, unit, ctx);
};

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

const RESERVE_LOGIC: MovementFn = (engine, unit, ctx) => {
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

  // 4. No immediate threats — hold position (outer whenEngaged will greedy if engaged)
  return null;
};

// ── Reserve — intercept/defend until first engagement, then greedy-chase ──

export const RESERVE_AI: MovementFn = whenEngaged(
  fallback(RESERVE_LOGIC, greedy),
  greedy,
);

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
  'vanguard-march':      VANGUARD_AI,
  'reserve-intercept':   RESERVE_AI,
  'guard-stand':         GUARD_AI,
  'berserker':           BERSERKER_AI,
  'skirmisher':          SKIRMISHER_AI,
  'ranged-skirmisher':   RANGED_SKIRMISHER_AI,
  'flanker':             FLANKER_AI,
  'lieutenant:attack':   VANGUARD_AI,
  'lieutenant:defend':   GUARD_AI,
  'lieutenant:skirmish': SKIRMISHER_AI,
  'lieutenant:mobile':   FLANKER_AI,
};
