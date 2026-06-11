import { describe, it, expect, afterEach } from 'vitest';
import {
  createProvince, calculateFoodProduction, calculatePWG,
  getProvinceExpenses, setUpkeepReductionFn, tickFamine,
} from '../province';
import { ALL_FEATURES } from '../../../data/province-features';

const prov = (o: Partial<ReturnType<typeof createProvince>>) =>
  createProvince('Test', { terrain: 'farmland', tradeGood: undefined, ...o } as any);

afterEach(() => setUpkeepReductionFn(() => 0));

describe('S-C: building/feature honesty', () => {
  it('Villa L3 doubles the farmland terrain yield', () => {
    const noVilla = prov({ terrain: 'farmland', investments: [] });
    const villa3 = prov({ terrain: 'farmland', investments: [{ type: 'villa', level: 3 }] as any });
    // farmland terrainFood = 3; Villa L3 adds another +3 on top of its own foodBonus (3)
    expect(calculateFoodProduction(villa3) - calculateFoodProduction(noVilla)).toBe(3 + 3);
  });

  it('Villa L3 does NOT double non-farmland terrain', () => {
    const villa3Plains = prov({ terrain: 'plains', investments: [{ type: 'villa', level: 3 }] as any });
    const noVillaPlains = prov({ terrain: 'plains', investments: [] });
    // only Villa's own +3 foodBonus, no terrain doubling
    expect(calculateFoodProduction(villa3Plains) - calculateFoodProduction(noVillaPlains)).toBe(3);
  });

  it('Market L3 grants +5 PWG (was +4 — the +1 "exchange rates" is now real wealth growth)', () => {
    const base = prov({ terrain: 'plains', investments: [] });
    const market3 = prov({ terrain: 'plains', investments: [{ type: 'market', level: 3 }] as any });
    expect(calculatePWG(market3) - calculatePWG(base)).toBe(5);
  });

  it('doctrine upkeep-reduction lowers province expenses', () => {
    const p = prov({ baseExpenses: 4, investments: [{ type: 'market', level: 2 }] as any });
    const full = getProvinceExpenses(p);
    setUpkeepReductionFn(() => 50);
    expect(getProvinceExpenses(p)).toBe(Math.floor(full * 0.5));
  });

  it('famine-immunity feature keeps the famine timer at 0 even on deficit', () => {
    const feature = ALL_FEATURES.find(f => f.special?.type === 'famine-immunity');
    expect(feature, 'a famine-immunity feature exists').toBeTruthy();
    // desert produces no terrain food → guaranteed deficit at high population
    const immune = prov({ terrain: 'desert', population: 9, famineTimer: 0, uniqueFeature: feature } as any);
    expect(tickFamine(immune).famineTimer).toBe(0);
    // a matching province WITHOUT the feature does enter famine
    const exposed = prov({ terrain: 'desert', population: 9, famineTimer: 0, uniqueFeature: undefined } as any);
    expect(tickFamine(exposed).famineTimer).toBe(1);
  });
});

describe('S-C: no visible trade-good lie', () => {
  it('Horses no longer claims a non-existent cavalry battle bonus', () => {
    // the cavalry-bonus special was removed; Horses now gives a real +2 iuniores
    const horses = prov({ terrain: 'plains' });
    // imported lazily to avoid a top-level data import churn
    return import('../../../data/trade-goods').then(({ TRADE_GOOD_DATA }) => {
      expect(TRADE_GOOD_DATA.horses.special).toBeNull();
      expect(TRADE_GOOD_DATA.horses.flatIuniores).toBe(2);
      void horses;
    });
  });
});
