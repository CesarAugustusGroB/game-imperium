/**
 * EffectRegistry — generic plugin registry for effect dispatch.
 *
 * Replaces the big switch-statements that used to live in `BattleEngine`
 * (decretum, legate) and `progression-bridge` (doctrine/province) and
 * `ability-ui` (commander abilities). Each effect type gets a handler
 * function registered once; `apply(effect, ctx)` looks it up and invokes it.
 *
 * Adding a new effect type is a 2-liner:
 *   1. write a handler `(effect, ctx) => void`
 *   2. `registry.register('new-type', handler)`
 *
 * No edits to BattleEngine or any other switch-holder. This is the pattern
 * that powers most of the battle module's extensibility.
 */

import type { BattleEngine } from '../core/BattleEngine';
import type { BattleUnit, BattleFaction } from '../battle-types';
import type { Hex } from '../hex';

/** Shared context passed to every effect handler. */
export interface EffectContext {
  /** The battle facade — all state reads/writes go through this. */
  engine: BattleEngine;
  /** For targeted effects (e.g. targeted heal, smite, buy reinforcements). */
  targetHex?: Hex;
  /** For unit-targeted abilities (e.g. miracle heals a unit, turncoat converts one). */
  targetUnit?: BattleUnit;
  /** Which faction this effect is being applied TO (legate traits per faction). */
  faction?: BattleFaction;
}

/** A single effect handler — pure function from (effect, context) to side effects on the engine. */
export type EffectHandler<Effect> = (effect: Effect, ctx: EffectContext) => void;

/**
 * Registry mapping effect `type` strings to handler functions.
 * Generic over the effect shape so different domains (Decretum, Legate, Doctrine,
 * Ability) each get their own type-safe registry instance.
 */
export class EffectRegistry<Effect extends { type: string }> {
  private readonly handlers = new Map<Effect['type'], EffectHandler<Effect>>();
  private readonly warnedMissing = new Set<string>();

  /** Register a handler for a specific effect type. Last registration wins. */
  register<K extends Effect['type']>(
    type: K,
    handler: EffectHandler<Extract<Effect, { type: K }>>,
  ): void {
    this.handlers.set(type, handler as EffectHandler<Effect>);
  }

  /** Run the handler registered for `effect.type`. No-op (with warning once) if none. */
  apply(effect: Effect, ctx: EffectContext): void {
    const handler = this.handlers.get(effect.type);
    if (handler) {
      handler(effect, ctx);
      return;
    }
    if (!this.warnedMissing.has(effect.type)) {
      this.warnedMissing.add(effect.type);
      // eslint-disable-next-line no-console
      console.warn(`[EffectRegistry] No handler registered for effect type: "${effect.type}"`);
    }
  }

  has(type: Effect['type']): boolean {
    return this.handlers.has(type);
  }

  /** Clear all handlers (useful for tests). */
  clear(): void {
    this.handlers.clear();
    this.warnedMissing.clear();
  }
}
