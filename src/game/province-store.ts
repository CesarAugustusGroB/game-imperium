import { signal } from '@preact/signals';
import type { Province, InvestmentType } from './province';
import { createProvince, INVESTMENT_DATA } from './province';
import type { ResourceType } from './commander';
import type { ResourceCost } from './doctrine';
import { getResource, spendResource } from './resources';

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

// ── Investment management ──

/** Check if the player can afford a ResourceCost. */
export function canAffordCost(cost: ResourceCost): boolean {
  for (const [res, amt] of Object.entries(cost) as [ResourceType, number][]) {
    if (getResource(res) < amt) return false;
  }
  return true;
}

/** Spend a ResourceCost. Returns false if insufficient. */
function spendCost(cost: ResourceCost): boolean {
  // Pre-check all resources before spending any
  if (!canAffordCost(cost)) return false;
  for (const [res, amt] of Object.entries(cost) as [ResourceType, number][]) {
    spendResource(res, amt);
  }
  return true;
}

/**
 * Get the next investment level for a province + type.
 * Returns 1 if not yet built, current+1 if upgrading, or 0 if maxed.
 */
export function getNextInvestmentLevel(province: Province, type: InvestmentType): number {
  const existing = province.investments.find(i => i.type === type);
  if (!existing) return 1;
  if (existing.level >= 3) return 0; // maxed
  return existing.level + 1;
}

/**
 * Build or upgrade an investment in a province.
 * Returns true if successful (cost paid, province updated).
 */
export function buildInvestment(provinceId: string, type: InvestmentType): boolean {
  const idx = provinces.value.findIndex(p => p.id === provinceId);
  if (idx === -1) return false;

  const province = provinces.value[idx];
  const nextLevel = getNextInvestmentLevel(province, type);
  if (nextLevel === 0) return false; // maxed

  const data = INVESTMENT_DATA[type];
  const cost = data.levels[nextLevel - 1].buildCost;
  if (!spendCost(cost)) return false;

  // Immutable update
  const existing = province.investments.find(i => i.type === type);
  const newInvestments = existing
    ? province.investments.map(i => i.type === type ? { ...i, level: nextLevel } : i)
    : [...province.investments, { type, level: nextLevel }];

  const updated = { ...province, investments: newInvestments };
  const arr = [...provinces.value];
  arr[idx] = updated;
  provinces.value = arr;
  return true;
}

/**
 * Assign a governor to a province (or remove with undefined).
 */
export function assignGovernor(provinceId: string, governorId: string | undefined): boolean {
  const idx = provinces.value.findIndex(p => p.id === provinceId);
  if (idx === -1) return false;

  const updated = { ...provinces.value[idx], governorId };
  const arr = [...provinces.value];
  arr[idx] = updated;
  provinces.value = arr;
  return true;
}

/** Reset all province state (called on run end / new run). */
export function resetProvinceStore(): void {
  provinces.value = [];
}
