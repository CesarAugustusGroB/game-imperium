import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCENARIOS, getScenarioById, getActiveScenario, setActiveScenarioById,
  resetActiveScenario, unlockedScenarios, isScenarioUnlocked,
  unlockScenario, unlockNextScenario, setUnlockedScenarios, resetUnlockedScenarios,
} from '../iter-belli-scenario';
import { CARD_DEFS } from '../../../data/iter-belli-cards';
import { startIterBelliCampaign, resetIterBelli } from '../iter-belli-state';

beforeEach(() => { resetUnlockedScenarios(); resetActiveScenario(); });

describe('S-F: scenario registry', () => {
  it('has Saguntum first and Gallia second', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(['saguntum', 'gallia']);
  });

  it('Gallia uses the gauls archetype and Alesia objective', () => {
    const g = getScenarioById('gallia')!;
    expect(g.enemy.archetypeKey).toBe('gauls');
    expect(g.objectiveLocationId).toBe('alesia');
    expect(g.decisiveCardId).toBe('asalto_alesia');
    expect(g.provinceTerrain).toBe('forest');
  });

  it('each scenario decisive card exists and is gated to its objective location', () => {
    for (const sc of SCENARIOS) {
      const card = CARD_DEFS.find((c) => c.id === sc.decisiveCardId);
      expect(card, sc.decisiveCardId).toBeTruthy();
      expect(card!.locations).toEqual([sc.objectiveLocationId]);
    }
  });

  it('Gallia reuses the generic location ids so existing cards stay eligible', () => {
    const g = getScenarioById('gallia')!;
    const ids = new Set(g.locations.map((l) => l.id));
    for (const id of ['frontera', 'tarraco', 'llanura', 'bosques']) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});

describe('S-F: unlock progression', () => {
  it('starts with only the first scenario unlocked', () => {
    expect(unlockedScenarios.value).toEqual(['saguntum']);
    expect(isScenarioUnlocked('gallia')).toBe(false);
  });

  it('winning Saguntum unlocks Gallia', () => {
    expect(unlockNextScenario('saguntum')).toBe('gallia');
    expect(isScenarioUnlocked('gallia')).toBe(true);
  });

  it('unlockNextScenario is a no-op past the last scenario or when already unlocked', () => {
    unlockScenario('gallia');
    expect(unlockNextScenario('gallia')).toBeNull();   // no scenario after gallia
    expect(unlockNextScenario('saguntum')).toBeNull(); // gallia already unlocked
  });

  it('setActiveScenarioById switches the engine-read scenario', () => {
    setActiveScenarioById('gallia');
    expect(getActiveScenario().id).toBe('gallia');
    resetActiveScenario();
    expect(getActiveScenario().id).toBe('saguntum');
  });

  it('setUnlockedScenarios restores from a save, ignoring unknown ids and never empty', () => {
    setUnlockedScenarios(['saguntum', 'gallia', 'atlantis']);
    expect(unlockedScenarios.value).toEqual(['saguntum', 'gallia']);
    setUnlockedScenarios([]);
    expect(unlockedScenarios.value).toEqual(['saguntum']);
  });
});

describe('S-F: starting a campaign pins its scenario (regression)', () => {
  const SEED = {
    soldiers: 4000, gold: 40, iuniores: 0, discipline: 3,
    archetype: 'Warlord' as const, spokeTerrain: 'forest', spokeDuration: 8,
  };

  it('seed.scenarioId survives startIterBelliCampaign (Gallia no longer reverts to Saguntum)', () => {
    setActiveScenarioById('gallia');
    startIterBelliCampaign({ ...SEED, scenarioId: 'gallia' });
    // Before the fix, startIterBelliCampaign called resetActiveScenario() and the
    // engine would read Saguntum for the whole campaign.
    expect(getActiveScenario().id).toBe('gallia');
    resetIterBelli();
  });

  it('omitting scenarioId defaults to the first scenario (Saguntum) — preserves prior behaviour', () => {
    setActiveScenarioById('gallia');
    startIterBelliCampaign({ ...SEED });
    expect(getActiveScenario().id).toBe('saguntum');
    resetIterBelli();
  });
});
