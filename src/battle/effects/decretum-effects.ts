/**
 * Decretum effect handlers.
 *
 * One handler per variant of `DecretumEffect`. Each is registered into the
 * shared `decretumRegistry` by `registerAllEffects()` (see `./index.ts`).
 *
 * Handlers that touch the battle layer live here. Strategic-layer effects
 * (`resource-gain`, `event-modifier`, `upkeep-reduction`,
 * `convert-enemy-next-battle`, `investment-discount`, `reveal`) are no-ops
 * at the battle layer — they're handled by `ability-ui.ts` /
 * `decretum-store.ts` before `apply()` is called.
 */

import type { DecretumEffect } from '../../game/items/decretum';
import { findReinforcementHex } from '../deployment';
import { EffectRegistry, type EffectContext } from './EffectRegistry';
import { FLASH_DURATION, SHAKE_DURATION } from '../battle-config';

/** The singleton registry used by `BattleEngine.applyDecretumEffect`. */
export const decretumRegistry = new EffectRegistry<DecretumEffect>();

/** Register every decretum handler onto the singleton. */
export function registerDecretumEffects(): void {
  // ── Heal ──
  decretumRegistry.register('heal', (effect, ctx) => {
    const { engine, targetHex } = ctx;
    if (effect.target === 'all') {
      for (const unit of engine.getBattleFactionUnits('blue')) {
        unit.currentHp = Math.min(unit.stats.hp, unit.currentHp + Math.floor(unit.stats.hp * effect.amount));
        unit.flashTimer = FLASH_DURATION;
      }
    } else if (targetHex) {
      const unit = engine.getUnitAt(targetHex);
      if (unit && unit.faction === 'blue') {
        unit.currentHp = Math.min(unit.stats.hp, unit.currentHp + Math.floor(unit.stats.hp * effect.amount));
        unit.flashTimer = FLASH_DURATION;
      }
    }
  });

  // ── Damage ──
  decretumRegistry.register('damage', (effect, ctx) => {
    const { engine, targetHex } = ctx;
    if (effect.target === 'area') {
      for (const unit of engine.units.values()) {
        if (unit.isDying) continue;
        unit.currentHp -= effect.amount;
        unit.shakeTimer = SHAKE_DURATION;
        unit.flashTimer = FLASH_DURATION;
        engine.applyDeathCheck(unit);
      }
    } else if (targetHex) {
      const unit = engine.getUnitAt(targetHex);
      if (unit && unit.faction === 'red') {
        unit.currentHp -= effect.amount;
        unit.shakeTimer = SHAKE_DURATION;
        unit.flashTimer = FLASH_DURATION;
        engine.applyDeathCheck(unit);
      }
    }
  });

  // ── Buff ──
  decretumRegistry.register('buff', (effect, ctx) => {
    const { engine } = ctx;
    const blueUnits = engine.getBattleFactionUnits('blue');
    for (const unit of blueUnits) {
      if (effect.stat === 'atk') unit.stats.atk = Math.floor(unit.stats.atk * (1 + effect.multiplier));
      else if (effect.stat === 'def') unit.stats.def = Math.floor(unit.stats.def * (1 + effect.multiplier));
      else if (effect.stat === 'hp') unit.stats.hp = Math.floor(unit.stats.hp * (1 + effect.multiplier));
      else if (effect.stat === 'agi') unit.stats.agi = Math.floor(unit.stats.agi * (1 + effect.multiplier));
    }
    if (blueUnits.length > 0) {
      const anchor = blueUnits[0].hex;
      engine.floatingTexts.push({
        text: 'BUFFED!',
        hex: { q: anchor.q, r: anchor.r },
        color: '#ffd700', timer: 0.8, duration: 0.8,
      });
    }
  });

  // ── Spawn (militia reinforcements) ──
  decretumRegistry.register('spawn', (effect, ctx) => {
    const { engine } = ctx;
    for (let i = 0; i < effect.count; i++) {
      const hex = findReinforcementHex(engine, 'blue');
      if (!hex) break;
      const unit = engine.addUnit('blue', hex, `Militia ${i + 1}`, effect.unitRole);
      unit.currentHp = Math.floor(unit.stats.hp * 0.6); // militia are weak
    }
  });

  // ── Prevent-death counter ──
  decretumRegistry.register('prevent-death', (effect, ctx) => {
    ctx.engine.preventDeathCount += effect.count;
  });

  // ── Strategic-layer effects: no-op at battle layer ──
  const noop = () => { /* handled elsewhere (store / ui) */ };
  decretumRegistry.register('resource-gain', noop);
  decretumRegistry.register('reveal', noop);
  decretumRegistry.register('event-modifier', noop);
  decretumRegistry.register('upkeep-reduction', noop);
  decretumRegistry.register('debuff', noop);
  decretumRegistry.register('convert-enemy-next-battle', noop);
  decretumRegistry.register('investment-discount', noop);
}

/** Apply a decretum effect by dispatching through the registry. */
export function applyDecretumEffect(
  effect: DecretumEffect,
  ctx: EffectContext,
): void {
  decretumRegistry.apply(effect, ctx);
}
