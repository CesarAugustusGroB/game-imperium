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
import { hexDistance } from '../hex';
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

/**
 * A movement decision function. Returns the target hex (or null for no move).
 *
 * Optional `postAttackMove: true` lets the resolver call this primitive even
 * AFTER a same-tick attack — only `skirmish` sets this so it can retreat.
 * All other primitives stay out of the way after an attack to preserve the
 * pin mechanic.
 */
export interface MovementFn {
  (engine: BattleEngine, unit: BattleUnit, ctx: MoveContext): Hex | null;
  postAttackMove?: boolean;
}

/**
 * Process a list of units with a given movement function.
 *
 * Per-unit flow:
 *   1. Skip if can't act (cooldown / mid-animation / dying).
 *   2. Skip if pinned (handlePinned resolves the pinner-only attack itself).
 *   3. Attack the weakest adjacent enemy if any. In the default case this
 *      pins the defender and the unit does **not** move this tick — mirrors
 *      pre-refactor behavior. Attacking + moving on the same tick breaks the
 *      pin chain (attacker leaves, defender stuck).
 *   4. If no adjacent enemy, consult `moveFn` for a target hex and move.
 *   5. Always reset the cooldown afterward.
 *
 * **Hit-and-run exception**: `MovementFn`s with `postAttackMove = true`
 * (e.g. `skirmish`) DO run after an attack so they can retreat. They read
 * `ctx.justAttacked` to know why they were called.
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

    // Ranged pre-check: fire an arrow if target is within weapon range.
    if (unit.ranged && unit.actionCooldown <= 0) {
      const range = unit.ranged.range;
      let rangedTarget: BattleUnit | null = null;
      let bestDist = Infinity;
      for (const other of engine.units.values()) {
        if (other.isDying || other.faction === unit.faction) continue;
        const d = hexDistance(unit.hex, other.hex);
        if (d >= 1 && d <= range && d < bestDist) { bestDist = d; rangedTarget = other; }
      }
      if (rangedTarget) {
        engine.fireProjectile(unit, rangedTarget);
        // Movement profile handles kiting — skip melee and movement this tick.
        const hex = moveFn(engine, unit, { ...ctx, justAttacked: false });
        if (hex) engine.moveUnitAlongPath(unit.id, hex);
        // Cooldown already set by fireProjectile; just continue.
        continue;
      }
    }

    const enemies = engine.getAdjacentEnemies(unit);
    if (enemies.length > 0) {
      engine.resolveCombat(unit, pickWeakest(enemies));
      // Only opt-in primitives (skirmish) move after striking.
      if (moveFn.postAttackMove) {
        const hex = moveFn(engine, unit, { ...ctx, justAttacked: true });
        if (hex) engine.moveUnitAlongPath(unit.id, hex);
      }
      engine.resetCooldown(unit);
      continue;
    }

    const hex = moveFn(engine, unit, { ...ctx, justAttacked: false });
    if (hex) engine.moveUnitAlongPath(unit.id, hex);
    engine.resetCooldown(unit);
  }
}
