import { signal } from '@preact/signals';
import type { Province, InvestmentType } from './province';
import { getActiveSynergies } from './province';
import {
  createProvince, INVESTMENT_DATA,
  getInvestmentDiscount, applyInvestmentDiscount,
  getProvinceIncome, getProvinceExpenses, getBuildingSlots,
  calculateInitialWealth,
  calculateNetWealthChange,
  tickFamine,
  tickPopulationGrowth,
  rollImmigration,
  calculateUnrestDelta, getRebelThreshold, applyRebellion,
  getAvailableBuildings,
} from './province';
import type { ResourceType } from '../core/commander';
import type { ResourceCost, TaxLevel } from '../../types/index';
import { getResource, spendResource, addResource } from '../core/resources';
import { getGovernorTraits, getGovernorSalary, dismissGovernor, registerProvinceSyncCallback } from './governor-store';
import { assignNextFeature } from './feature-store';
import { claimTerritory, claimTerritoryAt } from './province-map-store';
import { nextInvestmentDiscount } from '../progression/strategic-store';
import { isUpkeepWaived, tickActiveDecretumEffects } from '../items/decretum-hub';
import { addNotification } from '../../ui/notifications/notification-store';
import { TERRAIN_DATA } from '../../data/terrain-data';
import type { TerrainType } from '../../data/terrain-data';
import { getTradeGoodsForTerrain, TRADE_GOOD_DATA } from '../../data/trade-goods';
import type { TradeGoodType } from '../../data/trade-goods';

// ── Province signals ──

/** All provinces conquered in the current run. */
export const provinces = signal<Province[]>([]);

// ── Management ──

// All terrain types as an array, filtered to those with at least one valid trade good.
// Mountains currently has no trade goods defined, so it is excluded from the pool.
const TERRAIN_POOL: TerrainType[] = (Object.keys(TERRAIN_DATA) as TerrainType[]).filter(
  t => getTradeGoodsForTerrain(t).length > 0,
);

/**
 * Randomly assign a terrain type and a valid trade good for that terrain.
 * Terrain is picked uniformly from the TERRAIN_POOL (terrains with ≥ 1 trade good).
 * Trade good is picked uniformly from goods valid for the chosen terrain.
 */
export function assignProvinceIdentity(): { terrain: TerrainType; tradeGood: TradeGoodType } {
  const terrain = TERRAIN_POOL[Math.floor(Math.random() * TERRAIN_POOL.length)];
  const goods = getTradeGoodsForTerrain(terrain);
  const tradeGood = goods[Math.floor(Math.random() * goods.length)];
  return { terrain, tradeGood };
}

/**
 * Create a province from a completed spoke and add it to the store.
 * @param name      — province display name
 * @param gains     — total resources earned during the spoke
 * @param duration  — spoke duration in seasons (used to scale baseIncome)
 * @param overrides — optional pre-rolled identity; when provided, skips random assignment
 */
