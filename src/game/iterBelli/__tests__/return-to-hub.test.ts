import { describe, it, expect, beforeEach } from 'vitest';
import { returnFromCampaign } from '../return-to-hub';
import { startIterBelliCampaign, applyBattleOutcome, iterBelliActive } from '../iter-belli-state';
import { iuniores } from '../../core/resources';
import { completedSpokes, globalSeason, selectedCommander } from '../../core/game-state';
import { provinces } from '../../province/province-store';
import { councilSlots } from '../../council/council-store';
import { preparedArmy } from '../../progression/strategic-store';
import { enqueueHubConsequences, pendingHubConsequences, resetEventStore } from '../../events/event-store';
import type { Advisor } from '../../council/advisor';

/**
 * Characterization of the campaign→hub settle path (D32 extraction). Drives a real
 * campaign to a finished outcome via applyBattleOutcome, then asserts returnFromCampaign
 * settles every limb: resource writeback, season advance, victory rewards (conquest +
 * unlock), advisor XP, the D10 event-queue drain, and the engine reset + idempotency.
 */
const SEED = {
  soldiers: 4000, gold: 5, iuniores: 1000, discipline: 6,
  archetype: 'Warlord' as const, spokeTerrain: 'plains', spokeDuration: 8,
};
const adv = (id: string, xp: number, currentTier = 1): Advisor =>
  ({ id, name: id, xp, currentTier } as unknown as Advisor);

describe('returnFromCampaign', () => {
  beforeEach(() => {
    resetEventStore();
    provinces.value = [];
    councilSlots.value = [null, null, null];
    preparedArmy.value = null;
    selectedCommander.value = null;
    completedSpokes.value = 0;
    globalSeason.value = 0;
  });

  it('settles a victory: writeback, conquest, unlock, advisor XP, event drain, reset', () => {
    councilSlots.value = [adv('cato', 0), null, null];
    enqueueHubConsequences([{ type: 'resource', resource: 'iuniores', delta: 200 }]);
    startIterBelliCampaign(SEED);
    applyBattleOutcome(true, 3000, 10); // win the decisive battle

    const result = returnFromCampaign();

    expect(result).toMatchObject({ alreadyReturned: false, victory: true });
    expect(result.unlockedScenarioId).toBeTruthy();          // Saguntum → next scenario
    expect(completedSpokes.value).toBe(1);
    expect(provinces.value).toHaveLength(1);                  // a province was conquered
    expect(councilSlots.value[0]!.xp).toBe(2);               // +1 served +1 victory
    expect(iuniores.value).toBe(1000 + 200);                 // campaign writeback + drained grant
    expect(pendingHubConsequences.value).toEqual([]);        // queue drained
    expect(globalSeason.value).toBe(8);                      // advanced by spokeDuration
    expect(iterBelliActive.value).toBe(false);               // engine reset

    // Idempotency: the outcome was nulled by the reset, so a second call is a no-op.
    expect(returnFromCampaign().alreadyReturned).toBe(true);
  });

  it('settles a defeat: no conquest, no spoke bump, advisor earns only the service XP', () => {
    councilSlots.value = [adv('cato', 0), null, null];
    startIterBelliCampaign(SEED);
    applyBattleOutcome(false, 500, 4); // lose

    const result = returnFromCampaign();

    expect(result).toMatchObject({ alreadyReturned: false, victory: false, unlockedScenarioId: null });
    expect(completedSpokes.value).toBe(0);
    expect(provinces.value).toHaveLength(0);
    expect(councilSlots.value[0]!.xp).toBe(1); // +1 for serving, no victory bonus
  });
});
