import { signal } from '@preact/signals';
import type { Province, InvestmentType } from './province';
import { createProvince, INVESTMENT_DATA, getInvestmentDiscount, applyInvestmentDiscount, getProvinceIncome, getProvinceExpenses, getUnrestModifier } from './province';
import type { ResourceType } from '../core/commander';
import type { ResourceCost, DoctrineEffect } from '../items/doctrine';
import { getResource, spendResource, addResource } from '../core/resources';
import { getGovernorTraits, registerProvinceSyncCallback } from './governor-store';
import { claimTerritory } from './province-map-store';
import { nextInvestmentDiscount } from '../progression/strategic-store';

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

  // Claim a map territory for this province
  claimTerritory(province.id);

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

  // Apply governor + scroll investment discounts
  const traits = getGovernorTraits(provinceId);
  const governorDiscount = getInvestmentDiscount(traits);
  const scrollDiscount = nextInvestmentDiscount.value;
  const effectiveDiscount = Math.min(90, governorDiscount + scrollDiscount);
  const cost = effectiveDiscount > 0 ? applyInvestmentDiscount(baseCost, effectiveDiscount) : baseCost;

  if (!spendCost(cost)) return false;
  if (scrollDiscount > 0) nextInvestmentDiscount.value = 0; // consume one-time discount

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

// Register the sync callback so governor-store can keep Province.governorId in sync
// without importing province-store (breaking the circular dependency).
registerProvinceSyncCallback(assignGovernor);

// ── Season income + unrest cycle ──

/** Base unrest growth per season (constant pressure). */
const BASE_UNREST_GROWTH = 5;

/** Unrest penalty when province expenses can't be paid. */
const EXPENSE_SHORTFALL_UNREST = 10;

/** Unrest threshold that triggers a rebellion. */
const REBELLION_THRESHOLD = 80;

export interface RebellionEvent {
  provinceName: string;
  lostInvestment: string | null; // investment name lost, or null if no investments
}

export interface ProvinceIncomeResult {
  incomeGained: { resource: ResourceType; amount: number }[];
  expensesPaid: number;
  expenseShortfall: number;
  rebellions: RebellionEvent[];
}

/**
 * Get the Insula rebellion suppression threshold for a province.
 * Effective rebellion threshold = max(REBELLION_THRESHOLD, suppression).
 * Returns 0 (no suppression), 90 (Insula T2), or 101 (Insula T3 = immune).
 *
 * Previous values (50/70) were below REBELLION_THRESHOLD (80) and had no
 * effect. T2 now raises the bar to 90; T3 makes rebellion impossible (101 > 100 cap).
 */
function getInsulaSuppression(prov: Province): number {
  const insula = prov.investments.find(i => i.type === 'insula');
  if (!insula) return 0;
  if (insula.level >= 3) return 101; // Rebellion impossible (unrest caps at 100)
  if (insula.level >= 2) return 90;  // Rebellion suppressed below 90 Unrest
  return 0;
}

/**
 * Collect income, pay expenses, tick unrest, and check rebellions for all provinces.
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

  // Aqueduct T3: "All income +10%" — applies empire-wide
  const aqueductBonus = hasAqueductIncomeBonus();
  if (aqueductBonus) {
    for (const res of Object.keys(totals) as ResourceType[]) {
      totals[res] = Math.floor((totals[res] ?? 0) * 1.1);
    }
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

  // Tick unrest + check rebellions
  const rebellions: RebellionEvent[] = [];
  const updatedProvinces = allProvinces.map(prov => {
    const traits = getGovernorTraits(prov.id);
    const unrestMod = getUnrestModifier(prov, traits);

    // Unrest change: base growth + investment/governor modifiers
    let unrestDelta = BASE_UNREST_GROWTH + unrestMod;

    // Penalty for expense shortfall — only provinces that have expenses
    if (expenseShortfall > 0 && getProvinceExpenses(prov, traits) > 0) {
      unrestDelta += EXPENSE_SHORTFALL_UNREST;
    }

    const newUnrest = Math.max(0, Math.min(100, prov.unrest + unrestDelta));

    // Rebellion check — Insula suppression raises the effective rebellion threshold.
    // getInsulaSuppression returns 0 (none), 90 (T2), or 101 (T3 = immune).
    // Effective threshold = max(REBELLION_THRESHOLD, suppression).
    let investments = prov.investments;
    const suppression = getInsulaSuppression(prov);
    const effectiveThreshold = Math.max(REBELLION_THRESHOLD, suppression);
    if (newUnrest >= effectiveThreshold && investments.length > 0) {
      // Rebellion! Lose a random investment
      const lostIdx = Math.floor(Math.random() * investments.length);
      const lostName = INVESTMENT_DATA[investments[lostIdx].type].name;
      investments = investments.filter((_, i) => i !== lostIdx);
      rebellions.push({ provinceName: prov.name, lostInvestment: lostName });
    } else if (newUnrest >= effectiveThreshold && investments.length === 0) {
      rebellions.push({ provinceName: prov.name, lostInvestment: null });
    }

    return { ...prov, unrest: newUnrest, investments };
  });

  provinces.value = updatedProvinces;

  return { incomeGained, expensesPaid, expenseShortfall, rebellions };
}

// ── Province bonus aggregation ──

/**
 * Scan all provinces for special investment bonuses and return
 * DoctrineEffect-compatible objects for battle/event consumption.
 *
 * Special bonuses:
 * - Castrum T2: free-units (guard, 1)
 * - Castrum T3: free-units (vanguard, 1)
 * - Basilica T3: extra-event-choices (1)
 * - Pantheon T3: revive (25% HP)
 */
export function getProvinceEffects(): DoctrineEffect[] {
  const effects: DoctrineEffect[] = [];

  for (const prov of provinces.value) {
    for (const inv of prov.investments) {
      if (inv.type === 'castrum' && inv.level >= 2) {
        effects.push({ type: 'free-units', unitRole: 'guard', count: 1 });
      }
      if (inv.type === 'castrum' && inv.level >= 3) {
        effects.push({ type: 'free-units', unitRole: 'vanguard', count: 1 });
      }
      if (inv.type === 'basilica' && inv.level >= 3) {
        effects.push({ type: 'extra-event-choices', count: 1 });
      }
      if (inv.type === 'pantheon' && inv.level >= 3) {
        effects.push({ type: 'revive', hpPercent: 25 });
      }
    }
  }

  return effects;
}

/**
 * Count Market T3 exchange rate bonuses across all provinces.
 * Each Market T3 gives +1 to exchange output.
 */
export function getMarketExchangeBonus(): number {
  let bonus = 0;
  for (const prov of provinces.value) {
    for (const inv of prov.investments) {
      if (inv.type === 'market' && inv.level >= 3) bonus += 1;
    }
  }
  return bonus;
}

/**
 * Check if any province has Aqueduct T3 (all income +10%).
 */
export function hasAqueductIncomeBonus(): boolean {
  for (const prov of provinces.value) {
    for (const inv of prov.investments) {
      if (inv.type === 'aqueduct' && inv.level >= 3) return true;
    }
  }
  return false;
}

/** Reset all province state (called on run end / new run). */
export function resetProvinceStore(): void {
  provinces.value = [];
}
