/**
 * Effects — plugin registries for all battle-layer effect dispatch.
 *
 * Domains:
 *   - Decretum  → `decretumRegistry`  (scroll effects during battle)
 *   - Legate    → `legateRegistry`    (trait effects applied at spawn)
 *   - Doctrine  → `doctrineRegistry`  (doctrine + province effects at battle start)
 *   - Ability   → `abilityRegistry`   (commander tactical abilities)
 *
 * Boot: `registerAllEffects()` populates every registry. Called once from
 * the `BattleEngine` constructor so registries are always ready by the time
 * the battle starts.
 *
 * Adding a new effect type of any kind = one handler function + one
 * `registerX` call inside the matching register*Effects function. No edits
 * to `BattleEngine` / `progression-bridge` / `ability-ui`.
 */

export { EffectRegistry } from './EffectRegistry';
export type { EffectContext, EffectHandler } from './EffectRegistry';

export {
  decretumRegistry, registerDecretumEffects, applyDecretumEffect,
} from './decretum-effects';

export {
  legateRegistry, registerLegateEffects, applyLegateEffect,
} from './legate-effects';

export {
  doctrineRegistry, registerDoctrineEffects, applyDoctrineEffect,
} from './doctrine-effects';

export {
  abilityRegistry, registerAbilityEffects, applyAbility,
} from './ability-effects';
export type { AbilityEffect } from './ability-effects';

import { registerDecretumEffects } from './decretum-effects';
import { registerLegateEffects } from './legate-effects';
import { registerDoctrineEffects } from './doctrine-effects';
import { registerAbilityEffects } from './ability-effects';

let registered = false;

/** Populate every effect registry. Idempotent — safe to call more than once. */
export function registerAllEffects(): void {
  if (registered) return;
  registered = true;
  registerDecretumEffects();
  registerLegateEffects();
  registerDoctrineEffects();
  registerAbilityEffects();
}
