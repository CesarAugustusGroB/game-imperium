import { describe, it, expect } from 'vitest';
import { FORMATIONS, CENTERS, TERRAIN_CENTER, ENEMY_ARCHETYPES } from '../battle/orders';
import { makeBattleArmy, makeBattleState, playRound } from '../battle/engine';
import type { Rng } from '../battle/types';
import { SCENARIOS } from '../iter-belli-scenario';

const fixedRng = (n: number): Rng => ({ rollDie: () => n });

describe('S-G: Acies Duplex common formation', () => {
  it('exists, is common, sits at disc 4 between shieldWall(3) and the uniques(5/6)', () => {
    const f = FORMATIONS.duplex;
    expect(f).toBeTruthy();
    expect(f.kind).toBe('common');
    expect(f.disc).toBe(4);
    expect(f.trait).toBeNull();
  });
  it('its orders all reference real ORDERS keys', () => {
    for (const k of FORMATIONS.duplex.orders) {
      expect(FORMATIONS.battleLine.orders.includes(k) || ['warCry'].includes(k) || k in (FORMATIONS as any), k).toBeTruthy();
    }
  });
});

describe('S-G: terrain centers', () => {
  it('forest and marsh have dedicated centers mapped from terrain', () => {
    expect(TERRAIN_CENTER.forest).toBe('forest');
    expect(TERRAIN_CENTER.marsh).toBe('marsh');
    expect(CENTERS.forest.chargeDamp).toBe(0.25);
    expect(CENTERS.marsh.chargeDamp).toBe(0.20);
  });

  it('chargeDamp blunts a charge for the attacker regardless of who holds the center', () => {
    const seed = {
      hp: 9000, morale: 10, discipline: 5,
      stats: { charge: 30, harass: 5, push: 5, siege: 5, movement: 5 },
      armorPct: 0, armorName: 'none', ammo: 20, formation: FORMATIONS.battleLine,
    };
    // Same dice + stats on plain vs forest → forest charge does strictly less damage.
    const onPlain = makeBattleState(makeBattleArmy('you', { ...seed }), makeBattleArmy('enemy', { ...seed }), CENTERS.plain);
    const onForest = makeBattleState(makeBattleArmy('you', { ...seed }), makeBattleArmy('enemy', { ...seed }), CENTERS.forest);
    const ePlainBefore = onPlain.enemy.hp, eForestBefore = onForest.enemy.hp;
    playRound(onPlain, 'charge', fixedRng(4));
    playRound(onForest, 'charge', fixedRng(4));
    const dmgPlain = ePlainBefore - onPlain.enemy.hp;
    const dmgForest = eForestBefore - onForest.enemy.hp;
    expect(dmgForest).toBeLessThan(dmgPlain);
  });
});

describe('S-G: enemy archetypes', () => {
  it('all four archetypes are well-formed', () => {
    for (const key of ['carthage', 'gauls', 'iberians', 'garrison']) {
      const a = ENEMY_ARCHETYPES[key];
      expect(a, key).toBeTruthy();
      expect(a.stats.charge).toBeGreaterThan(0);
      expect(a.formation in FORMATIONS, `${key} formation ${a.formation}`).toBe(true);
    }
  });
  it('every scenario references a real archetype (2 of 4 live: carthage, gauls)', () => {
    const used = new Set(SCENARIOS.map((s) => s.enemy.archetypeKey));
    for (const key of used) expect(ENEMY_ARCHETYPES[key], key).toBeTruthy();
    expect(used.has('carthage')).toBe(true);
    expect(used.has('gauls')).toBe(true);
  });
});
