import { describe, it, expect } from 'vitest';
import { makeBattleArmy, makeBattleState, playRound } from '../battle/engine';
import { FORMATIONS, CENTERS } from '../battle/orders';
import { hasBattleEffect, applyDecretumInBattle } from '../battle/decreta';
import type { BattleState, Rng } from '../battle/types';
import type { Decretum } from '../../items/decretum';
import {
  DECRETUM_MARS, DECRETUM_FORGE, DECRETUM_RIOT, DECRETUM_ORACLE,
  DECRETUM_HEALING, DECRETUM_SPY, DECRETUM_TRIBUNE, DECRETUM_LEGATUS,
  DECRETUM_LEGION, DECRETUM_SENATE, DECRETUM_SUPPLY, STARTER_DECRETUM,
} from '../../../data/decretum-data';

const fixedRng = (rolls: number[]): Rng => {
  let i = 0;
  return { rollDie: () => rolls[i++ % rolls.length] };
};

function makeState(): BattleState {
  const seed = {
    hp: 8000, morale: 10, discipline: 5,
    stats: { charge: 10, harass: 10, push: 10, siege: 10, movement: 10 },
    armorPct: 0, armorName: 'none', ammo: 30, formation: FORMATIONS.battleLine,
  };
  const you = makeBattleArmy('you', { ...seed });
  const enemy = makeBattleArmy('enemy', { ...seed, hp: 9000 });
  return makeBattleState(you, enemy, CENTERS.plain);
}

describe('battle decreta coverage', () => {
  it('every scroll is castable somewhere: hub effect or battle effect', async () => {
    const { toHubEffect } = await import('../../items/decretum-hub');
    for (const d of STARTER_DECRETUM) {
      const hub = toHubEffect(d) !== null;
      const battle = hasBattleEffect(d);
      expect(hub || battle, `${d.id} has no effect anywhere`).toBe(true);
    }
  });

  it('hub-economic scrolls are not battle-castable', () => {
    expect(hasBattleEffect(DECRETUM_SENATE)).toBe(false);
    expect(hasBattleEffect(DECRETUM_SUPPLY)).toBe(false);
  });
});

describe('battle decreta effects', () => {
  it('Mars (+60% atk) scales all attack stats', () => {
    const S = makeState();
    applyDecretumInBattle(S, DECRETUM_MARS);
    expect(S.you.stats.charge).toBe(16);
    expect(S.you.stats.siege).toBe(16);
    expect(S.you.stats.movement).toBe(10); // agility untouched
  });

  it('Forge (+20% def) lowers incoming damage multiplier', () => {
    const S = makeState();
    applyDecretumInBattle(S, DECRETUM_FORGE);
    expect(S.you.dmgTakenMult).toBeCloseTo(0.8);
  });

  it('Riot deals 1500 to the enemy and ~10% friendly fire', () => {
    const S = makeState();
    applyDecretumInBattle(S, DECRETUM_RIOT);
    expect(S.enemy.hp).toBe(7500);
    expect(S.you.hp).toBe(8000 - 150);
  });

  it('Healing restores 30% of maxHp, capped at maxHp', () => {
    const S = makeState();
    S.you.hp = 4000;
    applyDecretumInBattle(S, DECRETUM_HEALING);
    expect(S.you.hp).toBe(4000 + 2400);
  });

  it('Legion spawn adds hp and maxHp', () => {
    const S = makeState();
    applyDecretumInBattle(S, DECRETUM_LEGION);
    expect(S.you.hp).toBe(9000);
    expect(S.you.maxHp).toBe(9000);
  });

  it('Oracle prevents a killing blow once (5% hp floor)', () => {
    const S = makeState();
    applyDecretumInBattle(S, DECRETUM_ORACLE);
    expect(S.you.preventDeath).toBe(1);
    S.you.hp = 1; // about to die from any real hit
    S.enemy.stats.charge = 1000; // guarantee lethal damage
    playRound(S, 'holdLine', fixedRng([6]));
    expect(S.you.hp).toBeGreaterThan(0);
    expect(S.you.preventDeath).toBe(0);
    expect(S.finished).toBe(false);
  });

  it('Spy reveals the enemy intent and the engine honors it', () => {
    const S = makeState();
    applyDecretumInBattle(S, DECRETUM_SPY);
    const predicted = S.nextEnemyOrder;
    expect(predicted).toBeTruthy();
    const { enemyOrder } = playRound(S, 'holdLine', fixedRng([3]));
    expect(enemyOrder).toBe(predicted);
    // reveal persists (count 99): next round is pre-picked again
    expect(S.nextEnemyOrder).toBeTruthy();
  });

  it('Tribune grants 2 rounds of die advantage (rolls twice, keeps best)', () => {
    const S = makeState();
    applyDecretumInBattle(S, DECRETUM_TRIBUNE);
    expect(S.advantageRounds).toBe(2);
    // rolls: you(2), advantage(6), enemy(1) → your die should be the 6
    playRound(S, 'advance', fixedRng([2, 6, 1]));
    expect(S.lastDice.you?.raw).toBe(6);
    expect(S.advantageRounds).toBe(1);
  });

  it('Mandatum Legati converts: enemy loses hp, you gain it', () => {
    const S = makeState();
    const yBefore = S.you.hp, eBefore = S.enemy.hp;
    applyDecretumInBattle(S, DECRETUM_LEGATUS);
    expect(S.enemy.hp).toBeLessThan(eBefore);
    expect(S.you.hp - yBefore).toBe(eBefore - S.enemy.hp);
    expect(S.advantageRounds).toBe(2); // primary favorable-outcome effect
  });

  it('a scroll with no battle effect produces no log lines', () => {
    const S = makeState();
    const lines = applyDecretumInBattle(S, DECRETUM_SENATE as Decretum);
    expect(lines).toHaveLength(0);
  });
});
