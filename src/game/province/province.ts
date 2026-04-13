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
