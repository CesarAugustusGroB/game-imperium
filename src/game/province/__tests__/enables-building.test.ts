import { describe, it, expect } from 'vitest';
import { getAvailableBuildings } from '../province';
import type { Province } from '../province';

// getAvailableBuildings only reads province.terrain and province.tradeGood.
const mkProvince = (terrain: string, tradeGood: string | null): Province =>
  ({ terrain, tradeGood } as unknown as Province);

describe('trade-good enables-building (plan S-K honesty)', () => {
  it('Iron unlocks the Forge on a terrain that would not normally allow it', () => {
    // farmland does not terrain-gate the forge (forge is the Hills building).
    const plain = getAvailableBuildings(mkProvince('farmland', null));
    expect(plain).not.toContain('forge');

    const iron = getAvailableBuildings(mkProvince('farmland', 'iron'));
    expect(iron).toContain('forge');
  });

  it('does not duplicate the forge when the terrain already allows it', () => {
    const hillsIron = getAvailableBuildings(mkProvince('hills', 'iron'));
    expect(hillsIron.filter((b) => b === 'forge')).toHaveLength(1);
  });

  it('a non-enabler trade good adds no extra building', () => {
    const before = getAvailableBuildings(mkProvince('farmland', null)).length;
    // marble is a build-cost-discount good, not an enabler.
    const after = getAvailableBuildings(mkProvince('farmland', 'marble')).length;
    expect(after).toBe(before);
  });
});
