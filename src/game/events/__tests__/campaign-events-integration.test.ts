import { describe, it, expect, beforeEach } from 'vitest';
import { detectCampaignConflicts } from '../campaign-conflicts';
import {
  maybeFireCampaignEvent, resolveCampaignEventChoice, pendingCampaignEvent,
} from '../campaign-events-controller';
import {
  sealCampaignConflicts, campaignConflicts, campaignEventFiredThisSpoke,
  pendingHubConsequences, resetEventStore,
} from '../event-store';
import { applyCampaignEventOutcomes } from '../apply-outcomes';
import { startIterBelliCampaign } from '../../iterBelli/iter-belli-state';
import { provinces } from '../../province/province-store';
import { councilSlots } from '../../council/council-store';
import type { Province } from '../../province/province';

/**
 * End-to-end pass through the whole D10 chain against the REAL catalog:
 * embark (detect + seal a hub conflict) → mid-march fire → resolve a choice
 * (immediate effects + enqueue) → return to hub (drain to the province). Proves
 * SOURCE_REF resolves to the firing province and the loop actually writes back.
 */
const SEED = {
  soldiers: 4000, gold: 5, iuniores: 1000, discipline: 6,
  archetype: 'Warlord' as const, spokeTerrain: 'plains', spokeDuration: 8,
};

const prov = (id: string, unrest: number): Province =>
  ({ id, name: id.toUpperCase(), unrest } as unknown as Province);

describe('campaign-event loop (embark → fire → resolve → return)', () => {
  beforeEach(() => {
    resetEventStore();
    pendingCampaignEvent.value = null;
    councilSlots.value = [null, null, null];
    provinces.value = [];
  });

  it('seals a province conflict, fires it, and writes the consequence back on return', () => {
    // ── Embark: a restless province seeds a conflict ──
    provinces.value = [prov('hispania', 70)];
    startIterBelliCampaign(SEED);
    sealCampaignConflicts(detectCampaignConflicts(provinces.value, []));
    expect(campaignConflicts.value).toHaveLength(1);

    // ── Mid-march: force a fire (deterministic rng + progress) ──
    const fired = maybeFireCampaignEvent({ rng: () => 0, progress: 0.5 });
    expect(fired).not.toBeNull();
    expect(fired!.event.sourceType).toBe('province');
    expect(fired!.conflict.sourceId).toBe('hispania');

    // ── Resolve a choice that carries a province-unrest write-back ──
    const choice = fired!.event.choices.find(
      (c) => !c.premium && c.consequence?.some((h) => h.type === 'province-unrest'),
    );
    expect(choice, 'catalog event should offer an unrest write-back').toBeDefined();
    const delta = (choice!.consequence!.find((h) => h.type === 'province-unrest') as { delta: number }).delta;

    resolveCampaignEventChoice(fired!, choice!);
    expect(campaignEventFiredThisSpoke.value).toBe(true);
    // SOURCE_REF resolved to the firing province before enqueueing.
    expect(pendingHubConsequences.value).toContainEqual({ type: 'province-unrest', provinceId: 'hispania', delta });

    // ── Return to hub: drain the queue into the province ──
    applyCampaignEventOutcomes();
    expect(provinces.value[0].unrest).toBe(Math.max(0, Math.min(100, 70 + delta)));
    expect(pendingHubConsequences.value).toEqual([]);
  });

  it('fires at most once per campaign (the cap holds after one resolution)', () => {
    provinces.value = [prov('gallia', 80)];
    startIterBelliCampaign(SEED);
    sealCampaignConflicts(detectCampaignConflicts(provinces.value, []));

    const first = maybeFireCampaignEvent({ rng: () => 0, progress: 0.5 });
    expect(first).not.toBeNull();
    resolveCampaignEventChoice(first!, first!.event.choices[0]);

    // Even with a guaranteed roll, no second event fires this campaign.
    expect(maybeFireCampaignEvent({ rng: () => 0, progress: 0.5 })).toBeNull();
  });
});
