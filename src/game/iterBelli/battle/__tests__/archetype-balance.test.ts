import { describe, it, expect } from 'vitest';
import { ENEMY_ARCHETYPES } from '../orders';

describe('rebalanced archetypes', () => {
  it('Carthage is a steady combined-arms host, sim-tuned to the real cohort power curve', () => {
    // Numbers from tools/sim-battle-balance.ts: a 4-cohort line army should win
    // ~25-60% and a bare 2-cohort starter ~0%. Re-run the sim before changing.
    const c = ENEMY_ARCHETYPES.carthage;
    expect(c.formation).toBe('battleLine');
    expect(c.stats.charge).toBe(8);
    expect(c.stats.push).toBe(9);
    expect(c.disc).toBe(5);
    expect(c.armorName).toBe('Bronze');
    expect(c.fortPct).toBe(10);
  });
  it('Iberians have teeth (no longer a free win)', () => {
    const i = ENEMY_ARCHETYPES.iberians;
    expect(i.stats.charge).toBeGreaterThanOrEqual(12);
    expect(i.armorName).toBe('Bronze');
    expect(i.disc).toBe(6);
  });
});
