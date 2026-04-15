import { signal } from '@preact/signals';
import type { ProvinceFeature } from '../../data/province-features';
import { ALL_FEATURES } from '../../data/province-features';

// ── Feature pool state ──

/** Remaining features available this run (pops from front on each conquest). */
export const featurePool = signal<ProvinceFeature[]>([]);

// ── Shuffle helper ──

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Public API ──

/**
 * Initialize the feature pool for a new run.
 * Shuffles ALL_FEATURES and takes 8–12 randomly.
 */
export function initFeaturePool(): void {
  const count = 8 + Math.floor(Math.random() * 5); // 8–12
  featurePool.value = shuffle(ALL_FEATURES).slice(0, count);
}

/**
 * Pop the next feature from the pool.
 * Returns null if the pool is exhausted (more provinces than features).
 */
export function assignNextFeature(): ProvinceFeature | null {
  const pool = featurePool.value;
  if (pool.length === 0) return null;
  const [next, ...rest] = pool;
  featurePool.value = rest;
  return next;
}

/** Reset the feature pool (called on run end). */
export function resetFeaturePool(): void {
  featurePool.value = [];
}
