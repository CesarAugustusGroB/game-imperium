/**
 * Iter Belli — Result → Hub conquest data.
 * Pure data + a name picker; no signals, no run-state. Consumed by the embark
 * bridge (EmbarkCard) and the return bridge (EndgameCard.returnToHub).
 */
import type { ResourceType } from '../game/core/commander';
import type { TerrainType } from './terrain-data';

/** Spoke theme tag → conquered-province terrain. */
export const THEME_TERRAIN: Record<string, TerrainType> = {
  woodland: 'forest',
  highlands: 'mountains',
  marshland: 'marsh',
  coastal: 'coast',
  mixed: 'plains',
};

/** Resolve a spoke theme tag to a terrain; unknown / undefined / null → 'plains'. */
export function themeToTerrain(theme: string | undefined | null): TerrainType {
  return (theme != null && THEME_TERRAIN[theme]) || 'plains';
}

/** Flat pool of evocative place-names for conquered provinces (pure flavor). */
export const CONQUEST_NAMES: string[] = [
  'Numantia', 'Gades', 'Tarraco', 'Corduba', 'Ilerda', 'Osca', 'Bilbilis',
  'Carthago Nova', 'Saguntum', 'Emporiae', 'Carteia', 'Italica', 'Brigantium',
  'Lucentum', 'Toletum', 'Segovia', 'Pallantia', 'Asturica', 'Bracara', 'Olisipo',
];

const ROMAN_SUFFIX = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/**
 * Pick a province name not already in `taken`. Random unused name from the pool;
 * if every base name is taken, append a roman-numeral suffix until one is free.
 */
export function pickConquestName(taken: Set<string>): string {
  const free = CONQUEST_NAMES.filter((n) => !taken.has(n));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  for (const suffix of ROMAN_SUFFIX) {
    for (const base of CONQUEST_NAMES) {
      const candidate = `${base} ${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
  }
  return `Provincia ${Date.now()}`; // effectively unreachable fallback
}

/**
 * Fixed per-spoke income for a conquered province. Only gold + iuniores are
 * granted — the deprecated resources are omitted (and `conquerProvince` floors
 * any present key at 1/spoke, so omitting them is the only way to keep 0).
 * Passed with `duration: 1` so per-spoke income equals these values exactly.
 * Tunable.
 */
export const PROVINCE_REWARD: Partial<Record<ResourceType, number>> = {
  gold: 5,
  iuniores: 2,
};
