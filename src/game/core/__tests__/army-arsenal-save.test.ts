import { describe, it, expect } from 'vitest';
import { normalizeArmySnapshot } from '../meta-save';

const base = { cohorts: [], supplies: 10 } as any;

describe('normalizeArmySnapshot persists arsenal fields', () => {
  it('keeps a valid armor tier + ammo', () => {
    const out = normalizeArmySnapshot({ ...base, armorMaterial: 'steel', ammunition: 40 })!;
    expect(out.armorMaterial).toBe('steel');
    expect(out.ammunition).toBe(40);
  });
  it('defaults a missing/invalid armor tier to copper and clamps ammo ≥ 0', () => {
    const out = normalizeArmySnapshot({ ...base, armorMaterial: 'mithril', ammunition: -5 })!;
    expect(out.armorMaterial).toBe('copper');
    expect(out.ammunition).toBe(0);
  });
  it('leaves ammo undefined when absent (uses runtime default later)', () => {
    const out = normalizeArmySnapshot({ ...base })!;
    expect(out.ammunition).toBeUndefined();
  });
});
