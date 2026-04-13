import type { Faction, ResourceType } from '../core/commander';
import type { ResourceCost, TaxLevel, TierTuple, WealthTier } from '../../types/index';
import type { GovernorTrait } from './governor';
import type { TerrainType } from '../../data/terrain-data';
import { UNIVERSAL_BUILDINGS, TERRAIN_AVAILABLE_BUILDINGS } from '../../data/terrain-data';
import type { TradeGoodType } from '../../data/trade-goods';

// ── Investment types ──

/**
 * All province investment types.
 * Universal (any terrain): castrum, basilica, pantheon, market, aqueduct, insula.
 * Terrain-exclusive (S17-05): port, fishery, villa, stables, lumber_camp,
 *   mountain_pass, oasis_market, caravan_post, oracle_shrine, reed_harvest.
 * Pending (future task): granary, mine, forge, sacred_grove, training_ground, watchtower.
 */
export type InvestmentType =
  | 'castrum'
  | 'basilica'
  | 'pantheon'
  | 'market'
  | 'aqueduct'
  | 'insula'
  // ── Terrain-exclusive (S17-05) ──
  | 'port'          // Coast
  | 'fishery'       // Coast
  | 'villa'         // Farmland
  | 'stables'       // Plains
  | 'lumber_camp'   // Forest / Marsh
  | 'mountain_pass' // Mountains
  | 'oasis_market'  // Desert
  | 'caravan_post'  // Desert
  | 'oracle_shrine' // Marsh
  | 'reed_harvest'; // Marsh

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
  /** Terrain type — drives modifiers, exclusive buildings, and trade-good assignment (S17). */
  terrain: TerrainType;
  /** Assigned trade good, or null if none. Randomly assigned on conquest (S17-03). */
  tradeGood: TradeGoodType | null;
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
      { incomeBonus: {},                          expensesBonus: 1, unrestChange: -10, buildCost: { gold: 4 },                       description: '-10 Unrest/spoke.' },
      { incomeBonus: {},                          expensesBonus: 2, unrestChange: -20, buildCost: { gold: 10 },                      description: '-20 Unrest/spoke. Rebellion events suppressed at <50 Unrest.' },
      { incomeBonus: { momentum: 1 },             expensesBonus: 2, unrestChange: -30, buildCost: { gold: 18 },                      description: '-30 Unrest/spoke. +1 Momentum/spoke. Rebellion impossible below 70 Unrest.' },
    ],
  },

  // ── Terrain-exclusive buildings (S17-05) ──

  port: {
    type: 'port', color: 'blue',
    name: 'Port',
    flavour: 'Stone quays and warehouses channel the wealth of the sea.',
    levels: [
      { incomeBonus: { gold: 2 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+2 Gold/spoke. +2 Wealth Growth/spoke.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 10 },                        description: '+3 Gold/spoke. +3 Wealth Growth/spoke.' },
      { incomeBonus: { gold: 4 },                 expensesBonus: 2, unrestChange: 0, buildCost: { gold: 20 },                        description: '+4 Gold/spoke. +4 Wealth Growth/spoke. Trade hub.' },
    ],
  },
  fishery: {
    type: 'fishery', color: 'blue',
    name: 'Fishery',
    flavour: 'Nets and salt-curing houses feed the province through lean seasons.',
    levels: [
      { incomeBonus: { gold: 2 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+2 Gold/spoke. +1 Pop Growth/spoke.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 9 },                         description: '+3 Gold/spoke. +2 Pop Growth/spoke.' },
      { incomeBonus: { gold: 4 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 16 },                        description: '+4 Gold/spoke. +3 Pop Growth/spoke. Coastal settlements fed.' },
    ],
  },
  villa: {
    type: 'villa', color: 'gold',
    name: 'Villa',
    flavour: 'Country estates of the rich yield harvests and social stability.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: -3, buildCost: { gold: 5 },                        description: '+1 Gold/spoke. +1 Pop Growth/spoke. -3 Unrest/spoke.' },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: -5, buildCost: { gold: 10 },                       description: '+2 Gold/spoke. +2 Pop Growth/spoke. -5 Unrest/spoke.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: -8, buildCost: { gold: 18 },                       description: '+3 Gold/spoke. +3 Pop Growth/spoke. -8 Unrest/spoke. Farmland yield doubled.' },
    ],
  },
  stables: {
    type: 'stables', color: 'red',
    name: 'Stables',
    flavour: 'Horses bred on the plains give the legion a decisive edge.',
    levels: [
      { incomeBonus: { momentum: 1 },             expensesBonus: 1, unrestChange: 0, buildCost: { gold: 5, momentum: 2 },            description: '+1 Momentum/spoke. Cavalry units trained here.' },
      { incomeBonus: { momentum: 2 },             expensesBonus: 2, unrestChange: 0, buildCost: { gold: 10, momentum: 4 },           description: '+2 Momentum/spoke. +1 cavalry unit in battles.' },
      { incomeBonus: { momentum: 3 },             expensesBonus: 3, unrestChange: 0, buildCost: { gold: 18, momentum: 6 },           description: '+3 Momentum/spoke. Elite cavalry in battles.' },
    ],
  },
  lumber_camp: {
    type: 'lumber_camp', color: 'white',
    name: 'Lumber Camp',
    flavour: 'Managed felling and seasoning pits supply timber to the whole empire.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+1 Gold/spoke. -5% build costs in this province.' },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 9 },                         description: '+2 Gold/spoke. -10% build costs in this province.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 16 },                        description: '+3 Gold/spoke. -15% build costs in this province.' },
    ],
  },
  mountain_pass: {
    type: 'mountain_pass', color: 'red',
    name: 'Mountain Pass',
    flavour: 'A fortified defile that controls all movement through the heights.',
    levels: [
      { incomeBonus: { momentum: 1 },             expensesBonus: 1, unrestChange: 0, buildCost: { gold: 5, momentum: 2 },            description: '+1 Momentum/spoke. Opens mountain trade route.' },
      { incomeBonus: { momentum: 1, gold: 1 },    expensesBonus: 2, unrestChange: 0, buildCost: { gold: 12, momentum: 4 },           description: '+1 Momentum, +1 Gold/spoke. Trade route active.' },
      { incomeBonus: { momentum: 2, gold: 2 },    expensesBonus: 3, unrestChange: 0, buildCost: { gold: 22, momentum: 6 },           description: '+2 Momentum, +2 Gold/spoke. Strategic pass controlled.' },
    ],
  },
  oasis_market: {
    type: 'oasis_market', color: 'purple',
    name: 'Oasis Market',
    flavour: 'A palm-shaded market where desert caravans exchange rare goods.',
    levels: [
      { incomeBonus: { gold: 2 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 5 },                         description: '+2 Gold/spoke. +2 Wealth Growth/spoke.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 12 },                        description: '+3 Gold/spoke. +3 Wealth Growth/spoke.' },
      { incomeBonus: { gold: 5 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 22 },                        description: '+5 Gold/spoke. +4 Wealth Growth/spoke. Desert trade nexus.' },
    ],
  },
  caravan_post: {
    type: 'caravan_post', color: 'purple',
    name: 'Caravan Post',
    flavour: 'Rest stops and water depots sustain the cross-desert trade network.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+1 Gold/spoke. +3 Wealth Growth/spoke.' },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 10 },                        description: '+2 Gold/spoke. +4 Wealth Growth/spoke.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 18 },                        description: '+3 Gold/spoke. +5 Wealth Growth/spoke. Cross-desert network.' },
    ],
  },
  oracle_shrine: {
    type: 'oracle_shrine', color: 'gold',
    name: 'Oracle Shrine',
    flavour: 'Marsh vapours and the whisper of reeds bring visions to the faithful.',
    levels: [
      { incomeBonus: { faith: 1 },                expensesBonus: 0, unrestChange: -3, buildCost: { gold: 4, faith: 2 },              description: '+1 Faith/spoke. -3 Unrest/spoke. Omens guide the province.' },
      { incomeBonus: { faith: 2 },                expensesBonus: 1, unrestChange: -5, buildCost: { gold: 8, faith: 4 },              description: '+2 Faith/spoke. -5 Unrest/spoke. +1 extra event choice.' },
      { incomeBonus: { faith: 3 },                expensesBonus: 1, unrestChange: -8, buildCost: { gold: 15, faith: 6 },             description: '+3 Faith/spoke. -8 Unrest/spoke. Rare prophecy events.' },
    ],
  },
  reed_harvest: {
    type: 'reed_harvest', color: 'white',
    name: 'Reed Harvest',
    flavour: 'Skilled harvesters work the marsh beds for papyrus, rushes, and fuel.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 3 },                         description: '+1 Gold/spoke. +1 Pop Growth/spoke.' },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 8 },                         description: '+2 Gold/spoke. +2 Pop Growth/spoke.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 15 },                        description: '+3 Gold/spoke. +3 Pop Growth/spoke. Marshland mastered.' },
    ],
  },
};

