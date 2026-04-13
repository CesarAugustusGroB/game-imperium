import type { Faction, ResourceType } from '../core/commander';
import type { ResourceCost, TaxLevel, TierTuple, WealthTier } from '../../types/index';
import type { GovernorTrait } from './governor';

// ── Investment types ──

/**
 * The 6 province investments — one per color (Purple gets two: Market + Aqueduct).
 *   Red    → Castrum   (fort)
 *   Blue   → Basilica  (court)
 *   Gold   → Pantheon
 *   Purple → Market
 *   Purple → Aqueduct
 *   White  → Insula    (housing + arena)
 */
export type InvestmentType =
  | 'castrum'
  | 'basilica'
  | 'pantheon'
  | 'market'
  | 'aqueduct'
  | 'insula';

export interface Investment {
  type: InvestmentType;
  /** 1–3 */
  level: number;
}

// ── Province ──

export interface Province {
  id: string;
  /** Display name (usually from the spoke that created it). */
  name: string;
  /** 1–10. Scales base income. */
  population: number;
  /** Upper bound on population growth. Base 10, raised by investments. */
  maxPopulation: number;
  /** Base resource income per spoke (before investment bonuses). */
  baseIncome: Partial<Record<ResourceType, number>>;
  /** 0–100. High unrest reduces income and may trigger a Rebellion event. */
  unrest: number;
  /** Gold upkeep cost per spoke (before investment costs). */
  baseExpenses: number;
  /** Built investments. At most one of each type. */
  investments: Investment[];
  /** Optional: ID of the assigned governor (defined in a later task). */
  governorId?: string;
  /** 0–100+. Provincial wealth pool; drives income scaling and event triggers. */
  wealth: number;
  /** 0–100. War damage that suppresses growth and income. */
  devastation: number;
  /** Seasons remaining on active devastation penalty (counts down to 0). */
  devastationTimer: number;
  /** Number of past rebellions (0–3). Affects max unrest cap and event severity. */
  rebellionCount: number;
  /** Tax rate applied to the lower class (1=Very Low … 5=Very High, default 3=Normal). */
  lowerTax: TaxLevel;
  /** Tax rate applied to the upper class (1=Very Low … 5=Very High, default 3=Normal). */
  upperTax: TaxLevel;
  /** Fractional population growth banked toward the next full population point. */
  growthAccumulator: number;
  /**
   * Seasons remaining during which rebuilding is blocked (post-rebellion rubble).
   * 0 = no rubble. Set to 2 after the 1st/2nd rebellion, 8 after Ruined.
   */
  rubbleTimer: number;
}

// ── Investment data ──

export interface InvestmentLevelEffect {
  incomeBonus: Partial<Record<ResourceType, number>>;
  expensesBonus: number;   // additional gold upkeep
  unrestChange: number;    // negative = suppresses unrest per spoke
  buildCost: ResourceCost; // resources to build / upgrade to this level
  description: string;
}

export interface InvestmentData {
  type: InvestmentType;
  color: Faction;
  name: string;
  /** Short flavour text. */
  flavour: string;
  levels: TierTuple<InvestmentLevelEffect>;
}

