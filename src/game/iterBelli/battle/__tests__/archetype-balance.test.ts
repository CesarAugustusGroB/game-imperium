import { describe, it, expect } from 'vitest';
import { ENEMY_ARCHETYPES } from '../orders';

describe('rebalanced archetypes', () => {
  it('Carthage is a steady combined-arms host (not a cuneus charge-bomb)', () => {
    const c = ENEMY_ARCHETYPES.carthage;
    expect(c.formation).toBe('battleLine');
    expect(c.stats.charge).toBe(11);
    expect(c.stats.push).toBe(13);
    expect(c.disc).toBe(6);
    expect(c.armorName).toBe('Iron');
    expect(c.fortPct).toBe(15);
  });
  it('Iberians have teeth (no longer a free win)', () => {
    const i = ENEMY_ARCHETYPES.iberians;
    expect(i.stats.charge).toBeGreaterThanOrEqual(12);
    expect(i.armorName).toBe('Bronze');
    expect(i.disc).toBe(6);
  });
});
