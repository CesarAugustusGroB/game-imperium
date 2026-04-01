import { signal } from '@preact/signals';
import type { Province, InvestmentType } from './province';
import { createProvince, INVESTMENT_DATA, getInvestmentDiscount, applyInvestmentDiscount, getProvinceIncome, getProvinceExpenses } from './province';
import type { ResourceType } from './commander';
import type { ResourceCost } from './doctrine';
import { getResource, spendResource, addResource } from './resources';
import { getGovernorTraits } from './governor-store';

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
 * Applies governor investment-discount if present.
 * Returns true if successful (cost paid, province updated).
 */
export function buildInvestment(provinceId: string, type: InvestmentType): boolean {
  const idx = provinces.value.findIndex(p => p.id === provinceId);
  if (idx === -1) return false;

  const province = provinces.value[idx];
  const nextLevel = getNextInvestmentLevel(province, type);
  if (nextLevel === 0) return false; // maxed

  const data = INVESTMENT_DATA[type];
  const baseCost = data.levels[nextLevel - 1].buildCost;

  // Apply governor investment-discount trait
  const traits = getGovernorTraits(provinceId);
  const discount = getInvestmentDiscount(traits);
  const cost = discount > 0 ? applyInvestmentDiscount(baseCost, discount) : baseCost;

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

// ── Season income cycle ──

export interface ProvinceIncomeResult {
  incomeGained: { resource: ResourceType; amount: number }[];
  expensesPaid: number;
  expenseShortfall: number;
}

/**
 * Collect income from all provinces and pay their expenses.
 * Called once per season tick.
 */
export function collectProvinceIncome(): ProvinceIncomeResult {
  const allProvinces = provinces.value;
  const totals: Partial<Record<ResourceType, number>> = {};
  let totalExpenses = 0;

  for (const prov of allProvinces) {
    const traits = getGovernorTraits(prov.id);
    const income = getProvinceIncome(prov, traits);
    const expenses = getProvinceExpenses(prov, traits);

    for (const [res, amt] of Object.entries(income) as [ResourceType, number][]) {
      if (amt > 0) totals[res] = (totals[res] ?? 0) + amt;
    }
    totalExpenses += expenses;
  }

  // Add income resources
  const incomeGained: { resource: ResourceType; amount: number }[] = [];
  for (const [res, amt] of Object.entries(totals) as [ResourceType, number][]) {
    if (amt > 0) {
      addResource(res, amt);
      incomeGained.push({ resource: res, amount: amt });
    }
  }

  // Pay expenses (gold)
  let expensesPaid = 0;
  let expenseShortfall = 0;
  if (totalExpenses > 0) {
    if (spendResource('gold', totalExpenses)) {
      expensesPaid = totalExpenses;
    } else {
      expenseShortfall = totalExpenses;
    }
  }

  return { incomeGained, expensesPaid, expenseShortfall };
}

/** Reset all province state (called on run end / new run). */
export function resetProvinceStore(): void {
  provinces.value = [];
}