export const INVESTMENT_DATA: Record<InvestmentType, InvestmentData> = {
  castrum: {
    type: 'castrum', color: 'red',
    name: 'Castrum',
    flavour: 'A fortified camp that garrisons a permanent legion detachment.',
    levels: [
      { incomeBonus: {},                    expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 5 },                       description: 'Garrison deters minor raids. -5 Unrest/spoke.' },
      { incomeBonus: {},                    expensesBonus: 2, unrestChange: -10, buildCost: { gold: 10, momentum: 3 },          description: 'Full cohort stationed. -10 Unrest/spoke. Free levy unit in defense battles.' },
      { incomeBonus: { momentum: 1 },       expensesBonus: 3, unrestChange: -15, buildCost: { gold: 20, momentum: 6 },          description: 'Veteran legion presence. -15 Unrest/spoke. +1 Momentum/spoke. Free veteran unit.' },
    ],
  },
  basilica: {
    type: 'basilica', color: 'blue',
    name: 'Basilica',
    flavour: 'A court of law that channels political loyalty upward.',
    levels: [
      { incomeBonus: { influence: 1 },      expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 5 },                       description: '+1 Influence/spoke.' },
      { incomeBonus: { influence: 2 },      expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 10, influence: 3 },         description: '+2 Influence/spoke. -5 Unrest/spoke.' },
      { incomeBonus: { influence: 3 },      expensesBonus: 2, unrestChange: -10, buildCost: { gold: 20, influence: 6 },         description: '+3 Influence/spoke. -10 Unrest/spoke. +1 extra event choice.' },
    ],
  },
  pantheon: {
    type: 'pantheon', color: 'gold',
    name: 'Pantheon',
    flavour: 'Temples to the Roman gods maintain divine favour and civic morale.',
    levels: [
      { incomeBonus: { faith: 1 },          expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 5 },                       description: '+1 Faith/spoke. -5 Unrest/spoke.' },
      { incomeBonus: { faith: 2 },          expensesBonus: 1, unrestChange: -10, buildCost: { gold: 10, faith: 3 },             description: '+2 Faith/spoke. -10 Unrest/spoke.' },
      { incomeBonus: { faith: 3 },          expensesBonus: 2, unrestChange: -15, buildCost: { gold: 20, faith: 6 },             description: '+3 Faith/spoke. -15 Unrest/spoke. Units in this province\'s battles revive once.' },
    ],
  },
  market: {
    type: 'market', color: 'purple',
    name: 'Market',
    flavour: 'A bustling forum that taxes trade flowing through the province.',
    levels: [
      { incomeBonus: { gold: 2 },           expensesBonus: 0, unrestChange: 0,   buildCost: { gold: 5 },                       description: '+2 Gold/spoke.' },
      { incomeBonus: { gold: 4 },           expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 12 },                      description: '+4 Gold/spoke.' },
      { incomeBonus: { gold: 6 },           expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 24 },                      description: '+6 Gold/spoke. Resource exchange rates in this province improved by 1.' },
    ],
  },
  aqueduct: {
    type: 'aqueduct', color: 'purple',
    name: 'Aqueduct',
    flavour: 'Running water feeds population growth and scales all income.',
    levels: [
      { incomeBonus: { gold: 1 },           expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 6 },                       description: '+1 Gold/spoke. +1 Population cap. -5 Unrest/spoke.' },
      { incomeBonus: { gold: 2 },           expensesBonus: 2, unrestChange: -5,  buildCost: { gold: 14 },                      description: '+2 Gold/spoke. +2 Population cap. -5 Unrest/spoke.' },
      { incomeBonus: { gold: 3 },           expensesBonus: 2, unrestChange: -10, buildCost: { gold: 26 },                      description: '+3 Gold/spoke. +3 Population cap. -10 Unrest/spoke. All income +10%.' },
    ],
  },
  insula: {
    type: 'insula', color: 'white',
    name: 'Insula & Arena',
    flavour: 'Bread, housing, and spectacles keep the masses content.',
    levels: [
      { incomeBonus: {},                    expensesBonus: 1, unrestChange: -10, buildCost: { gold: 4 },                       description: '-10 Unrest/spoke.' },
      { incomeBonus: {},                    expensesBonus: 2, unrestChange: -20, buildCost: { gold: 10 },                      description: '-20 Unrest/spoke. Rebellion events suppressed at <50 Unrest.' },
      { incomeBonus: { momentum: 1 },       expensesBonus: 2, unrestChange: -30, buildCost: { gold: 18 },                      description: '-30 Unrest/spoke. +1 Momentum/spoke. Rebellion impossible below 70 Unrest.' },
    ],
  },
};

// ── Helpers ──

/**
 * Total income generated by a province each spoke.
 * = base income + investment bonuses, then governor income-bonus % applied per resource.
 */
