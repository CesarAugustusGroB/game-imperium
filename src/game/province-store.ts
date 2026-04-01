import { signal } from '@preact/signals';
import type { Province } from './province';
import { createProvince } from './province';
import type { ResourceType } from './commander';

// ── Province signals ──

/** All provinces conquered in the current run. */
export const provinces = signal<Province[]>([]);

// ── Management ──

/**
 * Create a province from a completed spoke and add it to the store.
 * @param name   — spoke label (e.g. "Border War")
 * @param gains  — total resources earned during the spoke
 * @param duration — spoke duration in seasons (used to scale baseIncome)
 */
export function conquerProvince(
  name: string,
  gains: Record<ResourceType, number>,
  duration: number,
): Province {
  // Scale one-time gains down to a per-spoke income rate
  const divisor = Math.max(1, duration);
  const baseIncome: Partial<Record<ResourceType, number>> = {};
  for (const [res, amt] of Object.entries(gains) as [ResourceType, number][]) {
    const perSpoke = Math.max(1, Math.round(amt / divisor));
    if (perSpoke > 0) baseIncome[res] = perSpoke;
  }

  const province = createProvince(name, { baseIncome });
  provinces.value = [...provinces.value, province];
  return province;
}

/** Reset all province state (called on run end / new run). */
export function resetProvinceStore(): void {
  provinces.value = [];
}