export function conquerProvince(
  name: string,
  gains: Record<ResourceType, number>,
  duration: number,
  overrides?: { terrain?: TerrainType; tradeGood?: TradeGoodType; mapIndex?: number },
): Province {
  // Scale one-time gains down to a per-spoke income rate
  const divisor = Math.max(1, duration);
  const baseIncome: Partial<Record<ResourceType, number>> = {};
  for (const [res, amt] of Object.entries(gains) as [ResourceType, number][]) {
    const perSpoke = Math.max(1, Math.round(amt / divisor));
    if (perSpoke > 0) baseIncome[res] = perSpoke;
  }

  const { terrain, tradeGood } = (overrides?.terrain && overrides?.tradeGood)
    ? { terrain: overrides.terrain, tradeGood: overrides.tradeGood }
    : assignProvinceIdentity();
  const wealth = calculateInitialWealth(terrain, tradeGood, 3);
  const uniqueFeature = assignNextFeature();
  const province = createProvince(name, { baseIncome, terrain, tradeGood, wealth, uniqueFeature });
  provinces.value = [...provinces.value, province];

  // Claim the chosen map territory, or auto-pick if no specific index provided
  if (overrides?.mapIndex !== undefined) {
    claimTerritoryAt(province.id, overrides.mapIndex);
  } else {
    claimTerritory(province.id);
  }

  // Feature discovery notification (S19-03)
  if (uniqueFeature) {
    const bonuses: string[] = [];
    if (uniqueFeature.goldPerSeason) bonuses.push(`${uniqueFeature.goldPerSeason > 0 ? '+' : ''}${uniqueFeature.goldPerSeason}g`);
    if (uniqueFeature.foodPerSeason) bonuses.push(`+${uniqueFeature.foodPerSeason} food`);
    if (uniqueFeature.iunioresPerSeason) bonuses.push(`+${uniqueFeature.iunioresPerSeason} iuniores`);
    if (uniqueFeature.unrestPerSeason) bonuses.push(`${uniqueFeature.unrestPerSeason} unrest`);
    if (uniqueFeature.beautinessBonus) bonuses.push(`+${uniqueFeature.beautinessBonus}% beauty`);
    if (uniqueFeature.buildCostDiscount) bonuses.push(`-${uniqueFeature.buildCostDiscount}% build cost`);
    if (uniqueFeature.wealthGrowthBonus) bonuses.push(`+${uniqueFeature.wealthGrowthBonus} PWG`);
    addNotification({
      kind: 'pinned',
      icon: '🏛',
      title: `${uniqueFeature.name} discovered!`,
      message: `${bonuses.join(', ')}. ${uniqueFeature.flavour}`,
      color: '#f0d080',
    });
  }

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

  // Terrain gate: building must be available for this province's terrain
  if (!getAvailableBuildings(province).includes(type)) return false;

  // Forge gate: Forge also requires the Iron trade good (Hills terrain implied by terrain gate)
  if ((type as string) === 'forge' && province.tradeGood !== 'iron') return false;

  // Slot gate: new buildings consume a slot; upgrades do not
  const isNew = !province.investments.some(i => i.type === type);
  if (isNew && province.investments.length >= getBuildingSlots(province.population)) return false;

  const data = INVESTMENT_DATA[type];
  const baseCost = data.levels[nextLevel - 1].buildCost;

  // Apply governor + scroll investment discounts
  const traits = getGovernorTraits(provinceId);
  const governorDiscount = getInvestmentDiscount(traits, province);
  const scrollDiscount = nextInvestmentDiscount.value;
  // Trade good build-cost discount: Marble -15%, Timber -10%
  let tradeDiscount = 0;
  if (province.tradeGood) {
    const special = TRADE_GOOD_DATA[province.tradeGood].special;
    if (special?.type === 'build-cost-discount') tradeDiscount = special.percent;
  }
  const effectiveDiscount = Math.min(90, governorDiscount + scrollDiscount + tradeDiscount);
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
 * Update the tax levels for a province. Changes take effect on the next season tick.
 */
export function setProvinceTax(provinceId: string, lowerTax: TaxLevel, upperTax: TaxLevel): boolean {
  const idx = provinces.value.findIndex(p => p.id === provinceId);
  if (idx === -1) return false;
  const arr = [...provinces.value];
  arr[idx] = { ...arr[idx], lowerTax, upperTax };
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
 *  1. Calculate income: taxRevenue (wealth × taxRate) + building_gold + 1 subsistence.
 *     Non-gold resources are flat (no wealth/tax scaling).
 *  2. Calculate expenses (buildings + governor).
 *  3. Apply net income/expenses to global resources.
 *  4. Tick wealth (PWG + NWG − devastation drain).
 *  5. Wealth tier is derived from wealth — no stored field.
 *  6. Tick pop growth accumulator, check threshold.
 *  7. Tick unrest (tax + famine − decay + buildings + governor + exponential accel).
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

    // Per-province gross income — shared with every income display via
    // getProvinceIncome so the ledger and the tick can never diverge.
    const provIncome = getProvinceIncome(prov, traits);
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
  // An active waive-upkeep decretum (e.g. SUPPLY/ANNONA) suspends the gold
  // upkeep drain for this season — no payment, no shortfall.
  const upkeepWaived = isUpkeepWaived();
  if (totalExpenses > 0 && !upkeepWaived) {
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

    // 4. Tick wealth (accumulative, clamp 0–9999)
    const netWealth = calculateNetWealthChange(p, p.terrain);
    p = { ...p, wealth: Math.min(9999, Math.max(0, p.wealth + netWealth)) };

    // 5b. Tick famine (S20): update famineTimer, hard phase kills pops
    const prePop = p.population;
    const preFamine = p.famineTimer;
    p = tickFamine(p, traits);
    // Famine transition notifications (fire only on state change, not every season)
    if (p.population < prePop) {
      // Actual pop death occurred — hard famine
      addNotification({
        kind: 'alert', icon: '💀', title: 'Famine',
        message: `${prov.name} is starving — losing population!`,
        color: '#c24a3a', duration: 4000,
      });
    } else if (preFamine === 0 && p.famineTimer >= 1) {
      addNotification({
        kind: 'toast', icon: '🌾', title: 'Food Shortage',
        message: `${prov.name} cannot feed its people. Growth halted.`,
        color: '#d4a843',
      });
    }

    // 6. Tick population growth accumulator (food-surplus driven, S20)
    p = tickPopulationGrowth(p, p.terrain, traits);

    // 6b. Immigration roll (S20): d100 vs beautiness%, +1 pop on success
    const immigrationResult = rollImmigration(p);
    p = immigrationResult.province;
    if (immigrationResult.immigrated) {
      addNotification({
        kind: 'toast', icon: '🏛', title: 'New Settler',
        message: `${prov.name} attracted a new settler!`,
        color: '#5a8a4a',
      });
    }

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

      // Auto-dismiss governor on Ruined (3rd rebellion) — no point paying salary
      if (beforeCount >= 2) {
        dismissGovernor(prov.id);
      }
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

  // Age continuous Hub effects (upkeep waivers) by one season; those that hit
  // zero drop out. Read above as `upkeepWaived` so this season is still covered.
  tickActiveDecretumEffects();

  return { incomeGained, expensesPaid, expenseShortfall, rebellions };
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

/**
 * Empire-wide recruit-cost discount (%) from active province synergies —
 * Castrum+Forge "Military-Industrial". Summed across all provinces, capped at 50%.
 */
export function getEmpireRecruitDiscount(): number {
  let pct = 0;
  for (const prov of provinces.value) {
    for (const syn of getActiveSynergies(prov)) {
      if (syn.bonus.type === 'unit-cost-discount') pct += syn.bonus.percent;
    }
  }
  return Math.min(50, pct);
}

/** Reset all province state (called on run end / new run). */
export function resetProvinceStore(): void {
  provinces.value = [];
}
