import { describe, it, expect } from 'vitest';
import {
  INVESTMENT_DATA, SYNERGY_DATA, getActiveSynergies, calculatePWG,
  getUnrestModifier, createProvince,
} from '../province';

const prov = (terrain: string, invs: Array<{ type: string; level: number }>) =>
  createProvince('Test', { terrain, investments: invs } as any);

describe('S-E: the three new buildings exist and complete dead synergies', () => {
  it('forge, sacred_grove and mine are registered buildings with 3 levels', () => {
    for (const t of ['forge', 'sacred_grove', 'mine'] as const) {
      expect(INVESTMENT_DATA[t], t).toBeTruthy();
      expect(INVESTMENT_DATA[t].levels).toHaveLength(3);
    }
  });

  it('every synergy now references only registered buildings', () => {
    const slugs = new Set(Object.keys(INVESTMENT_DATA));
    for (const syn of SYNERGY_DATA) {
      expect(slugs.has(syn.buildingA), `${syn.label} A=${syn.buildingA}`).toBe(true);
      expect(slugs.has(syn.buildingB), `${syn.label} B=${syn.buildingB}`).toBe(true);
    }
  });

  it('Basilica + Sacred Grove → Religious Harmony reduces unrest by 5', () => {
    const without = prov('forest', [{ type: 'basilica', level: 1 }]);
    const withGrove = prov('forest', [{ type: 'basilica', level: 1 }, { type: 'sacred_grove', level: 1 }]);
    expect(getActiveSynergies(withGrove).some(s => s.label === 'Religious Harmony')).toBe(true);
    // sacred_grove L1 itself gives -5 unrest; the synergy adds another -5
    expect(getUnrestModifier(withGrove) - getUnrestModifier(without)).toBe(-5 - 5);
  });

  it('Market + Mine → Resource Commerce is an active synergy', () => {
    const both = prov('hills', [{ type: 'market', level: 1 }, { type: 'mine', level: 1 }]);
    expect(getActiveSynergies(both).some(s => s.label === 'Resource Commerce')).toBe(true);
  });

  it('Mine contributes wealth growth (PWG)', () => {
    const base = prov('hills', []);
    const mine3 = prov('hills', [{ type: 'mine', level: 3 }]);
    expect(calculatePWG(mine3) - calculatePWG(base)).toBe(4);
  });

  it('Castrum + Forge forms the Military-Industrial recruit-discount synergy', () => {
    const both = prov('hills', [{ type: 'castrum', level: 1 }, { type: 'forge', level: 1 }]);
    const syn = getActiveSynergies(both).find(s => s.label === 'Military-Industrial');
    expect(syn).toBeTruthy();
    expect(syn!.bonus).toEqual({ type: 'unit-cost-discount', percent: 10 });
  });
});

describe('S-E: empire recruit discount wiring', () => {
  it('getEmpireRecruitDiscount sums active Military-Industrial synergies (cap 50)', async () => {
    const { provinces, getEmpireRecruitDiscount } = await import('../province-store');
    provinces.value = [
      prov('hills', [{ type: 'castrum', level: 1 }, { type: 'forge', level: 1 }]),
      prov('plains', [{ type: 'market', level: 1 }]), // no synergy
    ];
    expect(getEmpireRecruitDiscount()).toBe(10);
    provinces.value = [];
    expect(getEmpireRecruitDiscount()).toBe(0);
  });
});
