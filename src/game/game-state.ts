import { signal } from '@preact/signals';
import type { Commander } from './commander';
import { initResources, setWarProfiler } from './resources';

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

  completedSpokes.value = 0;
  threatLevel.value = 0;
  spokesSinceLastBattle.value = 0;

  allianceCount.value = commander.id === 'augustus' ? 2 : 0; // Augustus starts with 2 allies
  enemies.value = [];
  allies.value = [];

  veteranStacks.value = 0;
}

/**
 * Reset everything back to pre-run state.
 * @note Callers must also call navigateTo('title') after this function to return the player to the title screen.
 */
export function resetRun(): void {
  selectedCommander.value = null;
  initResources({ gold: 0, faith: 0, influence: 0, momentum: 0 });
  setWarProfiler(false);

  completedSpokes.value = 0;
  threatLevel.value = 0;
  spokesSinceLastBattle.value = 0;

  allianceCount.value = 0;
  enemies.value = [];
  allies.value = [];

  veteranStacks.value = 0;
}
