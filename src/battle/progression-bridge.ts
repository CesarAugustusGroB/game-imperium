/**
 * Progression → Battle integration.
 *
 * Every effect the progression system layers onto a freshly-deployed battle
 * (threat scaling, commander perks, doctrine/province effects, crusade,
 * war cry, mandatum conversions) lives here behind a single entry point:
 * `applyProgressionEffects(state)`.
 *
 * This is the **only** boundary between progression state (signals / stores)
 * and the battle module — the battle module does not read progression signals
 * directly anywhere else.
 */

import type { BattleState } from './battle-state';
import {
  selectedCommander, veteranStacks, allianceCount, threatLevel,
  globalSeason, MAX_SEASONS, battlesWon,
} from '../game/core/game-state';
import {
  VETERAN_BONUS_PER_STACK, VETERAN_SOFT_CAP_STACKS, VETERAN_BONUS_ABOVE_CAP,
  ALLY_SPAWN_HP_RATIO, MILITIA_SPAWN_HP_RATIO, WAR_CRY_DAMAGE_BONUS,
} from './battle-config';
import { findReinforcementHex } from './deployment';
import { getActiveEffects } from '../game/items/doctrine-store';
import type { DoctrineEffect } from '../game/items/doctrine';
import { getProvinceEffects, provinces } from '../game/province/province-store';
import { consumeCrusadeBattle, warCryActive, pendingEnemyConversions } from '../game/progression/strategic-store';
import { isFinalBattle } from './index';

/** Apply every progression-driven effect on top of a freshly-deployed BattleState. */
export function applyProgressionEffects(state: BattleState): void {
  applyThreatScaling(state);
  applyCommanderPerks(state);
  applyDoctrineAndProvinceEffects(state);
  applyCrusadeBonus(state);
  applyWarCryBonus(state);
  applyMandatumConversions(state);
}

/** Recompute whether the current battle is the final invasion. Sets the signal. */
export function computeIsFinalBattle(): boolean {
  const value = globalSeason.value >= MAX_SEASONS;
  isFinalBattle.value = value;
  return value;
}

// ── Threat scaling ──

/** S15-04: +5%/threat level HP+ATK to all red units + final-invasion boss multiplier. */
function applyThreatScaling(state: BattleState): void {
  const threat = threatLevel.value;

  const statMultiplier = 1 + (threat * 0.05);
  if (statMultiplier > 1) {
    for (const unit of state.getBattleFactionUnits('red')) {
      unit.stats = { ...unit.stats };
      unit.stats.hp = Math.floor(unit.stats.hp * statMultiplier);
      unit.stats.atk = Math.floor(unit.stats.atk * statMultiplier);
      unit.currentHp = unit.stats.hp;
    }
  }

  if (isFinalBattle.value) {
    const provinceCount = provinces.value.length;
    const allies = allianceCount.value;
    const bossMultiplier = Math.max(1.3, Math.min(2.5,
      1.5
      + (provinceCount * 0.05)
      - (allies * 0.05)
      - (battlesWon.value * 0.03)
      + (Math.max(0, threat - 15) * 0.02),
    ));
    for (const unit of state.getBattleFactionUnits('red')) {
      unit.stats.hp = Math.floor(unit.stats.hp * bossMultiplier);
      unit.stats.atk = Math.floor(unit.stats.atk * bossMultiplier);
      unit.currentHp = unit.stats.hp;
    }
  }
}

// ── Commander perks ──

/** Boudicca veteran bonus + Augustus ally spawn (legacy reserve-area placement). */
function applyCommanderPerks(state: BattleState): void {
  // Boudicca — veteran stacks boost blue damage
  if (selectedCommander.value?.id === 'boudicca') {
    const stacks = veteranStacks.value;
    const capped = Math.min(stacks, VETERAN_SOFT_CAP_STACKS);
    const excess = Math.max(0, stacks - VETERAN_SOFT_CAP_STACKS);
    state.veteranBonus = capped * VETERAN_BONUS_PER_STACK + excess * VETERAN_BONUS_ABOVE_CAP;
  }

  // Augustus — extra allied units per alliance (up to 4)
  if (selectedCommander.value?.id === 'augustus') {
    const extraUnits = Math.min(allianceCount.value, 4);
    for (let i = 0; i < extraUnits; i++) {
      const hex = findReinforcementHex(state, 'blue');
      if (!hex) break;
      const unit = state.addUnit('blue', hex, `Allied ${i + 1}`, 'reserve');
      unit.currentHp = Math.floor(unit.stats.hp * ALLY_SPAWN_HP_RATIO);
    }
  }
}

