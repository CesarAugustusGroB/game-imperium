/**
 * Decreta in battle — the battle-side mirror of `decretum-hub.ts`.
 *
 * `toHubEffect()` covers the economic scrolls; this module covers the rest:
 * buffs, direct damage, healing, death prevention, intent reveal and the
 * "favorable outcome" advantage. One decretum may be cast per battle (the
 * controller enforces it); casting consumes the scroll from the hand and the
 * cast cost is paid from the campaign pool (gold/iuniores carried on march).
 */

import type { Decretum, DecretumEffect } from '../../items/decretum';
import type { BattleState, RoundLogLine } from './types';
import { enemyChoose } from './enemy-ai';

/** HP granted per spawned unit (mirrors the 500-soldier levy ratio). */
const SPAWN_HP_PER_UNIT = 500;
/** HP stolen per converted enemy unit, capped at 30% of the enemy's current HP. */
const CONVERT_HP_PER_UNIT = 500;
/** A "single unit" for targeted heals — the flat cohort HP. */
const SINGLE_UNIT_HP = 1000;
/** Area damage splashes back on your own line (Riot: "beware friendly fire"). */
const AREA_FRIENDLY_FIRE = 0.1;
/** Rounds of die advantage granted by a "favorable outcome" scroll. */
const ADVANTAGE_ROUNDS = 2;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Effect types this module can resolve inside a battle. */
function effectWorksInBattle(e: DecretumEffect): boolean {
  switch (e.type) {
    case 'buff':
    case 'debuff':
    case 'damage':
    case 'heal':
    case 'spawn':
    case 'prevent-death':
    case 'reveal':
    case 'event-modifier':
    case 'convert-enemy-next-battle':
      return true;
    default:
      return false; // resource-gain / upkeep-reduction / investment-discount → hub
  }
}

/** True if casting this scroll inside a battle does something. */
export function hasBattleEffect(d: Decretum): boolean {
  if (effectWorksInBattle(d.effect)) return true;
  return (d.extraEffects ?? []).some(effectWorksInBattle);
}

/** Apply one effect to the battle state, returning log lines. */
function applyOne(S: BattleState, e: DecretumEffect): RoundLogLine[] {
  const you = S.you, enemy = S.enemy;
  switch (e.type) {
    case 'buff':
    case 'debuff': {
      const target = e.type === 'buff' ? you : enemy;
      const m = e.type === 'buff' ? e.multiplier : -e.multiplier;
      const who = e.type === 'buff' ? 'all' : 'enemy';
      switch (e.stat) {
        case 'atk': {
          target.stats.charge = Math.round(target.stats.charge * (1 + m));
          target.stats.harass = Math.round(target.stats.harass * (1 + m));
          target.stats.push = Math.round(target.stats.push * (1 + m));
          target.stats.siege = Math.round(target.stats.siege * (1 + m));
          return [{ text: `Decretum: ${who} attacks ${m >= 0 ? '+' : ''}${Math.round(m * 100)}% for the battle.`, kind: 'mor' }];
        }
        case 'def': {
          target.dmgTakenMult = clamp((target.dmgTakenMult ?? 1) * (1 - m), 0.25, 2);
          return [{ text: `Decretum: ${who === 'enemy' ? 'enemy ' : ''}incoming damage ${m >= 0 ? 'reduced' : 'increased'} ${Math.abs(Math.round(m * 100))}% for the battle.`, kind: 'mor' }];
        }
        case 'agi': {
          target.stats.movement = Math.round(target.stats.movement * (1 + m));
          return [{ text: `Decretum: ${who === 'enemy' ? 'enemy ' : ''}movement ${m >= 0 ? '+' : ''}${Math.round(m * 100)}%.`, kind: 'mor' }];
        }
        case 'hp': {
          const healed = Math.round(target.maxHp * Math.abs(m));
          target.hp = Math.min(target.maxHp, target.hp + healed);
          return [{ text: `Decretum: ${healed} HP restored.`, kind: 'mor' }];
        }
      }
      return [];
    }
    case 'damage': {
      const dmg = e.amount;
      enemy.hp = Math.max(0, enemy.hp - dmg);
      const lines: RoundLogLine[] = [{ text: `Decretum strikes the enemy for ${dmg}.`, kind: 'crit' }];
      if (e.target === 'area') {
        const splash = Math.round(dmg * AREA_FRIENDLY_FIRE);
        you.hp = Math.max(1, you.hp - splash);
        lines.push({ text: `The chaos costs your own line ${splash}.`, kind: 'en' });
      }
      return lines;
    }
    case 'heal': {
      const healed = e.target === 'single'
        ? Math.min(Math.round(e.amount * SINGLE_UNIT_HP), you.maxHp - you.hp)
        : Math.min(Math.round(e.amount * you.maxHp), you.maxHp - you.hp);
      you.hp += Math.max(0, healed);
      return [{ text: `Decretum heals ${Math.max(0, healed)} HP.`, kind: 'mor' }];
    }
    case 'spawn': {
      const hp = e.count * SPAWN_HP_PER_UNIT;
      you.hp += hp; you.maxHp += hp;
      return [{ text: `Decretum: ${e.count} ${e.unitRole} band${e.count === 1 ? '' : 's'} join the line (+${hp}).`, kind: 'mor' }];
    }
    case 'prevent-death': {
      you.preventDeath = (you.preventDeath ?? 0) + e.count;
      return [{ text: `Decretum: fate will spare your legion ${e.count === 1 ? 'once' : `${e.count} times`}.`, kind: 'mor' }];
    }
    case 'reveal': {
      S.revealRounds = Math.min(99, (S.revealRounds ?? 0) + e.count);
      S.nextEnemyOrder = enemyChoose(S);
      return [{ text: `Decretum: the enemy's intent is revealed (${e.count >= 99 ? 'whole battle' : `${e.count} round${e.count === 1 ? '' : 's'}`}).`, kind: 'mor' }];
    }
    case 'event-modifier': {
      S.advantageRounds = (S.advantageRounds ?? 0) + ADVANTAGE_ROUNDS;
      return [{ text: `Decretum: fortune favors you — advantage on your next ${ADVANTAGE_ROUNDS} rolls.`, kind: 'mor' }];
    }
    case 'convert-enemy-next-battle': {
      const steal = Math.min(e.count * CONVERT_HP_PER_UNIT, Math.round(enemy.hp * 0.3));
      enemy.hp = Math.max(1, enemy.hp - steal);
      you.hp += steal; you.maxHp += steal;
      return [{ text: `Decretum: ${e.count} enemy band${e.count === 1 ? '' : 's'} defect to your side (+${steal}).`, kind: 'crit' }];
    }
    default:
      return [];
  }
}

/**
 * Apply a decretum's primary + extra effects to the battle.
 * Returns the log lines (empty if the scroll has no battle effect).
 */
export function applyDecretumInBattle(S: BattleState, d: Decretum): RoundLogLine[] {
  const lines: RoundLogLine[] = [];
  if (effectWorksInBattle(d.effect)) lines.push(...applyOne(S, d.effect));
  for (const ex of d.extraEffects ?? []) {
    if (effectWorksInBattle(ex)) lines.push(...applyOne(S, ex));
  }
  if (lines.length > 0) lines.unshift({ text: `${d.name} is cast.`, kind: 'head' });
  return lines;
}
