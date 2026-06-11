import { describe, it, expect, beforeEach } from 'vitest';
import { healMercenaryWithGold, healCohortInRoster, getMercHealGoldCost } from '../army-replenishment';
import { preparedArmy } from '../../progression/strategic-store';
import { gold, iuniores } from '../../core/resources';
import { MERC_HEAL_GOLD_FRACTION } from '../../../config/game-config';

function cohort(o: Partial<any>): any {
  return {
    id: o.id ?? 'c', instanceId: o.instanceId ?? 'c#1', name: o.name ?? 'Merc',
    role: 'vanguard', mercenary: o.mercenary ?? true, aurumCost: o.aurumCost ?? 200,
    stats: { hp: 1000, charge: 5, harass: 5, push: 5, siege: 0, movement: 5 },
    currentHp: o.currentHp ?? 1000, outOfAction: o.outOfAction ?? false,
  };
}
function setArmy(cohorts: any[]) {
  preparedArmy.value = { id: 0, owner: 'rome', name: 'L', size: 0, cohorts, legateId: null,
    supplies: 0, armorMaterial: 'copper', ammunition: 0, provinceIndex: 0,
    targetProvinceIndex: null, progress: 0, path: [], inCombat: false, combatTarget: null, lastRoll: 0 } as any;
}

beforeEach(() => { preparedArmy.value = null; gold.value = 0; iuniores.value = 0; });

describe('mercenary gold heal', () => {
  it('getMercHealGoldCost = fraction of recruit cost scaled by missing HP', () => {
    setArmy([cohort({ aurumCost: 200, currentHp: 500 })]); // 50% missing
    // 200 * 0.5 * 0.5 = 50
    expect(getMercHealGoldCost(0)).toBe(Math.round(200 * MERC_HEAL_GOLD_FRACTION * 0.5));
    expect(getMercHealGoldCost(0)).toBe(50);
  });

  it('heals a damaged mercenary with gold and spends it', () => {
    setArmy([cohort({ aurumCost: 200, currentHp: 500 })]);
    gold.value = 100;
    const r = healMercenaryWithGold(0);
    expect(r).not.toBeNull();
    // full heal → currentHp is cleared to undefined (the "at max" convention)
    expect(preparedArmy.value!.cohorts[0].currentHp ?? 1000).toBe(1000);
    expect(gold.value).toBe(50); // 50 spent
  });

  it('applies a proportional partial heal when gold is short', () => {
    setArmy([cohort({ aurumCost: 200, currentHp: 500 })]); // full heal costs 50
    gold.value = 25; // half the cost → ~half the missing 500 HP
    const r = healMercenaryWithGold(0);
    expect(r).not.toBeNull();
    expect(gold.value).toBe(0);
    expect(preparedArmy.value!.cohorts[0].currentHp).toBe(500 + 250);
  });

  it('returns null for a citizen cohort (they use iuniores)', () => {
    setArmy([cohort({ mercenary: false, currentHp: 500 })]);
    gold.value = 100;
    expect(healMercenaryWithGold(0)).toBeNull();
    expect(gold.value).toBe(100); // untouched
  });

  it('returns null with no gold, or when already at full HP', () => {
    setArmy([cohort({ currentHp: 500 })]);
    expect(healMercenaryWithGold(0)).toBeNull(); // gold 0
    gold.value = 100;
    setArmy([cohort({ currentHp: 1000 })]);
    expect(healMercenaryWithGold(0)).toBeNull(); // full HP
  });

  it('healCohortInRoster still refuses mercenaries (iuniores path)', () => {
    setArmy([cohort({ mercenary: true, currentHp: 500 })]);
    iuniores.value = 1000;
    expect(healCohortInRoster(0)).toBeNull();
  });
});