export function getProvinceIncome(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): Partial<Record<ResourceType, number>> {
  const total: Partial<Record<ResourceType, number>> = { ...province.baseIncome };

  for (const inv of province.investments) {
    const data = INVESTMENT_DATA[inv.type];
    const effect = data.levels[inv.level - 1];
    for (const [res, amt] of Object.entries(effect.incomeBonus) as [ResourceType, number][]) {
      total[res] = (total[res] ?? 0) + amt;
    }
  }

  // Apply governor income-bonus traits (percentage boost per resource)
  for (const trait of governorTraits) {
    if (trait.type === 'income-bonus' && total[trait.resource] != null) {
      total[trait.resource] = Math.floor(total[trait.resource]! * (1 + trait.percent / 100));
    }
  }

  return total;
}

/**
 * Total gold upkeep cost per spoke.
 * Governor expense-reduction trait reduces the total by a percentage.
 */
export function getProvinceExpenses(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): number {
  let total = province.baseExpenses;
  for (const inv of province.investments) {
    total += INVESTMENT_DATA[inv.type].levels[inv.level - 1].expensesBonus;
  }

  // Apply governor expense-reduction traits
  for (const trait of governorTraits) {
    if (trait.type === 'expense-reduction') {
      total = Math.floor(total * (1 - trait.percent / 100));
    }
  }

  return Math.max(0, total);
}

/**
 * Net unrest change per spoke from investments + governor.
 * Negative means unrest is suppressed.
 */
export function getUnrestModifier(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): number {
  let mod = 0;
  for (const inv of province.investments) {
    mod += INVESTMENT_DATA[inv.type].levels[inv.level - 1].unrestChange;
  }

  // Apply governor unrest-reduction traits (flat reduction)
  for (const trait of governorTraits) {
    if (trait.type === 'unrest-reduction') {
      mod -= trait.flat;
    }
  }

  return mod;
}

/**
 * Get investment cost discount percentage from governor traits.
 * Returns 0 if no discount applies.
 */
export function getInvestmentDiscount(governorTraits: GovernorTrait[]): number {
  let discount = 0;
  for (const trait of governorTraits) {
    if (trait.type === 'investment-discount') {
      discount += trait.percent;
    }
  }
  return discount;
}

/**
 * Apply investment discount to a resource cost. Returns a new cost object.
 */
export function applyInvestmentDiscount(cost: ResourceCost, discountPercent: number): ResourceCost {
  if (discountPercent <= 0) return cost;
  const result: ResourceCost = {};
  for (const [res, amt] of Object.entries(cost) as [ResourceType, number][]) {
    result[res] = Math.max(1, Math.floor(amt * (1 - discountPercent / 100)));
  }
  return result;
}

/**
 * Factory — creates a new Province with sensible defaults.
 */
export function createProvince(name: string, overrides?: Partial<Province>): Province {
  return {
    id: name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
    name,
    population: 3,
    maxPopulation: 10,
    baseIncome: { gold: 2 },
    unrest: 20,
    baseExpenses: 1,
    investments: [],
    wealth: 40,
    devastation: 0,
    devastationTimer: 0,
    rebellionCount: 0,
    lowerTax: 3,
    upperTax: 3,
    growthAccumulator: 0,
    rubbleTimer: 0,
    ...overrides,
  };
}

// ── Wealth tier system ──

/**
 * Map a raw wealth value to a WealthTier (1–5).
 * Wealth is floored at 0 before lookup.
 *
 * Tiers:  0–15 → 1 (Destitute)
 *        16–35 → 2 (Poor)
 *        36–55 → 3 (Growing)
 *        56–80 → 4 (Prosperous)
 *          81+ → 5 (Wealthy)
 */
export function getWealthTier(wealth: number): WealthTier {
  const w = Math.max(0, wealth);
  if (w <= 15) return 1;
  if (w <= 35) return 2;
  if (w <= 55) return 3;
  if (w <= 80) return 4;
  return 5;
}

/** Income multiplier for a given wealth tier (0.50x – 1.50x). */
export function getWealthMultiplier(tier: WealthTier): number {
  const MULTIPLIERS: Record<WealthTier, number> = {
    1: 0.50,
    2: 0.75,
    3: 1.00,
    4: 1.25,
    5: 1.50,
  };
  return MULTIPLIERS[tier];
}