// ── Building synergies ──

/**
 * Discriminated union of synergy bonus effects.
 * 'unit-cost-discount' is noted but applied by the battle system (deferred).
 */
export type SynergyBonus =
  | { type: 'pwg'; amount: number }                  // +X Wealth Growth per season
  | { type: 'growth'; amount: number }               // +X Pop Growth per season
  | { type: 'gold'; amount: number }                 // +X gold (× wealth tier × tax, as building income)
  | { type: 'unrest'; amount: number }               // −X Unrest per season (amount is the reduction)
  | { type: 'pop-cap'; amount: number }              // +X max population
  | { type: 'unit-cost-discount'; percent: number }; // −X% unit recruit cost (battle system)

export interface SynergyData {
  /**
   * Building slugs — string typed for forward-compatibility with buildings not yet
   * in InvestmentType (forge, granary, mine, sacred_grove — added in future tasks).
   */
  buildingA: string;
  buildingB: string;
  bonus: SynergyBonus;
  label: string;
}

export const SYNERGY_DATA: SynergyData[] = [
  { buildingA: 'market',   buildingB: 'port',         bonus: { type: 'pwg',                amount: 2  }, label: 'Trade Hub' },
  { buildingA: 'castrum',  buildingB: 'forge',        bonus: { type: 'unit-cost-discount', percent: 10 }, label: 'Military-Industrial' },
  { buildingA: 'aqueduct', buildingB: 'granary',      bonus: { type: 'growth',             amount: 2  }, label: 'Irrigated Farms' },
  { buildingA: 'basilica', buildingB: 'sacred_grove', bonus: { type: 'unrest',             amount: 5  }, label: 'Religious Harmony' },
  { buildingA: 'insula',   buildingB: 'aqueduct',     bonus: { type: 'pop-cap',            amount: 1  }, label: 'Public Works' },
  { buildingA: 'market',   buildingB: 'mine',         bonus: { type: 'gold',               amount: 1  }, label: 'Resource Commerce' },
];

