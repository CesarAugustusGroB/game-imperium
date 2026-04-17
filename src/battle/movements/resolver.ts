/**
 * Movement resolver — the shared per-frame loop every AI goes through.
 *
 * Given a `MovementFn` and a list of units, the resolver:
 *   1. skips units that can't act (cooldown / mid-animation / dying)
 *   2. handles pinned units (they can only attack their pinner)
 *   3. attacks any adjacent enemy (weakest first)
 *   4. calls the `MovementFn` to get a target hex (with `justAttacked` flag
 *      in the context so skirmishers can retreat after striking)
 *   5. moves the unit and resets its cooldown
 *
 * A MovementFn is a pure function `(engine, unit, ctx) → Hex | null`.
 * Primitives live in `./primitives`, combinators in `./combinators`.
 */

import type { BattleEngine } from '../core/BattleEngine';
import type { BattleUnit } from '../battle-types';
import type { Hex } from '../hex';
import { handlePinned, pickWeakest } from './helpers';

export interface MoveContext {
  /** +1 or −1 advance direction in the faction's movement axis. */
  dir: number;
  vertical: boolean;
  rows: number;
  cols: number;
  /** True when the unit struck an adjacent enemy earlier in this tick.
   *  Skirmishers read this to retreat after a hit. */
  justAttacked?: boolean;
}

/** A movement decision function. Returns the target hex (or null for no move). */
export type MovementFn = (
  engine: BattleEngine,
  unit: BattleUnit,
  ctx: MoveContext,
) => Hex | null;

/**
 * Process a list of units with a given movement function.
 * Handles the shared boilerplate: canAct, pinned, attack adjacent, move, cooldown.
 */
export function resolveMovement(
  engine: BattleEngine,
  units: BattleUnit[],
  moveFn: MovementFn,
  ctx: MoveContext,
): void {
  for (const unit of units) {
    if (!engine.canAct(unit)) continue;
    if (handlePinned(engine, unit)) continue;

    // Attack adjacent enemies first
    let justAttacked = false;
    const enemies = engine.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      engine.resolveCombat(unit, pickWeakest(enemies));
      justAttacked = true;
    }

    // Then let the MovementFn decide where to move (if anywhere). The
    // justAttacked flag lets skirmish primitives retreat right after striking.
    const hex = moveFn(engine, unit, { ...ctx, justAttacked });
    if (hex) engine.moveUnitAlongPath(unit.id, hex);

    engine.resetCooldown(unit);
  }
}