/** Display label for a given wealth tier. */
export function getWealthLabel(tier: WealthTier): string {
  const LABELS: Record<WealthTier, string> = {
    1: 'Destitute',
    2: 'Poor',
    3: 'Growing',
    4: 'Prosperous',
    5: 'Wealthy',
  };
  return LABELS[tier];
}

// ── Tax multiplier system ──

/** Display label for a TaxLevel (1=Minimal … 5=Oppressive). */
export function getTaxLabel(level: TaxLevel): string {
  const LABELS: Record<TaxLevel, string> = {
    1: 'Minimal',
    2: 'Low',
    3: 'Normal',
    4: 'High',
    5: 'Oppressive',
  };
  return LABELS[level];
}

/**
 * Gold income multiplier from the dual tax sliders.
 * Combined = lowerTax + upperTax (range 2–10).
 * Anchor points: 2→0.50, 4→0.70, 6→1.00, 8→1.30, 10→1.60.
 * Odd combined values are midpoints between adjacent anchors.
 */
export function getTaxMultiplier(lowerTax: TaxLevel, upperTax: TaxLevel): number {
  const MULTIPLIERS: Record<number, number> = {
    2: 0.50,
    3: 0.60,
    4: 0.70,
    5: 0.85,
    6: 1.00,
    7: 1.15,
    8: 1.30,
    9: 1.45,
    10: 1.60,
  };
  return MULTIPLIERS[lowerTax + upperTax];
}

/**
 * Pop growth penalty (%) applied by lower-class tax level.
 * Returns a negative percentage (0 = no penalty, -70 = severe penalty).
 */
export function getLowerTaxGrowthPenalty(level: TaxLevel): number {
  const PENALTIES: Record<TaxLevel, number> = {
    1: 0,
    2: -10,
    3: -25,
    4: -45,
    5: -70,
  };
  return PENALTIES[level];
}

/**
 * Unrest change per season from the lower-class tax level.
 * Negative suppresses unrest; positive increases it.
 */
export function getLowerTaxUnrest(level: TaxLevel): number {
  const UNREST: Record<TaxLevel, number> = {
    1: -3,
    2: -1,
    3: 0,
    4: 3,
    5: 8,
  };
  return UNREST[level];
}

/**
 * Unrest change per season from the upper-class tax level.
 * Negative suppresses unrest; positive increases it.
 */
export function getUpperTaxUnrest(level: TaxLevel): number {
  const UNREST: Record<TaxLevel, number> = {
    1: -2,
    2: 0,
    3: 0,
    4: 3,
    5: 8,
  };
  return UNREST[level];
}

// ── Wealth generation (NWG / PWG) ──

/** PWG bonus from terrain type (Hills +1, Coast +1, Desert +2; others +0). */
const TERRAIN_PWG: Record<string, number> = { hills: 1, coast: 1, desert: 2 };

/** PWG bonus contributed by a Market investment, by level. */
const MARKET_PWG: Record<number, number> = { 1: 2, 2: 3, 3: 4 };

/** NWG formula coefficients [flat, multiplier] per upperTax level. */
const NWG_PARAMS: Record<TaxLevel, [number, number]> = {
  1: [0.5,  0.05],
  2: [1.0,  0.10],
  3: [1.5,  0.20],
  4: [3.0,  0.50],
  5: [5.0,  1.00],
};

/**
 * Positive Wealth Generation per season.
 * Sources: base 2 + terrain bonus + Market investment level.
 * Pass terrain string (e.g. "hills", "coast") for terrain-aware callers;
 * omit or pass undefined for terrain-agnostic contexts.
 */
export function calculatePWG(province: Province, terrain?: string): number {
  let pwg = 2;
  if (terrain) pwg += TERRAIN_PWG[terrain.toLowerCase()] ?? 0;
  for (const inv of province.investments) {
    if (inv.type === 'market') pwg += MARKET_PWG[inv.level] ?? 0;
  }
  return pwg;
}

/**
 * Negative Wealth Generation per season (ETW-adapted).
 * Upper class tax extracts a flat drain plus a fraction of PWG.
 * Result is always negative.
 */
export function calculateNWG(pwg: number, upperTax: TaxLevel): number {
  const [flat, mult] = NWG_PARAMS[upperTax];
  return -(flat + mult * pwg);
}

