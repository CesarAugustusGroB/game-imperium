/**
 * Unit predicates — boolean helpers used by `when` / `prioritize` combinators.
 *
 * Adding a new condition = export one function. Conditions compose naturally
 * with `not`, `all`, `any`.
 */

import type { BattleEngine } from '../core/BattleEngine';
import type { BattleUnit } from '../battle-types';
import type { MoveContext } from './resolver';
import type { UnitPredicate } from './combinators';
import { isInEnemyZone, isInOwnZone } from './helpers';

// ── Unit state ──

/** HP fraction below `threshold` (0..1). */
export function isLowHP(threshold: number): UnitPredicate {
  return (_engine, unit) => {
    if (unit.stats.hp <= 0) return false;
    return unit.currentHp / unit.stats.hp < threshold;
  };
}

/** True if this unit struck an enemy earlier in the current tick. */
export const hasAttackedThisTick: UnitPredicate = (_engine, _unit, ctx) =>
  ctx.justAttacked === true;

/** True if an enemy is standing on one of the 6 adjacent hexes. */
export const enemyAdjacent: UnitPredicate = (engine, unit) =>
  engine.getAdjacentEnemies(unit).length > 0;

/** True once the unit has engaged in combat (first strike given or received). */
export const hasEngaged: UnitPredicate = (_engine, unit) => unit.hasEngaged;

// ── Outnumbering / morale ──

/** True if nearby enemies within `radius` hexes outnumber nearby allies. */
export function isOutnumbered(radius = 2): UnitPredicate {
  return (engine, unit) => {
    let enemyCount = 0;
    let allyCount = 0;
    for (const other of engine.units.values()) {
      if (other.isDying || other.id === unit.id) continue;
      // Manhattan-ish distance on axial via hexDistance would be more accurate;
      // use q/r delta magnitudes as a cheap proxy.
      const d = Math.max(
        Math.abs(other.hex.q - unit.hex.q),
        Math.abs(other.hex.r - unit.hex.r),
        Math.abs((other.hex.q + other.hex.r) - (unit.hex.q + unit.hex.r)),
      );
      if (d > radius) continue;
      if (other.faction === unit.faction) allyCount++;
      else enemyCount++;
    }
    return enemyCount > allyCount;
  };
}

/** True while this faction's remaining strength is above `fraction` of starting. */
export function hasMorale(fraction: number): UnitPredicate {
  return (engine, unit) => {
    const current = engine.getBattleFactionStrength(unit.faction);
    // Engine doesn't expose startingStrength; approximate via sum of max HP.
    let starting = 0;
    for (const u of engine.getBattleFactionUnits(unit.faction)) starting += u.stats.hp;
    if (starting <= 0) return false;
    return current / starting > fraction;
  };
}

// ── Zone-based ──

/** True if the unit is standing inside the enemy's deployment zone. */
export const inEnemyZone: UnitPredicate = (engine, unit) => isInEnemyZone(engine, unit);

/** True if the unit is standing inside its own deployment zone. */
export const inOwnZone: UnitPredicate = (engine, unit) => isInOwnZone(engine, unit);

// ── Combinators on predicates ──

export function not(p: UnitPredicate): UnitPredicate {
  return (engine, unit, ctx) => !p(engine, unit, ctx);
}

export function all(...ps: UnitPredicate[]): UnitPredicate {
  return (engine, unit, ctx) => ps.every(p => p(engine, unit, ctx));
}

export function any(...ps: UnitPredicate[]): UnitPredicate {
  return (engine, unit, ctx) => ps.some(p => p(engine, unit, ctx));
}

/** Always-true predicate — use as the last branch of `prioritize` to define a default. */
export const always: UnitPredicate = () => true;

// Re-export MoveContext type for convenience
export type { MoveContext, BattleEngine, BattleUnit };
