import { describe, it, expect, beforeEach } from 'vitest';
import { conquerProvince, provinces } from '../province-store';
import type { ResourceType } from '../../core/commander';

// conquerProvince is the victory side-effect of EndgameCard.returnToHub (the
// conquest step). It was untested; this covers the deterministic parts: the
// per-spoke income scaling and the province being added to the run.
beforeEach(() => { provinces.value = []; });

const gains = (g: number, i: number): Record<ResourceType, number> =>
  ({ gold: g, iuniores: i } as Record<ResourceType, number>);

describe('conquerProvince (Result → Hub conquest step)', () => {
  it('adds a named province to the run and returns it', () => {
    const p = conquerProvince('Lusitania', gains(4, 2), 1);
    expect(provinces.value).toHaveLength(1);
    expect(provinces.value[0].id).toBe(p.id);
    expect(p.name).toBe('Lusitania');
  });

  it('scales one-time gains into a per-spoke income rate (÷ duration, min 1)', () => {
    const fast = conquerProvince('A', gains(4, 2), 1);   // duration 1 → no scaling
    expect(fast.baseIncome.gold).toBe(4);
    expect(fast.baseIncome.iuniores).toBe(2);

    provinces.value = [];
    const slow = conquerProvince('B', gains(8, 2), 4);    // ÷4 → gold 2, iuniores round(0.5)→1 (floored at 1)
    expect(slow.baseIncome.gold).toBe(2);
    expect(slow.baseIncome.iuniores).toBe(1);
  });

  it('honours a terrain override', () => {
    const p = conquerProvince('C', gains(3, 1), 1, { terrain: 'plains', tradeGood: 'grain' });
    expect(p.terrain).toBe('plains');
    expect(p.tradeGood).toBe('grain');
  });

  it('each conquest adds a distinct province', () => {
    conquerProvince('One', gains(2, 1), 1);
    conquerProvince('Two', gains(2, 1), 1);
    expect(provinces.value).toHaveLength(2);
    expect(new Set(provinces.value.map((p) => p.id)).size).toBe(2);
  });
});