/**
 * Net wealth change per season = PWG + NWG − devastation drain.
 * Devastation drain is −2/season while devastationTimer > 0.
 */
export function calculateNetWealthChange(province: Province, terrain?: string): number {
  const pwg = calculatePWG(province, terrain);
  const nwg = calculateNWG(pwg, province.upperTax);
  const devastationDrain = province.devastationTimer > 0 ? -2 : 0;
  return pwg + nwg + devastationDrain;
}

// ── Population → building slots ──

/**
 * Number of building slots available at a given population.
 *
 * Pop 1–2 → 1  (Settlement)
 * Pop 3–4 → 2  (Village)
 * Pop 5–6 → 3  (Town)
 * Pop 7–8 → 4  (City)
 * Pop 9–10 → 5 (Major City)
 * Pop 11+  → 6 (Metropolis)
 */
export function getBuildingSlots(pop: number): number {
  if (pop <= 2)  return 1;
  if (pop <= 4)  return 2;
  if (pop <= 6)  return 3;
  if (pop <= 8)  return 4;
  if (pop <= 10) return 5;
  return 6;
}

/** Settlement size label for a given population. */
export function getSettlementLabel(pop: number): string {
  if (pop <= 2)  return 'Settlement';
  if (pop <= 4)  return 'Village';
  if (pop <= 6)  return 'Town';
  if (pop <= 8)  return 'City';
  if (pop <= 10) return 'Major City';
  return 'Metropolis';
}

// ── Population growth accumulator ──

/** Terrain growth contribution (plains/unknown = 1, coast = 2, desert = 0). */
const TERRAIN_GROWTH: Record<string, number> = {
  plains: 1, hills: 1, forest: 1, coast: 2, desert: 0,
};

/** Aqueduct growth-rate bonus per level (each level adds +1 growth/season). */
const AQUEDUCT_GROWTH: Record<number, number> = { 1: 1, 2: 1, 3: 1 };

/** Growth threshold to gain 1 population point: `8 + current_pop × 2`. */
export function calculateGrowthThreshold(currentPop: number): number {
  return 8 + currentPop * 2;
}

/**
 * Raw growth per season = terrain + aqueduct + governor pop-growth traits.
 * Trade goods and features not yet implemented; they contribute 0.
 */
export function calculateRawGrowth(
  province: Province,
  terrain?: string,
  governorTraits: GovernorTrait[] = [],
): number {
  let raw = terrain ? (TERRAIN_GROWTH[terrain.toLowerCase()] ?? 1) : 1;

  for (const inv of province.investments) {
    if (inv.type === 'aqueduct') raw += AQUEDUCT_GROWTH[inv.level] ?? 0;
  }

  for (const trait of governorTraits) {
    if (trait.type === 'population-growth') raw += trait.amount;
  }

  return raw;
}

/**
 * Effective growth after penalties:
 *   effective = raw × (1 − lower_tax_penalty) × (1 − devastation_penalty)
 * Lower tax penalty: 0 / 0.10 / 0.25 / 0.45 / 0.70.
 * Devastation penalty: 0.50 while devastationTimer > 0.
 */
export function calculateEffectiveGrowth(
  province: Province,
  terrain?: string,
  governorTraits: GovernorTrait[] = [],
): number {
  const raw = calculateRawGrowth(province, terrain, governorTraits);
  const taxPenalty = Math.abs(getLowerTaxGrowthPenalty(province.lowerTax)) / 100;
  const devastationPenalty = province.devastationTimer > 0 ? 0.5 : 0;
  return raw * (1 - taxPenalty) * (1 - devastationPenalty);
}

/**
 * Advance one season of population growth.
 * Adds effective growth to growthAccumulator; when threshold is reached,
 * increments population by 1 (capped at maxPopulation) and resets accumulator
 * by subtracting the threshold (preserving overflow).
 * Returns an updated Province — does NOT mutate the input.
 */
