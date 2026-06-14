import { describe, it, expect } from 'vitest';
import { detectCampaignConflicts, PROVINCE_UNREST_THRESHOLD } from '../campaign-conflicts';
import type { Province } from '../../province/province';
import type { Advisor } from '../../council/advisor';

/** Minimal fixtures — only the fields detectCampaignConflicts reads. */
const prov = (id: string, unrest: number): Province =>
  ({ id, name: id.toUpperCase(), unrest } as unknown as Province);
const adv = (id: string, color: string, currentTier = 1): Advisor =>
  ({ id, name: id, color, currentTier } as unknown as Advisor);

describe('detectCampaignConflicts', () => {
  it('returns nothing for an empty hub', () => {
    expect(detectCampaignConflicts([], [])).toEqual([]);
  });

  it('flags a province at/above the unrest threshold and ignores calm ones', () => {
    const out = detectCampaignConflicts(
      [prov('hispania', PROVINCE_UNREST_THRESHOLD), prov('gallia', PROVINCE_UNREST_THRESHOLD - 1)],
      [],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: 'province', sourceId: 'hispania', severity: PROVINCE_UNREST_THRESHOLD });
  });

  it('raises a rivalry only when the seated council spans ≥2 colors', () => {
    expect(detectCampaignConflicts([], [adv('a', 'red'), adv('b', 'red')])).toEqual([]);
    const out = detectCampaignConflicts([], [adv('a', 'red', 1), adv('b', 'blue', 3)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: 'advisor', sourceId: 'b' }); // higher tier fronts it
  });

  it('ranks conflicts by descending severity', () => {
    const out = detectCampaignConflicts(
      [prov('calm', 45), prov('riot', 90)],
      [adv('a', 'red'), adv('b', 'green')],
    );
    expect(out.map((c) => c.severity)).toEqual([...out.map((c) => c.severity)].sort((x, y) => y - x));
    expect(out[0].sourceId).toBe('riot');
  });
});
