import type { Faction, ResourceType } from './commander';

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
}

// ── Investment data ──

interface InvestmentLevelEffect {
  incomeBonus: Partial<Record<ResourceType, number>>;
  expensesBonus: number;   // additional gold upkeep
  unrestChange: number;    // negative = suppresses unrest per spoke
  description: string;
}

interface InvestmentData {
  type: InvestmentType;
  color: Faction;
  name: string;
  /** Short flavour text. */
  flavour: string;
  levels: [InvestmentLevelEffect, InvestmentLevelEffect, InvestmentLevelEffect];
}

export const INVESTMENT_DATA: Record<InvestmentType, InvestmentData> = {
  castrum: {
    type: 'castrum', color: 'red',
    name: 'Castrum',
    flavour: 'A fortified camp that garrisons a permanent legion detachment.',
    levels: [
      { incomeBonus: {},                    expensesBonus: 1, unrestChange: -5,  description: 'Garrison deters minor raids. -5 Unrest/spoke.' },
      { incomeBonus: {},                    expensesBonus: 2, unrestChange: -10, description: 'Full cohort stationed. -10 Unrest/spoke. Free levy unit in defense battles.' },
      { incomeBonus: { momentum: 1 },       expensesBonus: 3, unrestChange: -15, description: 'Veteran legion presence. -15 Unrest/spoke. +1 Momentum/spoke. Free veteran unit.' },
    ],
  },
  basilica: {
    type: 'basilica', color: 'blue',
    name: 'Basilica',
    flavour: 'A court of law that channels political loyalty upward.',
    levels: [
      { incomeBonus: { influence: 1 },      expensesBonus: 1, unrestChange: 0,   description: '+1 Influence/spoke.' },
      { incomeBonus: { influence: 2 },      expensesBonus: 1, unrestChange: -5,  description: '+2 Influence/spoke. -5 Unrest/spoke.' },
      { incomeBonus: { influence: 3 },      expensesBonus: 2, unrestChange: -10, description: '+3 Influence/spoke. -10 Unrest/spoke. +1 extra event choice.' },
    ],
  },
  pantheon: {
    type: 'pantheon', color: 'gold',
    name: 'Pantheon',
    flavour: 'Temples to the Roman gods maintain divine favour and civic morale.',
    levels: [
      { incomeBonus: { faith: 1 },          expensesBonus: 1, unrestChange: -5,  description: '+1 Faith/spoke. -5 Unrest/spoke.' },
      { incomeBonus: { faith: 2 },          expensesBonus: 1, unrestChange: -10, description: '+2 Faith/spoke. -10 Unrest/spoke.' },
      { incomeBonus: { faith: 3 },          expensesBonus: 2, unrestChange: -15, description: '+3 Faith/spoke. -15 Unrest/spoke. Units in this province\'s battles revive once.' },
    ],
  },
  market: {
    type: 'market', color: 'purple',
    name: 'Market',
    flavour: 'A bustling forum that taxes trade flowing through the province.',
    levels: [
      { incomeBonus: { gold: 2 },           expensesBonus: 0, unrestChange: 0,   description: '+2 Gold/spoke.' },
      { incomeBonus: { gold: 4 },           expensesBonus: 1, unrestChange: 0,   description: '+4 Gold/spoke.' },
      { incomeBonus: { gold: 6 },           expensesBonus: 1, unrestChange: 0,   description: '+6 Gold/spoke. Resource exchange rates in this province improved by 1.' },
    ],
  },
  aqueduct: {
    type: 'aqueduct', color: 'purple',
    name: 'Aqueduct',
    flavour: 'Running water feeds population growth and scales all income.',
    levels: [
      { incomeBonus: { gold: 1 },           expensesBonus: 1, unrestChange: -5,  description: '+1 Gold/spoke. +1 Population cap. -5 Unrest/spoke.' },
      { incomeBonus: { gold: 2 },           expensesBonus: 2, unrestChange: -5,  description: '+2 Gold/spoke. +2 Population cap. -5 Unrest/spoke.' },
      { incomeBonus: { gold: 3 },           expensesBonus: 2, unrestChange: -10, description: '+3 Gold/spoke. +3 Population cap. -10 Unrest/spoke. All income +10%.' },
    ],
  },
  insula: {
    type: 'insula', color: 'white',
    name: 'Insula & Arena',
    flavour: 'Bread, housing, and spectacles keep the masses content.',
    levels: [
      { incomeBonus: {},                    expensesBonus: 1, unrestChange: -10, description: '-10 Unrest/spoke.' },
      { incomeBonus: {},                    expensesBonus: 2, unrestChange: -20, description: '-20 Unrest/spoke. Rebellion events suppressed at <50 Unrest.' },
      { incomeBonus: { momentum: 1 },       expensesBonus: 2, unrestChange: -30, description: '-30 Unrest/spoke. +1 Momentum/spoke. Rebellion impossible below 70 Unrest.' },
    ],
  },
};

// ── Helpers ──

/**
 * Total income generated by a province each spoke.
 * = base income + sum of investment bonuses.
 */
export function getProvinceIncome(province: Province): Partial<Record<ResourceType, number>> {
  const total: Partial<Record<ResourceType, number>> = { ...province.baseIncome };

  for (const inv of province.investments) {
    const data = INVESTMENT_DATA[inv.type];
    const effect = data.levels[inv.level - 1];
    for (const [res, amt] of Object.entries(effect.incomeBonus) as [ResourceType, number][]) {
      total[res] = (total[res] ?? 0) + amt;
    }
  }

  return total;
}

/**
 * Total gold upkeep cost per spoke.
 */
export function getProvinceExpenses(province: Province): number {
  let total = province.baseExpenses;
  for (const inv of province.investments) {
    total += INVESTMENT_DATA[inv.type].levels[inv.level - 1].expensesBonus;
  }
  return total;
}

/**
 * Net unrest change per spoke from all investments.
 * Negative means unrest is suppressed.
 */
export function getUnrestModifier(province: Province): number {
  let mod = 0;
  for (const inv of province.investments) {
    mod += INVESTMENT_DATA[inv.type].levels[inv.level - 1].unrestChange;
  }
  return mod;
}

/**
 * Factory — creates a new Province with sensible defaults.
 */
export function createProvince(name: string, overrides?: Partial<Province>): Province {
  return {
    id: name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now(),
    name,
    population: 3,
    baseIncome: { gold: 2 },
    unrest: 20,
    baseExpenses: 1,
    investments: [],
    ...overrides,
  };
}
