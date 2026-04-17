/**
 * Legate trait effect handlers.
 *
 * Used at spawn time: after a faction's cohorts are placed, each trait on
 * the attached Legate runs its effect through this registry. `faction` in
 * the context indicates which side the trait applies to.
 */

import type { LegateEffect } from '../../game/army/legate';
import { EffectRegistry, type EffectContext } from './EffectRegistry';

export const legateRegistry = new EffectRegistry<LegateEffect>();

export function registerLegateEffects(): void {
  // ── stat-bonus: multiply a stat on a role (or 'all') ──
  legateRegistry.register('stat-bonus', (effect, ctx) => {
    const { engine, faction } = ctx;
    if (!faction) return;
    const units = engine.getBattleFactionUnits(faction);
    for (const unit of units) {
      if (effect.target !== 'all' && unit.role !== effect.target) continue;
      const old = unit.stats[effect.stat];
      const next = Math.max(1, Math.floor(old * (1 + effect.multiplier)));
      unit.stats[effect.stat] = next;
      if (effect.stat === 'hp') {
        // Raise current HP in lockstep so the bonus is visible immediately
        unit.currentHp = next;
      }
    }
  });

  // ── lieutenant-preset: set blue's starting lieutenant order ──
  legateRegistry.register('lieutenant-preset', (effect, ctx) => {
    const { engine, faction } = ctx;
    // Lieutenant orders only govern the player faction.
    if (faction === 'blue') engine.setLieutenantOrder(effect.order);
  });

  // ── random-rally: pick one random unit and boost all stats ──
  legateRegistry.register('random-rally', (effect, ctx) => {
    const { engine, faction } = ctx;
    if (!faction) return;
    const units = engine.getBattleFactionUnits(faction);
    if (units.length === 0) return;
    const pick = units[Math.floor(Math.random() * units.length)];
    pick.stats.atk = Math.max(1, Math.floor(pick.stats.atk * (1 + effect.multiplier)));
    pick.stats.def = Math.max(0, Math.floor(pick.stats.def * (1 + effect.multiplier)));
    pick.stats.hp  = Math.max(1, Math.floor(pick.stats.hp  * (1 + effect.multiplier)));
    pick.stats.agi = Math.max(1, Math.floor(pick.stats.agi * (1 + effect.multiplier)));
    pick.currentHp = pick.stats.hp;
  });
}

/** Apply one Legate trait effect to `faction`'s units. */
export function applyLegateEffect(effect: LegateEffect, ctx: EffectContext): void {
  legateRegistry.apply(effect, ctx);
}
