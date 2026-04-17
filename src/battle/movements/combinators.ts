/**
 * Movement combinators — higher-order functions that compose primitives
 * into richer behaviors.
 *
 * The library:
 *   - `when(cond, then, else)`       — pick a branch based on a predicate
 *   - `whenEngaged(before, after)`   — shortcut for "engaged OR in enemy zone"
 *   - `sequence(a, b, c, …)`         — try each in order, use the first non-null
 *   - `fallback(a, b)`               — alias for sequence(a, b)
 *   - `prioritize([{cond, move}, …])` — first matching predicate's move wins
 */

import type { BattleEngine } from '../core/BattleEngine';
import type { BattleUnit } from '../battle-types';
import type { MovementFn, MoveContext } from './resolver';
import { isInEnemyZone } from './helpers';

/** A boolean predicate over a unit. */
export type UnitPredicate = (
  engine: BattleEngine,
  unit: BattleUnit,
  ctx: MoveContext,
) => boolean;

// ── when / whenEngaged ──

/** Pick `thenMove` when `cond` is true, otherwise `elseMove` (default: hold). */
export function when(
  cond: UnitPredicate,
  thenMove: MovementFn,
  elseMove?: MovementFn,
): MovementFn {
  return (engine, unit, ctx) => {
    if (cond(engine, unit, ctx)) return thenMove(engine, unit, ctx);
    if (elseMove) return elseMove(engine, unit, ctx);
    return null;
  };
}

/**
 * Switch from `before` to `after` once the unit has engaged OR entered the
 * enemy zone. Side effect: crossing into the enemy zone permanently flips
 * `unit.hasEngaged` so the "after" behavior sticks even if the unit later
 * retreats back into neutral territory.
 */
export function whenEngaged(before: MovementFn, after: MovementFn): MovementFn {
  return (engine, unit, ctx) => {
    if (!unit.hasEngaged && isInEnemyZone(engine, unit)) {
      unit.hasEngaged = true;
    }
    return unit.hasEngaged ? after(engine, unit, ctx) : before(engine, unit, ctx);
  };
}

// ── sequence / fallback ──

/** Try each move in order; return the first non-null result. */
export function sequence(...moves: MovementFn[]): MovementFn {
  return (engine, unit, ctx) => {
    for (const m of moves) {
      const h = m(engine, unit, ctx);
      if (h) return h;
    }
    return null;
  };
}

/** Alias — try `primary`, fall back to `secondary` if it returns null. */
export function fallback(primary: MovementFn, secondary: MovementFn): MovementFn {
  return sequence(primary, secondary);
}

// ── prioritize ──

/**
 * First matching condition wins. Useful for decision trees:
 *   prioritize([
 *     { cond: isLowHP(0.2),   move: retreat },
 *     { cond: enemyAdjacent,  move: skirmish },
 *     { cond: () => true,     move: forward },
 *   ])
 */
export function prioritize(
  branches: { cond: UnitPredicate; move: MovementFn }[],
): MovementFn {
  return (engine, unit, ctx) => {
    for (const { cond, move } of branches) {
      if (cond(engine, unit, ctx)) return move(engine, unit, ctx);
    }
    return null;
  };
}
