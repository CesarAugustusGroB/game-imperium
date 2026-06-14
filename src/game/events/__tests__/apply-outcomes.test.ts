import { describe, it, expect, beforeEach } from 'vitest';
import { applyCampaignEventOutcomes } from '../apply-outcomes';
import { enqueueHubConsequences, pendingHubConsequences, resetEventStore } from '../event-store';
import { provinces } from '../../province/province-store';
import { councilSlots } from '../../council/council-store';
import { getResource } from '../../core/resources';
import type { Province } from '../../province/province';
import type { Advisor } from '../../council/advisor';

const prov = (id: string, unrest: number): Province =>
  ({ id, name: id.toUpperCase(), unrest } as unknown as Province);
const adv = (id: string, xp: number, currentTier = 1): Advisor =>
  ({ id, name: id, xp, currentTier } as unknown as Advisor);

describe('applyCampaignEventOutcomes', () => {
  beforeEach(() => {
    resetEventStore();
    provinces.value = [];
    councilSlots.value = [null, null, null];
  });

  it('drains the queue into province unrest, advisor xp, and resources, then clears it', () => {
    provinces.value = [prov('hisp', 50)];
    councilSlots.value = [adv('cato', 0), null, null];
    const gold0 = getResource('gold');
    enqueueHubConsequences([
      { type: 'province-unrest', provinceId: 'hisp', delta: -20 },
      { type: 'advisor-xp', advisorId: 'cato', delta: 3 },
      { type: 'resource', resource: 'gold', delta: 150 },
    ]);

    applyCampaignEventOutcomes();

    expect(provinces.value[0].unrest).toBe(30);
    expect(councilSlots.value[0]!.xp).toBe(3);
    expect(getResource('gold')).toBe(gold0 + 150); // face value, no income inflation
    expect(pendingHubConsequences.value).toEqual([]);
  });

  it('clamps unrest to [0,100] and floors advisor xp at 0 on negative deltas', () => {
    provinces.value = [prov('p', 10)];
    councilSlots.value = [adv('a', 2), null, null];
    enqueueHubConsequences([
      { type: 'province-unrest', provinceId: 'p', delta: -50 },
      { type: 'advisor-xp', advisorId: 'a', delta: -10 },
    ]);

    applyCampaignEventOutcomes();

    expect(provinces.value[0].unrest).toBe(0);
    expect(councilSlots.value[0]!.xp).toBe(0);
  });

  it('is a no-op on an empty queue', () => {
    expect(() => applyCampaignEventOutcomes()).not.toThrow();
    expect(pendingHubConsequences.value).toEqual([]);
  });
});
