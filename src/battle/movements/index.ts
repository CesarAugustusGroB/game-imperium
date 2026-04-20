/**
 * Movement library — barrel.
 *
 * Public surface:
 *   - `MovementFn` / `MoveContext` types
 *   - `resolveMovement(engine, units, moveFn, ctx)` — the per-frame loop
 *   - Primitives: forward, greedy, hold, retreat, charge, skirmish, flank,
 *     standGround, pathToStar, intercept
 *   - Combinators: when, whenEngaged, sequence, fallback, prioritize
 *   - Conditions: isLowHP, enemyAdjacent, inEnemyZone, inOwnZone, hasEngaged,
 *     isOutnumbered, hasMorale, hasAttackedThisTick, not/all/any/always
 *   - Profiles: VANGUARD_AI, RESERVE_AI, GUARD_AI, BERSERKER_AI,
 *     SKIRMISHER_AI, FLANKER_AI, plus `MOVEMENT_PROFILES` dispatch registry
 *   - Helpers (re-exported for AI authors): pickWeakest, handlePinned,
 *     findInterceptHex, findClosestTo, findAdvanceTarget, moveForward
 */

export type { MovementFn, MoveContext } from './resolver';
export { resolveMovement } from './resolver';

export * from './primitives';
export * from './combinators';
export * from './conditions';
export * from './profiles';

export {
  pickWeakest, handlePinned, findInterceptHex, findClosestTo,
  findAdvanceTarget, findRetreatHex, moveForward, validateForward,
  isInEnemyZone, isInOwnZone,
} from './helpers';

// Back-compat re-export so existing `import { whenEngaged } from './movements'`
// sites keep working until we migrate them to `./movements/combinators`.
export type { UnitPredicate } from './combinators';
