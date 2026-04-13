import { signal } from '@preact/signals';
import type { Province, InvestmentType } from './province';
import {
  createProvince, INVESTMENT_DATA,
  getInvestmentDiscount, applyInvestmentDiscount,
  getProvinceExpenses, getBuildingSlots,
  getWealthTier, getWealthMultiplier,
  getTaxMultiplier,
  calculateNetWealthChange,
  tickPopulationGrowth,
  calculateUnrestDelta, getRebelThreshold, applyRebellion,
} from './province';
import type { ResourceType } from '../core/commander';
import type { DoctrineEffect } from '../items/doctrine';
import type { ResourceCost } from '../../types/index';
import { getResource, spendResource, addResource } from '../core/resources';
import { getGovernorTraits, getGovernorSalary, registerProvinceSyncCallback } from './governor-store';
import { claimTerritory } from './province-map-store';
import { nextInvestmentDiscount } from '../progression/strategic-store';
import { addNotification } from '../../ui/notifications/notification-store';

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

  // Rubble gate: rebuilding is blocked while rubbleTimer is active
  if (province.rubbleTimer > 0) return false;

  // Slot gate: new buildings consume a slot; upgrades do not
  const isNew = !province.investments.some(i => i.type === type);
  if (isNew && province.investments.length >= getBuildingSlots(province.population)) return false;

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

// ── Season income + province tick cycle ──

/** Unrest penalty when province expenses can't be paid. */
const EXPENSE_SHORTFALL_UNREST = 10;

export interface RebellionEvent {
  provinceName: string;
  lostInvestment: string | null; // first investment name lost, or null
}

export interface ProvinceIncomeResult {
  incomeGained: { resource: ResourceType; amount: number }[];
  expensesPaid: number;
  expenseShortfall: number;
  rebellions: RebellionEvent[];
}

/**
 * Rewritten season tick — wires all S16 sub-systems in spec order.
 *
 * Per-season tick order (per spec):
 *  1. Calculate income: building_gold × wealthTier × taxMultiplier + 1 subsistence
 *     Non-gold resources × wealthTier only (no tax).
 *  2. Calculate expenses (buildings + governor).
 *  3. Apply net income/expenses to global resources.
 *  4. Tick wealth (PWG + NWG − devastation drain).
 *  5. Wealth tier is derived from wealth — no stored field.
 *  6. Tick pop growth accumulator, check threshold.
 *  7. Tick unrest (tax + doom − decay + buildings + governor + exponential accel).
 *  8. Check rebellion at threshold, apply if triggered.
 *  9. Decrement devastation and rubble timers.
 */
