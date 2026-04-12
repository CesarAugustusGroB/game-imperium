import { signal } from '@preact/signals';
import type { Commander } from './commander';
import { initResources, setWarProfiler, setIncomeModifierFn, setExchangeBonusFn } from './resources';
import { addDecretum, resetDecretumHand } from '../items/decretum-store';
import { resetDoctrineStore, getIncomeModifier, addDoctrineToCollection } from '../items/doctrine-store';
import { STARTER_DECRETUM } from '../../data/decretum-data';
import { STARTER_DOCTRINES } from '../../data/doctrine-data';
import { isDoctrineEquippable } from '../items/doctrine';
import { resetCouncilStore, hireAdvisor } from '../council/council-store';
import { resetSpoke } from '../progression/spoke';
import { resetProvinceStore, conquerProvince, provinces, getMarketExchangeBonus } from '../province/province-store';
import { initGovernorStore, resetGovernorStore } from '../province/governor-store';
import { initProvinceMapStore, resetProvinceMapStore, claimTerritory } from '../province/province-map-store';
import { resetEventStore } from '../events/event-store';
import { initNPCFactions, resetNPCFactions, friendlyCount, hostileIds, friendlyIds, registerFactionSyncCallback } from '../progression/npc-faction-store';
import { resetStrategicStore, ensurePreparedArmy, preparedArmy } from '../progression/strategic-store';
import { getCohortById } from '../army/cohort-data';
import { computeArmySize } from '../army/cohort';
import { recordRunStart } from './meta-save';
import { STARTER_ADVISORS } from '../../data/advisor-data';

// ── Core run state ──
export const selectedCommander = signal<Commander | null>(null);

// ── Run progress ──
export const completedSpokes = signal(0);
export const threatLevel = signal(0);
export const spokesSinceLastBattle = signal(0);

// ── Season Clock ──

/** Maximum seasons before the final invasion. */
export const MAX_SEASONS = 24;

/** Total seasons elapsed across all spokes in this run. */
export const globalSeason = signal(0);

/**
 * Doom level (0–100). Derived from globalSeason / MAX_SEASONS.
 * Drives escalating upkeep and ultimately the final battle.
 */
export function getDoomLevel(): number {
  return Math.min(100, Math.floor((globalSeason.value / MAX_SEASONS) * 100));
}

/**
 * Extra gold upkeep per season from doom progression.
 * Doom 25 (season 6): +1g, Doom 50 (season 12): +2g, Doom 75 (season 18): +3g.
 */
export function getDoomUpkeep(): number {
  const doom = getDoomLevel();
  if (doom >= 75) return 3;
  if (doom >= 50) return 2;
  if (doom >= 25) return 1;
  return 0;
}

/** Get narrative doom milestone text, or null if between milestones. */
export function getDoomMilestone(): string | null {
  const doom = getDoomLevel();
  const season = globalSeason.value;
  // Only show at exact threshold crossings (check if we just crossed)
  if (season === 6) return 'The frontier grows restless. Barbarian scouts probe your borders.';
  if (season === 12) return 'War drums echo from the north. The tribes are uniting.';
  if (season === 18) return 'The horde assembles. Smoke rises on every horizon.';
  if (season === 24) return 'THE INVASION BEGINS.';
  if (doom >= 75) return null;
  return null;
}

// ── Relationships ──
export const allianceCount = signal(0);
export const enemies = signal<string[]>([]);
export const allies = signal<string[]>([]);

// ── Boudicca-specific ──
export const veteranStacks = signal(0);

// ── Run stats ──
/** Total battles won this run. Used in final boss scaling (S9-01). */
export const battlesWon = signal(0);

/** Known valid commander IDs. Used for runtime validation in startNewRun. */
const KNOWN_COMMANDER_IDS = new Set(['innocent', 'boudicca', 'augustus', 'crassus']);

