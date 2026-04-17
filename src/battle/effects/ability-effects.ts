/**
 * Commander ability effect handlers.
 *
 * The commander's tactical ability is dispatched here by name. Each handler
 * reads `ctx.targetUnit` or `ctx.targetHex` as needed (or nothing for
 * immediate abilities like Fury Charge).
 *
 * Adding a new commander ability = write one handler and register it. No
 * edits to `ability-ui.ts` beyond its existing "is targeted" / "empty hex"
 * routing tables.
 */

import { EffectRegistry, type EffectContext } from './EffectRegistry';
import {
  ABILITY_PARTICLE_COUNT, FLASH_DURATION, ROLE_STATS, SHAKE_DURATION,
} from '../battle-config';
import { playSfx } from '../../ui/sound/sfx';

/** Ability effects identified by their in-game display name. */
export type AbilityEffect =
  | { type: 'Miracle' }
  | { type: 'Fury Charge' }
  | { type: 'Turncoat' }
  | { type: 'Buy Reinforcements'; mercIndex: number };

export const abilityRegistry = new EffectRegistry<AbilityEffect>();

export function registerAbilityEffects(): void {
  // ── Miracle (Pope Innocent) — heal ally or smite enemy ──
  abilityRegistry.register('Miracle', (_effect, ctx) => {
    const { engine, targetUnit } = ctx;
    if (!targetUnit) return;

    if (targetUnit.faction === 'blue') {
      // Heal ally to full HP
      targetUnit.currentHp = targetUnit.stats.hp;
      targetUnit.flashTimer = FLASH_DURATION;
      engine.floatingTexts.push({
        text: 'HEALED!', hex: { q: targetUnit.hex.q, r: targetUnit.hex.r },
        color: '#ffd700', timer: 0.8, duration: 0.8,
      });
      engine.spawnParticles(targetUnit.hex, ABILITY_PARTICLE_COUNT, '#ffd700', Math.PI * 2, 25, 1.0);
      playSfx('ability_heal');
    } else {
      // Smite enemy — 2000 damage
      targetUnit.currentHp -= 2000;
      targetUnit.shakeTimer = SHAKE_DURATION;
      targetUnit.flashTimer = FLASH_DURATION;
      engine.floatingTexts.push({
        text: 'SMITE!', hex: { q: targetUnit.hex.q, r: targetUnit.hex.r },
        color: '#ffd700', timer: 0.8, duration: 0.8,
      });
      engine.spawnParticles(targetUnit.hex, ABILITY_PARTICLE_COUNT, '#ffd700', Math.PI * 2, 50, 0.8);
      playSfx('ability_fire');
      engine.applyDeathCheck(targetUnit);
    }
  });

  // ── Fury Charge (Boudicca) — all blue units charge forward 2 hexes ──
  abilityRegistry.register('Fury Charge', (_effect, ctx) => {
    const { engine } = ctx;
    const dir = 1; // blue advances right (+q) in horizontal mode
    const blueUnits = engine.getBattleFactionUnits('blue');

    for (const unit of blueUnits) {
      if (unit.isDying) continue;

      let currentHex = unit.hex;
      let moved = 0;
      for (let step = 0; step < 2; step++) {
        const nextHex = { q: currentHex.q + dir, r: currentHex.r };
        if (!engine.isValidHex(nextHex)) break;

        const occupant = engine.getUnitAt(nextHex);
        if (occupant && !occupant.isDying) {
          if (occupant.faction !== 'blue') {
            // Impact damage on enemy
            occupant.currentHp -= 1000;
            occupant.shakeTimer = SHAKE_DURATION;
            occupant.flashTimer = FLASH_DURATION;
            engine.floatingTexts.push({
              text: 'CHARGE!', hex: { q: occupant.hex.q, r: occupant.hex.r },
              color: '#ff4444', timer: 0.8, duration: 0.8,
            });
            engine.applyDeathCheck(occupant);
            engine.spawnParticles(occupant.hex, ABILITY_PARTICLE_COUNT, '#ff6633', Math.PI, 50, 0.8);
          }
          break; // blocked
        }

        currentHex = nextHex;
        moved++;
      }

      if (moved > 0) engine.moveUnitAlongPath(unit.id, currentHex);
    }

    // Banner at grid center
    const { cols, rows } = engine.config;
    engine.floatingTexts.push({
      text: 'FURY CHARGE!',
      hex: { q: Math.floor(cols / 2), r: Math.floor(rows / 2) },
      color: '#ff4444', timer: 1.0, duration: 1.0,
    });
    playSfx('charge');
  });

  // ── Turncoat (Augustus) — convert enemy to blue at 50% HP ──
  abilityRegistry.register('Turncoat', (_effect, ctx) => {
    const { engine, targetUnit } = ctx;
    if (!targetUnit) return;

    Object.assign(targetUnit, { faction: 'blue' as const });
    targetUnit.currentHp = Math.floor(targetUnit.stats.hp * 0.5);
    targetUnit.pinnedBy = null;  // converted unit is no longer engaged
    targetUnit.flashTimer = FLASH_DURATION;

    engine.floatingTexts.push({
      text: 'TURNCOAT!', hex: { q: targetUnit.hex.q, r: targetUnit.hex.r },
      color: '#4a7cc2', timer: 1.0, duration: 1.0,
    });
    engine.spawnParticles(targetUnit.hex, ABILITY_PARTICLE_COUNT, '#4a7cc2', Math.PI * 2, 30, 1.0);
  });

  // ── Buy Reinforcements (Crassus) — spawn merc at target hex ──
  abilityRegistry.register('Buy Reinforcements', (effect, ctx) => {
    const { engine, targetHex } = ctx;
    if (!targetHex) return;

    const stats = { ...ROLE_STATS.vanguard };
    const unit = engine.addUnit('blue', targetHex, `Mercenary ${effect.mercIndex + 1}`, 'vanguard', stats);
    unit.currentHp = Math.floor(unit.stats.hp * 0.7); // expendable hired troops
    unit.flashTimer = FLASH_DURATION;

    engine.floatingTexts.push({
      text: 'HIRED!', hex: { q: targetHex.q, r: targetHex.r },
      color: '#d4a843', timer: 0.8, duration: 0.8,
    });
  });
}

/** Apply an ability by name. Context carries targetUnit / targetHex as needed. */
export function applyAbility(name: AbilityEffect['type'], ctx: EffectContext, extra?: Partial<AbilityEffect>): void {
  // Build a synthetic effect object — most abilities have no payload beyond type
  const effect = { type: name, ...extra } as AbilityEffect;
  abilityRegistry.apply(effect, ctx);
}
