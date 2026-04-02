import { signal } from '@preact/signals';

// ── Types ──

export interface RunRecord {
  /** ISO timestamp of run completion. */
  date: string;
  /** Commander ID used. */
  commanderId: string;
  /** Commander display name. */
  commanderName: string;
  /** 'victory' or 'defeat'. */
  outcome: 'victory' | 'defeat';
  /** Total battles won this run. */
  battlesWon: number;
  /** Total seasons elapsed. */
  seasons: number;
  /** Provinces conquered. */
  provinces: number;
  /** Computed score. */
  score: number;
}

export interface MetaSave {
  /** Version for migration support. */
  version: 1;
  /** Completed run history (most recent first). */
  runs: RunRecord[];
  /** Total runs started (includes incomplete). */
  totalRunsStarted: number;
  /** Total victories. */
  victories: number;
  /** Best score ever achieved. */
  highScore: number;
  /** Commander IDs that have won at least once. */
  commanderWins: string[];
}

// ── Constants ──

const STORAGE_KEY = 'imperium-meta-save';
const MAX_RUN_HISTORY = 50;

// ── Default state ──

function createDefaultSave(): MetaSave {
  return {
    version: 1,
    runs: [],
    totalRunsStarted: 0,
    victories: 0,
    highScore: 0,
    commanderWins: [],
  };
}

// ── Signals ──

export const metaSave = signal<MetaSave>(createDefaultSave());

// ── Persistence ──

/** Load meta-save from localStorage. Safe — returns defaults on any error. */
export function loadMetaSave(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      metaSave.value = createDefaultSave();
      return;
    }
    const parsed = JSON.parse(raw) as MetaSave;
    if (parsed.version === 1) {
      metaSave.value = parsed;
    } else {
      metaSave.value = createDefaultSave();
    }
  } catch {
    metaSave.value = createDefaultSave();
  }
}

/** Persist current meta-save to localStorage. */
function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(metaSave.value));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

// ── Actions ──

/** Record a new run start (increments totalRunsStarted). */
export function recordRunStart(): void {
  metaSave.value = {
    ...metaSave.value,
    totalRunsStarted: metaSave.value.totalRunsStarted + 1,
  };
  persist();
}

/** Compute score from run stats. */
export function computeScore(
  outcome: 'victory' | 'defeat',
  battlesWon: number,
  seasons: number,
  provinces: number,
): number {
  const basePoints = outcome === 'victory' ? 1000 : 0;
  const battlePoints = battlesWon * 75;
  const provincePoints = provinces * 200;
  // Bonus for finishing faster (fewer seasons used) — doubled in S9-06
  const speedBonus = outcome === 'victory' ? Math.max(0, (24 - seasons) * 100) : 0;
  return basePoints + battlePoints + provincePoints + speedBonus;
}

/**
 * Record a completed run. Call from Victory/Defeat screens before resetRun().
 */
export function recordRunComplete(
  commanderId: string,
  commanderName: string,
  outcome: 'victory' | 'defeat',
  battlesWon: number,
  seasons: number,
  provinces: number,
): void {
  const score = computeScore(outcome, battlesWon, seasons, provinces);

  const record: RunRecord = {
    date: new Date().toISOString(),
    commanderId,
    commanderName,
    outcome,
    battlesWon,
    seasons,
    provinces,
    score,
  };

  const prev = metaSave.value;
  const runs = [record, ...prev.runs].slice(0, MAX_RUN_HISTORY);
  const victories = prev.victories + (outcome === 'victory' ? 1 : 0);
  const highScore = Math.max(prev.highScore, score);
  const commanderWins = outcome === 'victory' && !prev.commanderWins.includes(commanderId)
    ? [...prev.commanderWins, commanderId]
    : prev.commanderWins;

  metaSave.value = {
    ...prev,
    runs,
    victories,
    highScore,
    commanderWins,
  };

  persist();
}

/** Get the best run record, or null if no runs. */
export function getBestRun(): RunRecord | null {
  const runs = metaSave.value.runs;
  if (runs.length === 0) return null;
  return runs.reduce((best, r) => r.score > best.score ? r : best);
}

/** Check if a commander has won before. */
export function hasCommanderWon(commanderId: string): boolean {
  return metaSave.value.commanderWins.includes(commanderId);
}

/** Clear all save data. */
export function clearMetaSave(): void {
  metaSave.value = createDefaultSave();
  persist();
}
