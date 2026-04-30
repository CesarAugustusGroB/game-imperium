import { signal } from '@preact/signals';
import type { Commander } from './commander';
import { initResources, iuniores, setWarProfiler, setIncomeModifierFn, setExchangeBonusFn } from './resources';
import { addDecretum, resetDecretumHand } from '../items/decretum-store';
import { resetDoctrineStore, getIncomeModifier, addDoctrineToCollection, doctrineCollection, equipDoctrine } from '../items/doctrine-store';
import { STARTER_DECRETUM } from '../../data/decretum-data';
import { STARTER_DOCTRINES } from '../../data/doctrine-data';
import { isDoctrineEquippable } from '../items/doctrine';
import { resetCouncilStore, hireAdvisor, advisorPool, seatAdvisor } from '../council/council-store';
import { resetSpoke } from '../progression/spoke';
import { resetProvinceStore, conquerProvince, provinces, getMarketExchangeBonus } from '../province/province-store';
import { initGovernorStore, resetGovernorStore } from '../province/governor-store';
import { initProvinceMapStore, resetProvinceMapStore, claimTerritory } from '../province/province-map-store';
import { resetEventStore } from '../events/event-store';
import { initNPCFactions, resetNPCFactions, friendlyCount, hostileIds, friendlyIds, registerFactionSyncCallback } from '../progression/npc-faction-store';
import { resetStrategicStore, ensurePreparedArmy, preparedArmy } from '../progression/strategic-store';
import { getCohortById } from '../army/cohort-data';
import { computeArmySize, createCohortInstance } from '../army/cohort';
import { clearActiveRunSave, recordRunStart } from './meta-save';
import { resetCampaign } from '../campaign/campaign-state';
import { STARTER_ADVISORS } from '../../data/advisor-data';
import { initFeaturePool, resetFeaturePool } from '../province/feature-store';
import { SEASON, IUNIORES } from '../../config/game-config';

// ── Core run state ──
export const selectedCommander = signal<Commander | null>(null);

// ── Run progress ──
export const completedSpokes = signal(0);
export const threatLevel = signal(0);
export const spokesSinceLastBattle = signal(0);

// ── Season Clock ──

/** Maximum seasons before the final invasion. */
export const MAX_SEASONS = SEASON.max;

/** Total seasons elapsed across all spokes in this run. */
export const globalSeason = signal(0);

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

type CommanderDefaultLoadout = {
  doctrineIds: [string, string, string, string];
  advisorIds: [string, string, string];
};

export const COMMANDER_DEFAULT_LOADOUTS: Record<string, CommanderDefaultLoadout> = {
  innocent: {
    doctrineIds: ['doctrine_faith', 'doctrine_miracles', 'doctrine_pantheon', 'doctrine_divina_providentia'],
    advisorIds: ['advisor_pontifex', 'advisor_healer', 'advisor_zealot'],
  },
  boudicca: {
    doctrineIds: ['doctrine_sword', 'doctrine_blood', 'doctrine_lex_militaris', 'doctrine_vis_bellica'],
    advisorIds: ['advisor_centurion', 'advisor_siege_master', 'advisor_raider'],
  },
  augustus: {
    doctrineIds: ['doctrine_diplomacy', 'doctrine_court', 'doctrine_alliances', 'doctrine_foedus_aeternum'],
    advisorIds: ['advisor_diplomat', 'advisor_scholar', 'advisor_spymaster'],
  },
  crassus: {
    doctrineIds: ['doctrine_trade', 'doctrine_infrastructure', 'doctrine_market', 'doctrine_annona'],
    advisorIds: ['advisor_merchant', 'advisor_quartermaster', 'advisor_smuggler'],
  },
};

/** Sync allianceCount / enemies / allies from NPC faction state. */
export function syncFactionSignals(): void {
  allianceCount.value = friendlyCount.value;
  enemies.value = hostileIds.value;
  allies.value = friendlyIds.value;
}

// Register sync callback so npc-faction-store can call syncFactionSignals
// when setFactionRelation is called mid-run, without creating a circular import.
registerFactionSyncCallback(syncFactionSignals);

interface StartRunOptions {
  recordRunStart?: boolean;
  seedHomeProvince?: boolean;
}

function initializeRunScaffold(commander: Commander): void {
  selectedCommander.value = commander;
  initResources(commander.startingResources);
  iuniores.value = IUNIORES.startingSeed;
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
  initGovernorStore();
  initFeaturePool();
  resetProvinceMapStore();

  for (const a of STARTER_ADVISORS) {
    hireAdvisor({ ...a, currentTier: 1, xp: 0 });
  }

  applyCommanderDefaultLoadout(commander.id);
}

function applyCommanderDefaultLoadout(commanderId: string): void {
  const loadout = COMMANDER_DEFAULT_LOADOUTS[commanderId];
  if (!loadout) return;

  loadout.doctrineIds.forEach((doctrineId, slotIndex) => {
    const doctrine = doctrineCollection.value.find(d => d.id === doctrineId);
    if (!doctrine) {
      console.warn(`[startNewRun] Missing default doctrine "${doctrineId}" for commander "${commanderId}".`);
      return;
    }
    equipDoctrine(slotIndex, doctrine);
  });

  loadout.advisorIds.forEach((advisorId, slotIndex) => {
    const advisor = advisorPool.value.find(a => a.id === advisorId);
    if (!advisor) {
      console.warn(`[startNewRun] Missing default advisor "${advisorId}" for commander "${commanderId}".`);
      return;
    }
    seatAdvisor(slotIndex, advisor);
  });
}

/**
 * Start a new run with the given commander.
 * Initializes all signals to fresh state.
 */
export function startNewRun(commander: Commander, options?: StartRunOptions): void {
  const { recordRunStart: shouldRecordRunStart = true, seedHomeProvince = true } = options ?? {};

  // Runtime guard: warn if an unrecognized commander ID is used (data integrity check)
  if (!KNOWN_COMMANDER_IDS.has(commander.id)) {
    console.warn(`[startNewRun] Unknown commander ID: "${commander.id}". Expected one of: ${[...KNOWN_COMMANDER_IDS].join(', ')}`);
  }

  initializeRunScaffold(commander);

  // Starting army: 2 Hastati (free — no gold cost)
  const startingArmy = ensurePreparedArmy();
  const hastati = getCohortById('hastati');
  if (hastati) {
    startingArmy.cohorts = [createCohortInstance(hastati), createCohortInstance(hastati)];
    startingArmy.size = computeArmySize(startingArmy.cohorts);
    preparedArmy.value = { ...startingArmy };
  }

  if (seedHomeProvince) {
    // Create the home province first (no territory claimed yet — topology not loaded)
    conquerProvince('Roma', { gold: 2, faith: 1, influence: 1, momentum: 0, iuniores: 0 }, 1);

    // Load topology, then retroactively claim territory for Roma
    initProvinceMapStore().then(() => {
      const roma = provinces.value.find(p => p.name === 'Roma');
      if (roma) claimTerritory(roma.id);
    });
  }

  if (shouldRecordRunStart) {
    recordRunStart();
  }
}

/**
 * Reset everything back to pre-run state.
 * @note Callers must also call navigateTo('title') after this function to return the player to the title screen.
 */
export function resetRun(): void {
  clearActiveRunSave();
  selectedCommander.value = null;
  initResources({ gold: 0, faith: 0, influence: 0, momentum: 0, iuniores: 0 });
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
  resetFeaturePool();
  resetNPCFactions();
  resetSpoke();
  resetCampaign();

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
