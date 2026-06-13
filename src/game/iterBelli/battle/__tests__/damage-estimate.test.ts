import { describe, it, expect } from 'vitest';
import { resolveOrder, orderDamageAtDie, expectedDie, centerTier } from '../resolver';
import { ORDERS, CENTERS } from '../orders';
import type { BattleArmy, BattleState } from '../types';

const mkArmy = (side: 'you' | 'enemy', over: Partial<BattleArmy> = {}): BattleArmy => ({
  name: side, side, hp: 10000, maxHp: 10000, morale: 10, discipline: 6,
  stats: { charge: 10, harass: 8, push: 16, siege: 5, movement: 9 }, armorPct: 0, armorName: '-',
  fortPct: 0, fortName: null, ammo: 32, maxAmmo: 32,
  formation: { name: '', kind: 'common', disc: 2, trait: null, orders: [], desc: '' },
  encircled: false, encircleTurns: 0, drums: 0, guardMult: 1, defendedLast: false, retreated: false, strengthPct: 100, ...over,
});
const mkState = (you: BattleArmy, enemy: BattleArmy, control = 0): BattleState => ({
  you, enemy, round: 0, control, center: CENTERS.plain, finished: false, victory: null, endMsg: '',
  lastDice: { you: null, enemy: null },
});

/** Run an order on a clone and report the actual HP it removed from the defender. */
function actualDamage(orderKey: keyof typeof ORDERS, die: number, enemyOver: Partial<BattleArmy> = {}): number {
  const you = mkArmy('you'), enemy = mkArmy('enemy', enemyOver);
  const s = mkState(you, enemy);
  const before = enemy.hp;
  resolveOrder(s, you, enemy, ORDERS[orderKey], die, ORDERS.advance);
  return before - enemy.hp;
}

/** Estimate for the same order/die on a fresh, unmutated state. */
function estimate(orderKey: keyof typeof ORDERS, die: number, enemyOver: Partial<BattleArmy> = {}): number {
  const you = mkArmy('you'), enemy = mkArmy('enemy', enemyOver);
  const s = mkState(you, enemy);
  return orderDamageAtDie(s, you, enemy, ORDERS[orderKey], die);
}

describe('damage estimate mirrors the resolver (plan S-I — no lying tooltips)', () => {
  const DIE = 5;

  it('push: estimate equals the resolver damage at a fixed die', () => {
    expect(estimate('advance', DIE)).toBeCloseTo(actualDamage('advance', DIE), 4);
  });

  it('push vs armored defender: estimate tracks mitigation', () => {
    expect(estimate('advance', DIE, { armorPct: 30, fortPct: 20 }))
      .toBeCloseTo(actualDamage('advance', DIE, { armorPct: 30, fortPct: 20 }), 4);
  });

  it('harass: estimate equals the resolver damage at a fixed die', () => {
    expect(estimate('skirmish', DIE)).toBeCloseTo(actualDamage('skirmish', DIE), 4);
  });

  it('siege: estimate equals the resolver damage (ignores armor/fort)', () => {
    expect(estimate('siege', DIE, { armorPct: 30, fortPct: 35 }))
      .toBeCloseTo(actualDamage('siege', DIE, { armorPct: 30, fortPct: 35 }), 4);
  });

  it('expectedDie is (1+faces)/2 with faces = 6 + center tier', () => {
    const you = mkArmy('you'), enemy = mkArmy('enemy');
    const s = mkState(you, enemy, 0);
    expect(expectedDie(s, 'you')).toBeCloseTo((1 + (6 + centerTier(0, 'you'))) / 2, 6);
  });

  it('pure-morale and charge orders return no flat estimate (0)', () => {
    const you = mkArmy('you'), enemy = mkArmy('enemy');
    const s = mkState(you, enemy);
    expect(orderDamageAtDie(s, you, enemy, ORDERS.charge, DIE)).toBe(0);
    // a pure morale order (no stat/mult) — rally/drums
    const moraleOrder = Object.values(ORDERS).find((o) => o.sub === 'moral' && !o.mult);
    if (moraleOrder) expect(orderDamageAtDie(s, you, enemy, moraleOrder, DIE)).toBe(0);
  });
});