export function collectProvinceIncome(): ProvinceIncomeResult {
  const allProvinces = provinces.value;

  // ── Steps 1–2: aggregate empire income & expenses ──
  const totals: Partial<Record<ResourceType, number>> = {};
  let totalExpenses = 0;

  for (const prov of allProvinces) {
    const traits = getGovernorTraits(prov.id);
    const wealthMult = getWealthMultiplier(getWealthTier(prov.wealth));
    const taxMult = getTaxMultiplier(prov.lowerTax, prov.upperTax);

    // Split building income into gold vs non-gold
    let buildingGold = 0;
    const nonGold: Partial<Record<ResourceType, number>> = {};
    for (const inv of prov.investments) {
      const effect = INVESTMENT_DATA[inv.type].levels[inv.level - 1];
      for (const [res, amt] of Object.entries(effect.incomeBonus) as [ResourceType, number][]) {
        if (res === 'gold') buildingGold += amt;
        else nonGold[res] = (nonGold[res] ?? 0) + amt;
      }
    }

    // Gold: building gold × wealth × tax, plus 1 subsistence always
    const provIncome: Partial<Record<ResourceType, number>> = {
      gold: Math.round(buildingGold * wealthMult * taxMult) + 1,
    };

    // Non-gold: wealth multiplier only (no tax)
    for (const [res, amt] of Object.entries(nonGold) as [ResourceType, number][]) {
      provIncome[res] = Math.round(amt * wealthMult);
    }

    // Governor income-bonus trait applied after multipliers
    for (const trait of traits) {
      if (trait.type === 'income-bonus' && provIncome[trait.resource] != null) {
        provIncome[trait.resource] = Math.floor(
          provIncome[trait.resource]! * (1 + trait.percent / 100),
        );
      }
    }

    for (const [res, amt] of Object.entries(provIncome) as [ResourceType, number][]) {
      if (amt > 0) totals[res] = (totals[res] ?? 0) + amt;
    }
    totalExpenses += getProvinceExpenses(prov, traits) + getGovernorSalary(prov.id);
  }

  // Aqueduct T3 empire-wide bonus: +10% all income
  if (hasAqueductIncomeBonus()) {
    for (const res of Object.keys(totals) as ResourceType[]) {
      totals[res] = Math.floor((totals[res] ?? 0) * 1.1);
    }
  }

  // Step 3: add income, drain expenses
  const incomeGained: { resource: ResourceType; amount: number }[] = [];
  for (const [res, amt] of Object.entries(totals) as [ResourceType, number][]) {
    if (amt > 0) {
      addResource(res, amt);
      incomeGained.push({ resource: res, amount: amt });
    }
  }

  let expensesPaid = 0;
  let expenseShortfall = 0;
  if (totalExpenses > 0) {
    if (spendResource('gold', totalExpenses)) {
      expensesPaid = totalExpenses;
    } else {
      expenseShortfall = totalExpenses;
      addNotification({
        kind: 'pinned',
        icon: '⚠',
        title: 'Upkeep Shortfall',
        message: `Can't cover all upkeep. Provinces gaining +${EXPENSE_SHORTFALL_UNREST} unrest.`,
        color: '#d4a843',
      });
    }
  }

  // ── Steps 4–9: per-province tick ──
  const rebellions: RebellionEvent[] = [];
  const updatedProvinces = allProvinces.map(prov => {
    const traits = getGovernorTraits(prov.id);
    let p = prov;

    // 4. Tick wealth (clamp 0–200)
    const netWealth = calculateNetWealthChange(p);
    p = { ...p, wealth: Math.min(200, Math.max(0, p.wealth + netWealth)) };

    // 6. Tick population growth accumulator
    p = tickPopulationGrowth(p, undefined, traits);

    // 7. Tick unrest: new formula + expense shortfall penalty
    let unrestDelta = calculateUnrestDelta(p, traits);
    if (expenseShortfall > 0 && getProvinceExpenses(p, traits) > 0) {
      unrestDelta += EXPENSE_SHORTFALL_UNREST;
    }
    p = { ...p, unrest: Math.max(0, Math.min(100, p.unrest + unrestDelta)) };

    // 8. Rebellion check (threshold includes Insula suppression)
    if (p.unrest >= getRebelThreshold(p)) {
      const beforeInvestments = p.investments;
      const beforeCount = p.rebellionCount;
      p = applyRebellion(p);

      // Determine what was lost for the notification
      let lostName: string | null = null;
      if (p.rebellionCount > beforeCount) {
        if (beforeCount >= 2) {
          // Ruined: all buildings gone
          lostName = beforeInvestments.length > 0
            ? INVESTMENT_DATA[beforeInvestments[0].type].name
            : null;
        } else {
          const lost = beforeInvestments.find(i => !p.investments.some(j => j.type === i.type));
          lostName = lost ? INVESTMENT_DATA[lost.type].name : null;
        }
      }

      rebellions.push({ provinceName: prov.name, lostInvestment: lostName });
      addNotification({
        kind: 'alert',
        icon: '⚔',
        title: beforeCount >= 2 ? 'Province Ruined!' : 'Rebellion',
        message: beforeCount >= 2
          ? `${prov.name} is ruined — all buildings destroyed.`
          : `${prov.name} has rebelled!${lostName ? ` ${lostName} lost.` : ''}`,
        color: '#c24a3a',
        duration: 4000,
      });
    }

    // 9. Decrement timers
    p = {
      ...p,
      devastationTimer: Math.max(0, p.devastationTimer - 1),
      rubbleTimer: Math.max(0, p.rubbleTimer - 1),
    };

    return p;
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
