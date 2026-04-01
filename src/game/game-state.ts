import { signal } from '@preact/signals';
import type { Commander } from './commander';
import { initResources, setWarProfiler, setIncomeModifierFn, setExchangeBonusFn } from './resources';
import { addDecretum, resetDecretumHand } from './decretum-store';
import { resetDoctrineStore, getIncomeModifier, addDoctrineToCollection } from './doctrine-store';
import { STARTER_DECRETUM } from '../data/decretum-data';
import { STARTER_DOCTRINES } from '../data/doctrine-data';
import { isDoctrineEquippable } from './doctrine';
import { resetCouncilStore, hireAdvisor } from './council-store';
import { resetSpoke } from './spoke';
import { resetProvinceStore, conquerProvince, provinces, getMarketExchangeBonus } from './province-store';
import { initGovernorStore, resetGovernorStore } from './governor-store';
import { initProvinceMapStore, resetProvinceMapStore, claimTerritory } from './province-map-store';
import { STARTER_ADVISORS } from '../data/advisor-data';

// ── Core run state ──
export const selectedCommander = signal<Commander | null>(null);

// ── Run progress ──
export const completedSpokes = signal(0);
export const threatLevel = signal(0);
export const spokesSinceLastBattle = signal(0);

// ── Relationships ──
export const allianceCount = signal(0);
export const enemies = signal<string[]>([]);
export const allies = signal<string[]>([]);

// ── Boudicca-specific ──
export const veteranStacks = signal(0);

/** Known valid commander IDs. Used for runtime validation in startNewRun. */
const KNOWN_COMMANDER_IDS = new Set(['innocent', 'boudicca', 'augustus', 'crassus']);

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

  allianceCount.value = commander.id === 'augustus' ? 2 : 0; // Augustus starts with 2 allies
  enemies.value = [];
  allies.value = [];

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
  initGovernorStore();
  initProvinceMapStore().then(() => {
    // Claim territory for Roma once topology is loaded
    const roma = provinces.value.find(p => p.name === 'Roma');
    if (roma) claimTerritory(roma.id);
  });

  // Start with one home province
  conquerProvince('Roma', { gold: 2, faith: 1, influence: 1, momentum: 0 }, 1);

  for (const a of STARTER_ADVISORS) {
    hireAdvisor({ ...a, currentTier: 1, xp: 0 });
  }
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
  resetSpoke();

  completedSpokes.value = 0;
  threatLevel.value = 0;
  spokesSinceLastBattle.value = 0;

  allianceCount.value = 0;
  enemies.value = [];
  allies.value = [];

  veteranStacks.value = 0;
}