// ── Doctrines + provinces ──

/** Apply all active Doctrine and Province effects at battle start. */
function applyDoctrineAndProvinceEffects(state: BattleState): void {
  const effects: DoctrineEffect[] = [...getActiveEffects(), ...getProvinceEffects()];

  for (const effect of effects) {
    switch (effect.type) {
      case 'stat-modifier': {
        for (const unit of state.getBattleFactionUnits('blue')) {
          if (effect.stat === 'damage') unit.stats.atk = Math.floor(unit.stats.atk * (1 + effect.multiplier));
          else if (effect.stat === 'armor') unit.stats.def = Math.floor(unit.stats.def * (1 + effect.multiplier));
          else if (effect.stat === 'maxHp') {
            unit.stats.hp = Math.floor(unit.stats.hp * (1 + effect.multiplier));
            unit.currentHp = Math.min(unit.currentHp, unit.stats.hp);
          }
        }
        break;
      }
      case 'heal-battle-start': {
        for (const unit of state.getBattleFactionUnits('blue')) {
          if (effect.amount === 'full') {
            unit.currentHp = unit.stats.hp;
          } else if (typeof effect.amount === 'object') {
            unit.currentHp = Math.min(unit.stats.hp, Math.floor(unit.stats.hp * effect.amount.percent));
          } else {
            unit.currentHp = Math.min(unit.stats.hp, unit.currentHp + effect.amount);
          }
        }
        break;
      }
      case 'free-units': {
        for (let i = 0; i < effect.count; i++) {
          const hex = findReinforcementHex(state, 'blue');
          if (!hex) break;
          const u = state.addUnit('blue', hex, `Militia ${i + 1}`, effect.unitRole);
          u.currentHp = Math.floor(u.stats.hp * MILITIA_SPAWN_HP_RATIO);
        }
        break;
      }
      case 'ally-units': {
        for (let i = 0; i < effect.count; i++) {
          const hex = findReinforcementHex(state, 'blue');
          if (!hex) break;
          const u = state.addUnit('blue', hex, `Allied ${i + 1}`, 'reserve');
          u.currentHp = Math.floor(u.stats.hp * ALLY_SPAWN_HP_RATIO);
        }
        break;
      }
      case 'revive': {
        for (const unit of state.getBattleFactionUnits('blue')) {
          unit.reviveThreshold = Math.max(unit.reviveThreshold, effect.hpPercent);
          unit.hasRevived = false;
        }
        break;
      }
      default:
        break;
    }
  }
}

// ── Crusade / War Cry / Mandatum ──

/** S7-12: Call Crusade — +N% damage for N battles. */
function applyCrusadeBonus(state: BattleState): void {
  const crusadeBonus = consumeCrusadeBattle();
  if (crusadeBonus > 0) {
    for (const unit of state.getBattleFactionUnits('blue')) {
      unit.stats.atk = Math.floor(unit.stats.atk * (1 + crusadeBonus));
    }
  }
}

/** S7-13: Boudicca's War Cry — +25% ATK to all blue units (first-strike advantage). */
function applyWarCryBonus(state: BattleState): void {
  if (warCryActive.value) {
    warCryActive.value = false;
    for (const unit of state.getBattleFactionUnits('blue')) {
      unit.stats.atk = Math.floor(unit.stats.atk * (1 + WAR_CRY_DAMAGE_BONUS));
    }
  }
}

/** S9-03: Mandatum Legati — convert weakest red unit(s) to blue at 50% HP. */
function applyMandatumConversions(state: BattleState): void {
  const conversions = pendingEnemyConversions.value;
  if (conversions <= 0) return;

  pendingEnemyConversions.value = 0;
  const redUnits = state.getBattleFactionUnits('red').filter(u => !u.isDying);
  for (let i = 0; i < Math.min(conversions, redUnits.length); i++) {
    const weakest = redUnits.reduce((a, b) => a.stats.hp <= b.stats.hp ? a : b);
    Object.assign(weakest, { faction: 'blue' as const });
    weakest.currentHp = Math.floor(weakest.stats.hp * 0.5);
    redUnits.splice(redUnits.indexOf(weakest), 1);
  }
}
