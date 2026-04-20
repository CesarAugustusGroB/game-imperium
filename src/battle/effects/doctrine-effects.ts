/**
 * Doctrine + Province effect handlers (battle-start layer).
 *
 * Used by `progression-bridge.applyDoctrineAndProvinceEffects` — after units
 * are deployed, every active doctrine / province effect is applied through
 * this registry. Strategic-layer effects (resource-per-spoke, shop-discount,
 * etc.) are no-ops here — they're handled in `game/` stores.
 */

import type { DoctrineEffect } from '../../game/items/doctrine';
import { ALLY_SPAWN_HP_RATIO, MILITIA_SPAWN_HP_RATIO } from '../battle-config';
import { findReinforcementHex } from '../deployment';
import { EffectRegistry, type EffectContext } from './EffectRegistry';

export const doctrineRegistry = new EffectRegistry<DoctrineEffect>();

export function registerDoctrineEffects(): void {
  // ── stat-modifier: multiply damage / armor / maxHp on all blue units ──
  doctrineRegistry.register('stat-modifier', (effect, ctx) => {
    const { engine } = ctx;
    for (const unit of engine.getBattleFactionUnits('blue')) {
      if (effect.stat === 'damage') {
        unit.stats.atk = Math.floor(unit.stats.atk * (1 + effect.multiplier));
      } else if (effect.stat === 'armor') {
        unit.stats.def = Math.floor(unit.stats.def * (1 + effect.multiplier));
      } else if (effect.stat === 'maxHp') {
        unit.stats.hp = Math.floor(unit.stats.hp * (1 + effect.multiplier));
        unit.currentHp = Math.min(unit.currentHp, unit.stats.hp);
      }
    }
  });

  // ── heal-battle-start: heal all blue units at setup ──
  doctrineRegistry.register('heal-battle-start', (effect, ctx) => {
    const { engine } = ctx;
    for (const unit of engine.getBattleFactionUnits('blue')) {
      if (effect.amount === 'full') {
        unit.currentHp = unit.stats.hp;
      } else if (typeof effect.amount === 'object') {
        unit.currentHp = Math.min(unit.stats.hp, Math.floor(unit.stats.hp * effect.amount.percent));
      } else {
        unit.currentHp = Math.min(unit.stats.hp, unit.currentHp + effect.amount);
      }
    }
  });

  // ── free-units: militia reinforcements ──
  doctrineRegistry.register('free-units', (effect, ctx) => {
    const { engine } = ctx;
    for (let i = 0; i < effect.count; i++) {
      const hex = findReinforcementHex(engine, 'blue');
      if (!hex) break;
      const u = engine.addUnit('blue', hex, `Militia ${i + 1}`, effect.unitRole);
      u.currentHp = Math.floor(u.stats.hp * MILITIA_SPAWN_HP_RATIO);
    }
  });

  // ── ally-units: allied reserves ──
  doctrineRegistry.register('ally-units', (effect, ctx) => {
    const { engine } = ctx;
    for (let i = 0; i < effect.count; i++) {
      const hex = findReinforcementHex(engine, 'blue');
      if (!hex) break;
      const u = engine.addUnit('blue', hex, `Allied ${i + 1}`, 'reserve');
      u.currentHp = Math.floor(u.stats.hp * ALLY_SPAWN_HP_RATIO);
    }
  });

  // ── revive: set revive threshold on all blue units ──
  doctrineRegistry.register('revive', (effect, ctx) => {
    const { engine } = ctx;
    for (const unit of engine.getBattleFactionUnits('blue')) {
      unit.reviveThreshold = Math.max(unit.reviveThreshold, effect.hpPercent);
      unit.hasRevived = false;
    }
  });

  // ── Strategic-only effects: no-op at battle layer ──
  const noop = () => { /* handled in game/ stores */ };
  doctrineRegistry.register('resource-per-spoke', noop);
  doctrineRegistry.register('heal-on-kill', noop);
  doctrineRegistry.register('extra-event-choices', noop);
  doctrineRegistry.register('shop-discount', noop);
  doctrineRegistry.register('income-modifier', noop);
  doctrineRegistry.register('upkeep-reduction', noop);
}

/** Apply one doctrine/province effect (used by progression-bridge). */
export function applyDoctrineEffect(effect: DoctrineEffect, ctx: EffectContext): void {
  doctrineRegistry.apply(effect, ctx);
}
