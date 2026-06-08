import { describe, it, expect } from 'vitest';
import { ARMOR_LADDER, nextArmorTier, armorUpgradeCost } from '../arsenal';

describe('arsenal armor ladder', () => {
  it('climbs copper→bronze→iron→steel then stops', () => {
    expect(ARMOR_LADDER).toEqual(['copper', 'bronze', 'iron', 'steel']);
    expect(nextArmorTier('copper')).toBe('bronze');
    expect(nextArmorTier('iron')).toBe('steel');
    expect(nextArmorTier('steel')).toBeNull();
  });
  it('upgrade cost escalates and is null at the top', () => {
    expect(armorUpgradeCost('copper')).toBe(60);
    expect(armorUpgradeCost('bronze')).toBe(120);
    expect(armorUpgradeCost('iron')).toBe(220);
    expect(armorUpgradeCost('steel')).toBeNull();
  });
});
