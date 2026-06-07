import { describe, it, expect } from 'vitest';
import { makeBattleArmy, makeBattleState, playRound } from '../engine';
import { FORMATIONS, ENEMY_ARCHETYPES, CENTERS } from '../orders';
import { enemyChoose } from '../enemy-ai';
import type { BattleState, EnemyArchetype, FormationDef, OrderKey, PowerStats, Rng } from '../types';

// A good PRNG so dice are fair (a naive LCG with `% n` reads low bits and biases results).
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return { rollDie: (n) => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return 1 + Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
  } };
}

// The player uses the SAME AI as the enemy, viewed from the player's seat. This lets us
// test mechanical fairness: a true mirror must be a coin flip, with no side advantage.
const aiPlayer = (s: BattleState): OrderKey =>
  enemyChoose({ ...s, you: s.enemy, enemy: s.you, control: -s.control });

interface YouOver { discipline?: number; stats?: PowerStats; armorPct?: number; armorName?: string; formation?: FormationDef; }

function winRate(youOver: YouOver, enemy: EnemyArchetype, N = 1000): number {
  let wins = 0;
  for (let i = 0; i < N; i++) {
    const rng = mulberry32(60000 + i * 13);
    const you = makeBattleArmy('you', {
      hp: 10000, morale: 10, discipline: 6,
      stats: { charge: 10, harass: 8, push: 16, siege: 5, movement: 9 },
      armorPct: 20, armorName: 'Iron', ammo: 32, formation: FORMATIONS.battleLine,
      ...youOver,
    });
    const en = makeBattleArmy('enemy', enemy);
    const s = makeBattleState(you, en, CENTERS.hill);
    let guard = 0;
    while (!s.finished && guard++ < 30) playRound(s, aiPlayer(s), rng);
    if (s.victory) wins++;
  }
  return (wins / N) * 100;
}

// A mirror of the default player army (identical stats / formation / armor).
const MIRROR: EnemyArchetype = {
  name: 'Mirror', formation: 'battleLine', hp: 10000, morale: 10, disc: 6,
  stats: { charge: 10, harass: 8, push: 16, siege: 5, movement: 9 },
  armorPct: 20, armorName: 'Iron', ammo: 32, fortPct: 0, desc: '',
};

describe('balance regression — structural invariants', () => {
  it('a true mirror (identical armies + identical AI) is a coin flip — no side bias', () => {
    const rate = winRate({}, MIRROR, 1200);
    expect(rate).toBeGreaterThan(40);
    expect(rate).toBeLessThan(60);
  });

  it('discipline is decisive and monotonic', () => {
    const low = winRate({ discipline: 2 }, MIRROR, 800);
    const high = winRate({ discipline: 10 }, MIRROR, 800);
    expect(high).toBeGreaterThan(low + 30); // clear, large gap
    expect(low).toBeLessThan(25);
    expect(high).toBeGreaterThan(75);
  });

  it('a strong, well-equipped army routs a weak foe (Gauls)', () => {
    const rate = winRate(
      { discipline: 10, stats: { charge: 30, harass: 8, push: 20, siege: 5, movement: 9 }, armorPct: 30, armorName: 'Steel' },
      ENEMY_ARCHETYPES.gauls, 600,
    );
    expect(rate).toBeGreaterThan(70);
  });

  it('the enemy AI does not self-destruct (no allOut while shaken) — Carthage is not a free win', () => {
    // Guards the shaken-lock fix: if the AI suicided with allOut again, this would spike toward 100%.
    const rate = winRate({}, ENEMY_ARCHETYPES.carthage, 800);
    expect(rate).toBeLessThan(50);
  });
});
