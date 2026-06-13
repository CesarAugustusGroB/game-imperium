import { signal } from '@preact/signals';
import type { Commander } from './commander';
import { initResources, iuniores, setWarProfiler, setIncomeModifierFn } from './resources';
import { addDecretum, resetDecretumHand } from '../items/decretum-store';
import { resetActiveDecretumEffects } from '../items/decretum-hub';
import { resetDoctrineStore, getIncomeModifier, getUpkeepReduction, addDoctrineToCollection, doctrineCollection, equipDoctrine } from '../items/doctrine-store';
import { STARTER_DECRETUM } from '../../data/decretum-data';
import { DOCTRINE_CATALOG } from '../../data/doctrine-data';
import { isDoctrineEquippable } from '../items/doctrine';
import { resetCouncilStore, advisorMarket, seatAdvisor, setAdvisorMarket, advisorShopDiscount, advisorIncomeBonus } from '../council/council-store';
import { resetProvinceStore, conquerProvince, getEmpireRecruitDiscount } from '../province/province-store';
import { setUpkeepReductionFn } from '../province/province';
import { initGovernorStore, resetGovernorStore } from '../province/governor-store';
import { initProvinceMapStore, resetProvinceMapStore } from '../province/province-map-store';
import { resetEventStore } from '../events/event-store';
import { initNPCFactions, resetNPCFactions, friendlyCount, hostileIds, friendlyIds, registerFactionSyncCallback } from '../progression/npc-faction-store';
import { resetAllies } from '../progression/ally-store';
import { resetStrategicStore, ensurePreparedArmy, preparedArmy, setExtraShopDiscountFn, setRecruitDiscountFn } from '../progression/strategic-store';
import { getCohortById } from '../army/cohort-data';
import { computeArmySize, createCohortInstance } from '../army/cohort';
import { clearActiveRunSave, recordRunStart } from './meta-save';
import { resetIterBelli } from '../iterBelli/iter-belli-state';
import { resetUnlockedScenarios } from '../iterBelli/iter-belli-scenario';
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

// Default loadouts may only reference STARTER doctrines (2 own-color + the
// white core) — the rest of the catalog is earned via the victory draft and
// is not in the collection at run start.
export const COMMANDER_DEFAULT_LOADOUTS: Record<string, CommanderDefaultLoadout> = {
  innocent: {
    doctrineIds: ['doctrine_faith', 'doctrine_miracles', 'doctrine_people', 'doctrine_militia'],
    advisorIds: ['advisor_pontifex', 'advisor_healer', 'advisor_zealot'],
  },
  boudicca: {
    doctrineIds: ['doctrine_sword', 'doctrine_iron', 'doctrine_people', 'doctrine_militia'],
    advisorIds: ['advisor_centurion', 'advisor_siege_master', 'advisor_raider'],
  },
  augustus: {
    doctrineIds: ['doctrine_diplomacy', 'doctrine_court', 'doctrine_people', 'doctrine_militia'],
    advisorIds: ['advisor_diplomat', 'advisor_scholar', 'advisor_spymaster'],
  },
  crassus: {
    doctrineIds: ['doctrine_trade', 'doctrine_market', 'doctrine_people', 'doctrine_militia'],
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

/** Wire equipped-doctrine + seated-advisor bonuses into the resource/strategic/season layers. */
export function wireRunBonuses(): void {
  setIncomeModifierFn((res) => getIncomeModifier(res) + advisorIncomeBonus(res));
  setExtraShopDiscountFn(advisorShopDiscount);
  setUpkeepReductionFn(getUpkeepReduction);
  setRecruitDiscountFn(getEmpireRecruitDiscount);
}

interface StartRunOptions {
  recordRunStart?: boolean;
  seedHomeProvince?: boolean;
}

function initializeRunScaffold(commander: Commander): void {
  selectedCommander.value = commander;
  initResources(commander.startingResources);
  iuniores.value = IUNIORES.startingSeed;
  setWarProfiler(commander.id === 'crassus');
  wireRunBonuses();

  completedSpokes.value = 0;
  threatLevel.value = 0;
  spokesSinceLastBattle.value = 0;
  globalSeason.value = 0;
  battlesWon.value = 0;

  // NPC factions — derive alliance/enemy state
  initNPCFactions();
  syncFactionSignals();
  resetAllies();

  veteranStacks.value = 0;

  // Give starter Decretum matching commander color + white.
  // The eligible pool exceeds the hand cap, so deal a random hand —
  // otherwise scrolls past the first 5 of a color are never reachable.
  resetDecretumHand();
  resetActiveDecretumEffects();
  const decretumPool = STARTER_DECRETUM.filter(
    (d) => d.color === commander.faction || d.color === 'white',
  );
  for (let i = decretumPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [decretumPool[i], decretumPool[j]] = [decretumPool[j], decretumPool[i]];
  }
  for (const d of decretumPool) {
    if (!addDecretum(d)) break;
  }

  // Give the starter core matching commander color + white (fresh copies).
  // Non-starter doctrines are earned mid-run via the victory draft.
  resetDoctrineStore();
  for (const d of DOCTRINE_CATALOG) {
    if (d.starter && isDoctrineEquippable(d, commander.faction)) {
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

  setAdvisorMarket(STARTER_ADVISORS.map(a => ({ ...a, currentTier: 1, xp: 0 })));

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
    const advisor = advisorMarket.value.find(a => a.id === advisorId);
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
    // Create the home province immediately; its claimTerritory call is queued
    // by the map store and flushed when initProvinceMapStore finishes loading
    // the topology (see pendingClaims in province-map-store).
    conquerProvince('Roma', { gold: 2, iuniores: 0 }, 1);
    void initProvinceMapStore();
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
  initResources({ gold: 0, iuniores: 0 });
  setWarProfiler(false);
  setIncomeModifierFn(null);
  setExtraShopDiscountFn(() => 0);
  setUpkeepReductionFn(() => 0);
  setRecruitDiscountFn(() => 0);
  resetDecretumHand();
  resetActiveDecretumEffects();
  resetDoctrineStore();
  resetCouncilStore();
  resetProvinceStore();
  resetGovernorStore();
  resetProvinceMapStore();
  resetEventStore();
  resetStrategicStore();
  resetFeaturePool();
  resetNPCFactions();
  resetAllies();
  resetIterBelli();
  resetUnlockedScenarios();

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