export function tickPopulationGrowth(
  province: Province,
  terrain?: string,
  governorTraits: GovernorTrait[] = [],
): Province {
  if (province.population >= province.maxPopulation) {
    return province; // already at cap
  }

  const growth = calculateEffectiveGrowth(province, terrain, governorTraits);
  const newAccumulator = province.growthAccumulator + growth;
  const threshold = calculateGrowthThreshold(province.population);

  if (newAccumulator >= threshold) {
    const newPop = Math.min(province.population + 1, province.maxPopulation);
    return { ...province, population: newPop, growthAccumulator: newAccumulator - threshold };
  }

  return { ...province, growthAccumulator: newAccumulator };
}

// ── Unrest + rebellion system ──

/**
 * Net unrest change per season.
 *   base  = tax_unrest + doom − 2 (natural decay) + investment/governor modifier
 *   accel = (unrest > 60) ? (unrest − 60) × 0.25 : 0
 *   total = base + accel
 *
 * `doom` is an external event pressure (default 0).
 * `getUnrestModifier()` is negative when buildings/governor suppress unrest.
 */
export function calculateUnrestDelta(
  province: Province,
  governorTraits: GovernorTrait[] = [],
  doom: number = 0,
): number {
  const taxUnrest = getLowerTaxUnrest(province.lowerTax) + getUpperTaxUnrest(province.upperTax);
  const mod = getUnrestModifier(province, governorTraits); // negative = suppresses unrest
  const base = taxUnrest + doom - 2 + mod;
  const accel = province.unrest > 60 ? (province.unrest - 60) * 0.25 : 0;
  return base + accel;
}

/**
 * Unrest threshold at which a rebellion fires.
 * Default 80. Insula level 3 suppresses event-driven triggers below 70,
 * but the structural threshold remains 80.
 */
export function getRebelThreshold(_province: Province): number {
  return 80;
}

// ── Rebellion helpers ──

/** Numeric "value" of a built investment — used to weight destruction. */
function investmentCostValue(inv: Investment): number {
  const cost = INVESTMENT_DATA[inv.type].levels[inv.level - 1].buildCost;
  // Gold + resource costs (other resources treated as 2× gold equivalent)
  return (cost.gold ?? 0)
    + (cost.momentum ?? 0) * 2
    + (cost.influence ?? 0) * 2
    + (cost.faith ?? 0) * 2;
}

/**
 * Destroy the `count` most expensive investments.
 * Returns the surviving investments (immutable).
 */
function destroyMostExpensive(investments: Investment[], count: number): Investment[] {
  if (count >= investments.length) return [];
  const sorted = [...investments].sort((a, b) => investmentCostValue(b) - investmentCostValue(a));
  return sorted.slice(count);
}

/**
 * Apply rebellion consequences to a province. Returns a new Province object.
 *
 * rebellionCount 0 → 1st rebellion: destroy 1–2 buildings, −1 max pop,
 *   unrest→40, devastation 4 seasons, rubble 2 seasons.
 * rebellionCount 1 → 2nd rebellion: destroy 2 buildings, −2 max pop,
 *   same devastation + rubble.
 * rebellionCount 2 → 3rd rebellion (Ruined): all buildings gone, pop→1,
 *   wealth→0, 8-season devastation + rubble.
 *
 * `rng` defaults to Math.random — injectable for deterministic tests.
 */
export function applyRebellion(
  province: Province,
  rng: () => number = Math.random,
): Province {
  const n = province.rebellionCount;

  if (n >= 3) return province; // already Ruined, no further effect

  // ── 3rd rebellion: Ruined ──
  if (n === 2) {
    return {
      ...province,
      investments: [],
      population: 1,
      wealth: 0,
      unrest: 40,
      devastationTimer: 8,
      rubbleTimer: 8,
      rebellionCount: 3,
    };
  }

  // ── 1st or 2nd rebellion ──
  const destroyCount = n === 0 ? (rng() < 0.5 ? 1 : 2) : 2;
  const maxPopReduction = n === 0 ? 1 : 2;

  return {
    ...province,
    investments: destroyMostExpensive(province.investments, destroyCount),
    maxPopulation: Math.max(1, province.maxPopulation - maxPopReduction),
    unrest: 40,
    devastationTimer: 4,
    rubbleTimer: 2,
    rebellionCount: n + 1,
  };
}