/**
 * Return the active synergies for a province — those where both buildings are present
 * at any level.
 */
export function getActiveSynergies(province: Province): SynergyData[] {
  const types = new Set(province.investments.map(i => i.type as string));
  return SYNERGY_DATA.filter(s => types.has(s.buildingA) && types.has(s.buildingB));
}

/**
 * Effective maximum population for a province, including synergy bonuses.
 * Base: province.maxPopulation.
 * Synergy: Insula + Aqueduct → +1 pop cap (Public Works).
 */
export function getEffectiveMaxPop(province: Province): number {
  let max = province.maxPopulation;
  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'pop-cap') max += syn.bonus.amount;
  }
  return max;
}

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
  // garrison-strength multiplies Castrum's unrest reduction (×1.15 / ×1.25 / ×1.35)
  const garrisonTrait = governorTraits.find(
    (t): t is Extract<GovernorTrait, { type: 'garrison-strength' }> => t.type === 'garrison-strength',
  );
  const garrisonMult = garrisonTrait ? 1 + garrisonTrait.percent / 100 : 1;

  let mod = 0;
  for (const inv of province.investments) {
    const unrestChange = INVESTMENT_DATA[inv.type].levels[inv.level - 1].unrestChange;
    mod += inv.type === 'castrum' ? Math.round(unrestChange * garrisonMult) : unrestChange;
  }

  // Apply governor unrest-reduction traits (flat reduction)
  for (const trait of governorTraits) {
    if (trait.type === 'unrest-reduction') {
      mod -= trait.flat;
    }
  }

  // Synergy unrest reduction (amount is positive = reduces unrest)
  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'unrest') mod -= syn.bonus.amount;
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
    terrain: 'plains',
    tradeGood: null,
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