/** Sync allianceCount / enemies / allies from NPC faction state. */
export function syncFactionSignals(): void {
  allianceCount.value = friendlyCount.value;
  enemies.value = hostileIds.value;
  allies.value = friendlyIds.value;
}

// Register sync callback so npc-faction-store can call syncFactionSignals
// when setFactionRelation is called mid-run, without creating a circular import.
registerFactionSyncCallback(syncFactionSignals);

/**
 * Start a new run with the given commander.
 * Initializes all signals to fresh state.
 */
export function startNewRun(commander: Commander): void {
  // Runtime guard: warn if an unrecognized commander ID is used (data integrity check)
  if (!KNOWN_COMMANDER_IDS.has(commander.id)) {
    console.warn(`[startNewRun] Unknown commander ID: "${commander.id}". Expected one of: ${[...KNOWN_COMMANDER_IDS].join(', ')}`);
  }

  selectedCommander.value = commander;
  initResources(commander.startingResources);
  setWarProfiler(commander.id === 'crassus');
  setIncomeModifierFn(getIncomeModifier);
  setExchangeBonusFn(getMarketExchangeBonus);

  completedSpokes.value = 0;
  threatLevel.value = 0;
  spokesSinceLastBattle.value = 0;
  globalSeason.value = 0;
  battlesWon.value = 0;

  // NPC factions — derive alliance/enemy state
  initNPCFactions();
  syncFactionSignals();

  veteranStacks.value = 0;

  // Give starter Decretum matching commander color + white
  resetDecretumHand();
  for (const d of STARTER_DECRETUM) {
    if (d.color === commander.faction || d.color === 'white') {
      addDecretum(d);
    }
  }

  // Give starter Doctrines matching commander color + white (fresh copies)
  resetDoctrineStore();
  for (const d of STARTER_DOCTRINES) {
    if (isDoctrineEquippable(d, commander.faction)) {
      addDoctrineToCollection({ ...d, currentLevel: 1 });
    }
  }

  // Give starter Advisors — all colors (UNRESTRICTED color rule)
  resetCouncilStore();
  resetProvinceStore();
  resetEventStore();
  resetStrategicStore();

  // Starting army: 2 Hastati (free — no gold cost)
  const startingArmy = ensurePreparedArmy();
  const hastati = getCohortById('hastati');
  if (hastati) {
    startingArmy.cohorts = [{ ...hastati }, { ...hastati }];
    startingArmy.size = computeArmySize(startingArmy.cohorts);
    preparedArmy.value = { ...startingArmy };
  }

  initGovernorStore();

  // Create the home province first (no territory claimed yet — topology not loaded)
  conquerProvince('Roma', { gold: 2, faith: 1, influence: 1, momentum: 0 }, 1);

  // Load topology, then retroactively claim territory for Roma
  initProvinceMapStore().then(() => {
    const roma = provinces.value.find(p => p.name === 'Roma');
    if (roma) claimTerritory(roma.id);
  });

  for (const a of STARTER_ADVISORS) {
    hireAdvisor({ ...a, currentTier: 1, xp: 0 });
  }

  recordRunStart();
}

/**
 * Reset everything back to pre-run state.
 * @note Callers must also call navigateTo('title') after this function to return the player to the title screen.
 */
export function resetRun(): void {
  selectedCommander.value = null;
  initResources({ gold: 0, faith: 0, influence: 0, momentum: 0 });
  setWarProfiler(false);
  setIncomeModifierFn(null);
  setExchangeBonusFn(null);
  resetDecretumHand();
  resetDoctrineStore();
  resetCouncilStore();
  resetProvinceStore();
  resetGovernorStore();
  resetProvinceMapStore();
  resetEventStore();
  resetStrategicStore();
  resetNPCFactions();
  resetSpoke();

  completedSpokes.value = 0;
  threatLevel.value = 0;
  spokesSinceLastBattle.value = 0;
  globalSeason.value = 0;

  allianceCount.value = 0;
  enemies.value = [];
  allies.value = [];
  veteranStacks.value = 0;
  battlesWon.value = 0;
}
