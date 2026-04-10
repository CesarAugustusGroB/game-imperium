import type { Legate, LegateTrait } from './legate';
import { LEGATE_TRAITS } from './legate-traits';

/** Roman praenomina (first names). */
const PRAENOMINA = [
  'Marcus', 'Lucius', 'Gaius', 'Publius', 'Quintus',
  'Tiberius', 'Titus', 'Sextus', 'Aulus', 'Decimus',
] as const;

/** Roman nomina (family names). */
const NOMINA = [
  'Aurelius', 'Julius', 'Cornelius', 'Claudius', 'Fabius',
  'Valerius', 'Sempronius', 'Licinius', 'Aemilius', 'Tullius',
] as const;

/** Roman cognomina (bynames). */
const COGNOMINA = [
  'Maximus', 'Magnus', 'Felix', 'Severus', 'Catulus',
  'Rufus', 'Niger', 'Superbus', 'Gracchus', 'Agricola',
] as const;

/** Pick a uniformly random element from a readonly array. */
function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Generate a Roman-style tria nomina name. */
function rollRomanName(): string {
  return `${pickRandom(PRAENOMINA)} ${pickRandom(NOMINA)} ${pickRandom(COGNOMINA)}`;
}

/** Roll 1–3 distinct trait ids from the catalog. */
function rollTraitIds(): string[] {
  const count = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
  const pool: LegateTrait[] = [...LEGATE_TRAITS];
  const picked: LegateTrait[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked.map(t => t.id);
}

/** Monotonic id counter — session-scoped, not persisted. */
let legateIdCounter = 1;

/** Create a single random Legate candidate. */
export function rollLegateCandidate(): Legate {
  return {
    id: `legate_${String(legateIdCounter++).padStart(4, '0')}`,
    name: rollRomanName(),
    traitIds: rollTraitIds(),
  };
}

/**
 * Generate a hiring pool of N random Legate candidates.
 * Default: 4 candidates (spec allows 3–5).
 */
export function rollHiringPool(count = 4): Legate[] {
  return Array.from({ length: count }, () => rollLegateCandidate());
}