/** PWG bonus contributed by commercial buildings, keyed by InvestmentType then level. */
const BUILDING_PWG: Partial<Record<InvestmentType, Record<number, number>>> = {
  market:       { 1: 2, 2: 3, 3: 4 },
  port:         { 1: 2, 2: 3, 3: 4 },
  oasis_market: { 1: 2, 2: 3, 3: 4 },
  caravan_post: { 1: 3, 2: 4, 3: 5 },
};

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
    pwg += BUILDING_PWG[inv.type]?.[inv.level] ?? 0;
  }
  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'pwg') pwg += syn.bonus.amount;
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

/**
 * Buildings currently available in a province.
 * Returns all universal buildings plus any terrain-exclusive buildings whose
 * InvestmentType values are registered (i.e. have INVESTMENT_DATA entries).
 *
 * Terrain-exclusive building types are promoted to InvestmentType in S17-05.
 * Until then, TERRAIN_AVAILABLE_BUILDINGS entries are TerrainBuildingType strings
 * and do not appear in InvestmentType, so only UNIVERSAL_BUILDINGS are returned.
 */
export function getAvailableBuildings(province: Province): InvestmentType[] {
  const universals: InvestmentType[] = [...UNIVERSAL_BUILDINGS];
  // Terrain-gated buildings: include any exclusive building whose slug already
  // exists as an InvestmentType value. This is a no-op until S17-05 adds them.
  const terrainBuildings = TERRAIN_AVAILABLE_BUILDINGS[province.terrain] as string[];
  const investmentSlugs = Object.keys(INVESTMENT_DATA) as string[];
  for (const slug of terrainBuildings) {
    if (investmentSlugs.includes(slug)) {
      universals.push(slug as InvestmentType);
    }
  }
  return universals;
}

// ── Population growth accumulator ──

/** Terrain growth contribution (plains/unknown = 1, coast = 2, desert = 0). */
const TERRAIN_GROWTH: Record<string, number> = {
  plains: 1, hills: 1, forest: 1, coast: 2, desert: 0,
};

/** Population growth bonus contributed by buildings, keyed by InvestmentType then level. */
const BUILDING_GROWTH: Partial<Record<InvestmentType, Record<number, number>>> = {
  aqueduct:     { 1: 1, 2: 1, 3: 1 },
  villa:        { 1: 1, 2: 2, 3: 3 },
  fishery:      { 1: 1, 2: 2, 3: 3 },
  reed_harvest: { 1: 1, 2: 2, 3: 3 },
};

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
    raw += BUILDING_GROWTH[inv.type]?.[inv.level] ?? 0;
  }

  for (const trait of governorTraits) {
    if (trait.type === 'population-growth') raw += trait.amount;
  }

  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'growth') raw += syn.bonus.amount;
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
  const maxPop = getEffectiveMaxPop(province);
  if (province.population >= maxPop) {
    return province; // already at cap
  }

  const growth = calculateEffectiveGrowth(province, terrain, governorTraits);
  const newAccumulator = province.growthAccumulator + growth;
  const threshold = calculateGrowthThreshold(province.population);

  if (newAccumulator >= threshold) {
    const newPop = Math.min(province.population + 1, maxPop);
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
 * Base 80. Insula T2 raises to 90; Insula T3 makes rebellion impossible (101 > unrest cap).
 */
export function getRebelThreshold(province: Province): number {
  const insula = province.investments.find(i => i.type === 'insula');
  if (insula && insula.level >= 3) return 101;
  if (insula && insula.level >= 2) return 90;
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
  const newMaxPop = Math.max(1, province.maxPopulation - maxPopReduction);

  return {
    ...province,
    investments: destroyMostExpensive(province.investments, destroyCount),
    maxPopulation: newMaxPop,
    population: Math.min(province.population, newMaxPop),
    unrest: 40,
    devastationTimer: 4,
    rubbleTimer: 2,
    rebellionCount: n + 1,
  };
}
