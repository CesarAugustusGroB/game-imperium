import { describe, it, expect } from 'vitest';
import { makeBattleArmy, makeBattleState } from '../engine';
import { resolveOrder } from '../resolver';
import { ORDERS, CENTERS, ENEMY_ARCHETYPES } from '../orders';

const army = (ammo: number) => makeBattleArmy('you', {
  hp: 10000, morale: 10, discipline: 4,
  stats: { charge: 5, harass: 16, push: 5, siege: 2, movement: 5 },
  armorPct: 0, armorName: 'None', ammo, formation: 'openOrder',
} as any);

function harassDamage(ammo: number): number {
  const you = army(ammo);
  const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
  enemy.armorPct = 0; // isolate the ammo effect
  const S = makeBattleState(you, enemy, CENTERS.plain, 0);
  const before = enemy.hp;
  resolveOrder(S, you, enemy, ORDERS.skirmish, 5, ORDERS.holdLine);
  return before - enemy.hp;
}

describe('harass requires ammunition', () => {
  it('a dry volley (ammo 0) deals ~15% of a supplied volley', () => {
    const wet = harassDamage(50);
    const dry = harassDamage(0);
    expect(wet).toBeGreaterThan(0);
    expect(dry / wet).toBeCloseTo(0.15, 1);
  });
  it('supplied harass consumes ammo', () => {
    const you = army(50);
    const enemy = makeBattleArmy('enemy', ENEMY_ARCHETYPES.carthage);
    const S = makeBattleState(you, enemy, CENTERS.plain, 0);
    resolveOrder(S, you, enemy, ORDERS.skirmish, 5, ORDERS.holdLine);
    expect(you.ammo).toBe(50 - (ORDERS.skirmish.ammo ?? 0));
  });
});
