import type { Faction, ResourceType } from '../core/commander';
import type { ResourceCost, TaxLevel, TierTuple } from '../../types/index';
import type { GovernorTrait } from './governor';
import type { TerrainType } from '../../data/terrain-data';
import { UNIVERSAL_BUILDINGS, TERRAIN_AVAILABLE_BUILDINGS, TERRAIN_DATA } from '../../data/terrain-data';
import type { TradeGoodType } from '../../data/trade-goods';
import type { ProvinceFeature } from '../../data/province-features';
import { TRADE_GOOD_DATA } from '../../data/trade-goods';
import {
  FOOD, GROWTH, TAX, WEALTH, SETTLEMENT, PROVINCE_DEFAULTS,
} from '../../config/game-config';

// ── Investment types ──

/**
 * All province investment types.
 * Universal (any terrain): castrum, basilica, pantheon, market, aqueduct, insula.
 * Terrain-exclusive (S17-05): port, fishery, villa, stables, lumber_camp,
 *   mountain_pass, oasis_market, caravan_post, oracle_shrine, reed_harvest.
 * Pending (future task): mine, forge, sacred_grove, training_ground, watchtower.
 */
export type InvestmentType =
  | 'castrum'
  | 'basilica'
  | 'pantheon'
  | 'market'
  | 'aqueduct'
  | 'insula'
  | 'granary'        // S20 — Food & Population
  | 'gardens'        // S20 — Food & Population
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
  /** Display name (usually from the campaign that created it). */
  name: string;
  /** Population count. Grows via food surplus; no hard cap (food is the ceiling). */
  population: number;
  /** Base resource income per season (before investment bonuses). */
  baseIncome: Partial<Record<ResourceType, number>>;
  /** 0–100. High unrest reduces income and may trigger a Rebellion event. */
  unrest: number;
  /** Gold upkeep cost per season (before investment costs). */
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
  /** Consecutive seasons of food deficit. 0 = no famine. Drives escalating starvation (S20). */
  famineTimer: number;
  /**
   * Seasons remaining during which rebuilding is blocked (post-rebellion rubble).
   * 0 = no rubble. Set to 2 after the 1st/2nd rebellion, 8 after Ruined.
   */
  rubbleTimer: number;
  /** Terrain type — drives modifiers, exclusive buildings, and trade-good assignment (S17). */
  terrain: TerrainType;
  /** Assigned trade good, or null if none. Randomly assigned on conquest (S17-03). */
  tradeGood: TradeGoodType | null;
  /** Unique province feature (landmark/wonder), or null. Assigned from pool on conquest (S19). */
  uniqueFeature: ProvinceFeature | null;
}

// ── Investment data ──

export interface InvestmentLevelEffect {
  incomeBonus: Partial<Record<ResourceType, number>>;
  expensesBonus: number;   // additional gold upkeep
  unrestChange: number;    // negative = suppresses unrest per season
  buildCost: ResourceCost; // resources to build / upgrade to this level
  description: string;
  /** Food production bonus for this tier (S20 — Food & Population). */
  foodBonus?: number;
  /** Beautiness score contribution for this tier (S20 — Immigration). Negative = industrial penalty. */
  beautinessBonus?: number;
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
      { incomeBonus: {},                    expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 5 },                       description: 'Garrison deters minor raids. -5 Unrest/season.', beautinessBonus: -3 },
      { incomeBonus: {},                    expensesBonus: 2, unrestChange: -10, buildCost: { gold: 10, momentum: 3 },          description: 'Full cohort stationed. -10 Unrest/season. Free levy unit in defense battles.', beautinessBonus: -4 },
      { incomeBonus: { momentum: 1 },       expensesBonus: 3, unrestChange: -15, buildCost: { gold: 20, momentum: 6 },          description: 'Veteran legion presence. -15 Unrest/season. +1 Momentum/season. Free veteran unit.', beautinessBonus: -5 },
    ],
  },
  basilica: {
    type: 'basilica', color: 'blue',
    name: 'Basilica',
    flavour: 'A court of law that channels political loyalty upward.',
    levels: [
      { incomeBonus: { influence: 1 },      expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 5 },                       description: '+1 Influence/season.', beautinessBonus: 3 },
      { incomeBonus: { influence: 2 },      expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 10, influence: 3 },         description: '+2 Influence/season. -5 Unrest/season.', beautinessBonus: 4 },
      { incomeBonus: { influence: 3 },      expensesBonus: 2, unrestChange: -10, buildCost: { gold: 20, influence: 6 },         description: '+3 Influence/season. -10 Unrest/season. +1 extra event choice.', beautinessBonus: 5 },
    ],
  },
  pantheon: {
    type: 'pantheon', color: 'gold',
    name: 'Pantheon',
    flavour: 'Temples to the Roman gods maintain divine favour and civic morale.',
    levels: [
      { incomeBonus: { faith: 1 },          expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 5 },                       description: '+1 Faith/season. -5 Unrest/season.', beautinessBonus: 5 },
      { incomeBonus: { faith: 2 },          expensesBonus: 1, unrestChange: -10, buildCost: { gold: 10, faith: 3 },             description: '+2 Faith/season. -10 Unrest/season.', beautinessBonus: 8 },
      { incomeBonus: { faith: 3 },          expensesBonus: 2, unrestChange: -15, buildCost: { gold: 20, faith: 6 },             description: '+3 Faith/season. -15 Unrest/season. Units in this province\'s battles revive once.', beautinessBonus: 10 },
    ],
  },
  market: {
    type: 'market', color: 'purple',
    name: 'Market',
    flavour: 'A bustling forum that taxes trade flowing through the province.',
    levels: [
      { incomeBonus: { gold: 2 },           expensesBonus: 0, unrestChange: 0,   buildCost: { gold: 5 },                       description: '+2 Gold/season.', beautinessBonus: -2 },
      { incomeBonus: { gold: 4 },           expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 12 },                      description: '+4 Gold/season.', beautinessBonus: -2 },
      { incomeBonus: { gold: 6 },           expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 24 },                      description: '+6 Gold/season. Resource exchange rates in this province improved by 1.', beautinessBonus: -3 },
    ],
  },
  aqueduct: {
    type: 'aqueduct', color: 'purple',
    name: 'Aqueduct',
    flavour: 'Running water feeds population growth and scales all income.',
    levels: [
      { incomeBonus: { gold: 1 },           expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 6 },                       description: '+1 Gold/season. +1 Food. +1 Pop cap. -5 Unrest/season.', beautinessBonus: 3, foodBonus: 1 },
      { incomeBonus: { gold: 2 },           expensesBonus: 2, unrestChange: -5,  buildCost: { gold: 14 },                      description: '+2 Gold/season. +2 Food. +2 Pop cap. -5 Unrest/season.', beautinessBonus: 4, foodBonus: 2 },
      { incomeBonus: { gold: 3 },           expensesBonus: 2, unrestChange: -10, buildCost: { gold: 26 },                      description: '+3 Gold/season. +3 Food. +3 Pop cap. -10 Unrest/season. All income +10%.', beautinessBonus: 5, foodBonus: 3 },
    ],
  },
  insula: {
    type: 'insula', color: 'white',
    name: 'Insula & Arena',
    flavour: 'Bread, housing, and spectacles keep the masses content.',
    levels: [
      { incomeBonus: {},                          expensesBonus: 1, unrestChange: -10, buildCost: { gold: 4 },                       description: '-10 Unrest/season.' },
      { incomeBonus: {},                          expensesBonus: 2, unrestChange: -20, buildCost: { gold: 10 },                      description: '-20 Unrest/season. Rebellion events suppressed at <50 Unrest.' },
      { incomeBonus: { momentum: 1 },             expensesBonus: 2, unrestChange: -30, buildCost: { gold: 18 },                      description: '-30 Unrest/season. +1 Momentum/season. Rebellion impossible below 70 Unrest.' },
    ],
  },

  // ── Terrain-exclusive buildings (S17-05) ──

  port: {
    type: 'port', color: 'blue',
    name: 'Port',
    flavour: 'Stone quays and warehouses channel the wealth of the sea.',
    levels: [
      { incomeBonus: { gold: 2 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+2 Gold/season. +2 Wealth Growth/season.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 10 },                        description: '+3 Gold/season. +3 Wealth Growth/season.' },
      { incomeBonus: { gold: 4 },                 expensesBonus: 2, unrestChange: 0, buildCost: { gold: 20 },                        description: '+4 Gold/season. +4 Wealth Growth/season. Trade hub.' },
    ],
  },
  fishery: {
    type: 'fishery', color: 'blue',
    name: 'Fishery',
    flavour: 'Nets and salt-curing houses feed the province through lean seasons.',
    levels: [
      { incomeBonus: { gold: 2 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+2 Gold/season. +1 Food/season.', foodBonus: 1 },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 9 },                         description: '+3 Gold/season. +2 Food/season.', foodBonus: 2 },
      { incomeBonus: { gold: 4 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 16 },                        description: '+4 Gold/season. +3 Food/season. Coastal settlements fed.', foodBonus: 3 },
    ],
  },
  villa: {
    type: 'villa', color: 'gold',
    name: 'Villa',
    flavour: 'Country estates of the rich yield harvests and social stability.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: -3, buildCost: { gold: 5 },                        description: '+1 Gold/season. +1 Food/season. -3 Unrest/season.', foodBonus: 1 },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: -5, buildCost: { gold: 10 },                       description: '+2 Gold/season. +2 Food/season. -5 Unrest/season.', foodBonus: 2 },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: -8, buildCost: { gold: 18 },                       description: '+3 Gold/season. +3 Food/season. -8 Unrest/season. Farmland yield doubled.', foodBonus: 3 },
    ],
  },
  stables: {
    type: 'stables', color: 'red',
    name: 'Stables',
    flavour: 'Horses bred on the plains give the legion a decisive edge.',
    levels: [
      { incomeBonus: { momentum: 1 },             expensesBonus: 1, unrestChange: 0, buildCost: { gold: 5, momentum: 2 },            description: '+1 Momentum/season. Cavalry units trained here.' },
      { incomeBonus: { momentum: 2 },             expensesBonus: 2, unrestChange: 0, buildCost: { gold: 10, momentum: 4 },           description: '+2 Momentum/season. +1 cavalry unit in battles.' },
      { incomeBonus: { momentum: 3 },             expensesBonus: 3, unrestChange: 0, buildCost: { gold: 18, momentum: 6 },           description: '+3 Momentum/season. Elite cavalry in battles.' },
    ],
  },
  lumber_camp: {
    type: 'lumber_camp', color: 'white',
    name: 'Lumber Camp',
    flavour: 'Managed felling and seasoning pits supply timber to the whole empire.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+1 Gold/season. -5% build costs in this province.' },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 9 },                         description: '+2 Gold/season. -10% build costs in this province.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 16 },                        description: '+3 Gold/season. -15% build costs in this province.' },
    ],
  },
  mountain_pass: {
    type: 'mountain_pass', color: 'red',
    name: 'Mountain Pass',
    flavour: 'A fortified defile that controls all movement through the heights.',
    levels: [
      { incomeBonus: { momentum: 1 },             expensesBonus: 1, unrestChange: 0, buildCost: { gold: 5, momentum: 2 },            description: '+1 Momentum/season. Opens mountain trade route.' },
      { incomeBonus: { momentum: 1, gold: 1 },    expensesBonus: 2, unrestChange: 0, buildCost: { gold: 12, momentum: 4 },           description: '+1 Momentum, +1 Gold/season. Trade route active.' },
      { incomeBonus: { momentum: 2, gold: 2 },    expensesBonus: 3, unrestChange: 0, buildCost: { gold: 22, momentum: 6 },           description: '+2 Momentum, +2 Gold/season. Strategic pass controlled.' },
    ],
  },
  oasis_market: {
    type: 'oasis_market', color: 'purple',
    name: 'Oasis Market',
    flavour: 'A palm-shaded market where desert caravans exchange rare goods.',
    levels: [
      { incomeBonus: { gold: 2 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 5 },                         description: '+2 Gold/season. +2 Wealth Growth/season.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 12 },                        description: '+3 Gold/season. +3 Wealth Growth/season.' },
      { incomeBonus: { gold: 5 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 22 },                        description: '+5 Gold/season. +4 Wealth Growth/season. Desert trade nexus.' },
    ],
  },
  caravan_post: {
    type: 'caravan_post', color: 'purple',
    name: 'Caravan Post',
    flavour: 'Rest stops and water depots sustain the cross-desert trade network.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+1 Gold/season. +3 Wealth Growth/season.' },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 10 },                        description: '+2 Gold/season. +4 Wealth Growth/season.' },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 18 },                        description: '+3 Gold/season. +5 Wealth Growth/season. Cross-desert network.' },
    ],
  },
  oracle_shrine: {
    type: 'oracle_shrine', color: 'gold',
    name: 'Oracle Shrine',
    flavour: 'Marsh vapours and the whisper of reeds bring visions to the faithful.',
    levels: [
      { incomeBonus: { faith: 1 },                expensesBonus: 0, unrestChange: -3, buildCost: { gold: 4, faith: 2 },              description: '+1 Faith/season. +1 Food. -3 Unrest/season.', foodBonus: 1 },
      { incomeBonus: { faith: 2 },                expensesBonus: 1, unrestChange: -5, buildCost: { gold: 8, faith: 4 },              description: '+2 Faith/season. +1 Food. -5 Unrest/season.', foodBonus: 1 },
      { incomeBonus: { faith: 3 },                expensesBonus: 1, unrestChange: -8, buildCost: { gold: 15, faith: 6 },             description: '+3 Faith/season. +2 Food. -8 Unrest/season.', foodBonus: 2 },
    ],
  },
  reed_harvest: {
    type: 'reed_harvest', color: 'white',
    name: 'Reed Harvest',
    flavour: 'Skilled harvesters work the marsh beds for papyrus, rushes, and fuel.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 3 },                         description: '+1 Gold/season. +1 Food/season.', foodBonus: 1 },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 8 },                         description: '+2 Gold/season. +2 Food/season.', foodBonus: 2 },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 15 },                        description: '+3 Gold/season. +3 Food/season. Marshland mastered.', foodBonus: 3 },
    ],
  },
  // ── S20: Food & Population ──
  granary: {
    type: 'granary', color: 'white',
    name: 'Granary',
    flavour: 'Raised storehouses keep grain dry and the province fed through lean seasons.',
    levels: [
      { incomeBonus: {},                           expensesBonus: 1, unrestChange: 0,  buildCost: { gold: 5 },                         description: '+1 Food/season. Stores surplus grain.', foodBonus: 1 },
      { incomeBonus: {},                           expensesBonus: 1, unrestChange: 0,  buildCost: { gold: 10 },                        description: '+2 Food/season. Improved storage capacity.', foodBonus: 2 },
      { incomeBonus: {},                           expensesBonus: 2, unrestChange: 0,  buildCost: { gold: 20 },                        description: '+3 Food/season. Famine recovery -1 season.', foodBonus: 3 },
    ],
  },
  gardens: {
    type: 'gardens', color: 'gold',
    name: 'Gardens & Fountains',
    flavour: 'Terraced gardens and marble fountains draw settlers from across the realm.',
    levels: [
      { incomeBonus: {},                           expensesBonus: 1, unrestChange: -2, buildCost: { gold: 6, influence: 2 },            description: '+10% Beautiness. -2 Unrest/season.', beautinessBonus: 10 },
      { incomeBonus: {},                           expensesBonus: 1, unrestChange: -4, buildCost: { gold: 12, influence: 4 },           description: '+15% Beautiness. -4 Unrest/season.', beautinessBonus: 15 },
      { incomeBonus: {},                           expensesBonus: 2, unrestChange: -6, buildCost: { gold: 22, influence: 6 },           description: '+20% Beautiness. -6 Unrest/season. A jewel of the empire.', beautinessBonus: 20 },
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
  | { type: 'food'; amount: number }                 // +X Food production per season (S20)
  | { type: 'gold'; amount: number }                 // +X gold (× wealth tier × tax, as building income)
  | { type: 'unrest'; amount: number }               // −X Unrest per season (amount is the reduction)
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
  { buildingA: 'aqueduct', buildingB: 'granary',      bonus: { type: 'food',               amount: 2  }, label: 'Irrigated Farms' },
  { buildingA: 'basilica', buildingB: 'sacred_grove', bonus: { type: 'unrest',             amount: 5  }, label: 'Religious Harmony' },
  { buildingA: 'insula',   buildingB: 'aqueduct',     bonus: { type: 'unrest',             amount: 5  }, label: 'Civic Order' },
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

// ── Helpers ──

/**
 * Total income generated by a province each season.
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

  // Unique feature flat income
  const feat = province.uniqueFeature;
  if (feat) {
    if (feat.goldPerSeason) total.gold = (total.gold ?? 0) + feat.goldPerSeason;
    if (feat.iunioresPerSeason) total.iuniores = (total.iuniores ?? 0) + feat.iunioresPerSeason;
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
 * Total gold upkeep cost per season.
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
 * Net unrest change per season from investments + governor.
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

  // Trade good unrest reduction (Wine → -5 unrest/season)
  if (province.tradeGood) {
    const special = TRADE_GOOD_DATA[province.tradeGood].special;
    if (special?.type === 'unrest-reduction') mod -= special.amount;
  }

  return mod;
}

/**
 * Get investment cost discount percentage from governor traits.
 * Returns 0 if no discount applies.
 */
export function getInvestmentDiscount(governorTraits: GovernorTrait[], province?: Province): number {
  let discount = 0;
  for (const trait of governorTraits) {
    if (trait.type === 'investment-discount') {
      discount += trait.percent;
    }
  }
  // Unique feature build cost discount
  if (province?.uniqueFeature?.buildCostDiscount) {
    discount += province.uniqueFeature.buildCostDiscount;
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
    baseIncome: { gold: 2 },
    unrest: 20,
    baseExpenses: 1,
    investments: [],
    wealth: 0,
    devastation: 0,
    devastationTimer: 0,
    rebellionCount: 0,
    lowerTax: 3,
    upperTax: 3,
    growthAccumulator: 0,
    famineTimer: 0,
    rubbleTimer: 0,
    terrain: 'plains',
    tradeGood: null,
    uniqueFeature: null,
    ...overrides,
  };
}

// ── Initial wealth calculation (ETW-style: terrain + resource + population) ──

/** Calculate initial wealth for a newly conquered province. */
export function calculateInitialWealth(
  terrain: TerrainType, tradeGood: string | null, population: number,
): number {
  return (WEALTH.terrainBase[terrain] ?? 20)
    + (tradeGood ? (WEALTH.tradeGoodBonus[tradeGood] ?? 0) : 0)
    + population * PROVINCE_DEFAULTS.wealthPerPop;
}

// ── Tax rate system (ETW-style: tax is a percentage of provincial wealth) ──

/** Display label for a TaxLevel. */
export function getTaxLabel(level: TaxLevel): string {
  return TAX.labels[level];
}

/** Tax rate (decimal fraction) from the dual tax sliders. */
export function getTaxRate(lowerTax: TaxLevel, upperTax: TaxLevel): number {
  return TAX.rates[lowerTax + upperTax];
}

/** Format a tax rate decimal as a display percentage string (e.g. "12%"). */
export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

/** Unrest delta per season from lower-tax level. */
export function getLowerTaxUnrest(level: TaxLevel): number {
  return TAX.lowerUnrest[level];
}

/** Unrest delta per season from upper-tax level. */
export function getUpperTaxUnrest(level: TaxLevel): number {
  return TAX.upperUnrest[level];
}

// ── Wealth generation (NWG / PWG) ──

// TERRAIN_PWG replaced by direct TERRAIN_DATA lookup in calculatePWG (S17-07).


/**
 * Positive Wealth Generation per season.
 * Sources: base 2 + terrain bonus + Market investment level.
 * Pass terrain string (e.g. "hills", "coast") for terrain-aware callers;
 * omit or pass undefined for terrain-agnostic contexts.
 */
export function calculatePWG(province: Province, terrain?: string): number {
  let pwg = WEALTH.basePWG;
  const terrainKey = (terrain ?? province.terrain) as TerrainType;
  pwg += TERRAIN_DATA[terrainKey]?.baseModifiers.pwgModifier ?? 0;
  for (const inv of province.investments) {
    pwg += (WEALTH.buildingPWG as Record<string, Record<number, number>>)[inv.type]?.[inv.level] ?? 0;
  }
  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'pwg') pwg += syn.bonus.amount;
  }
  // Trade good wealth growth bonus — Silk +2, Gold Ore +2, Salt +1
  if (province.tradeGood) {
    pwg += TRADE_GOOD_DATA[province.tradeGood].wealthGrowthBonus;
  }
  // Unique feature wealth growth bonus
  if (province.uniqueFeature?.wealthGrowthBonus) {
    pwg += province.uniqueFeature.wealthGrowthBonus;
  }
  return pwg;
}

/**
 * Negative Wealth Generation per season (ETW-adapted).
 * Upper class tax extracts a flat drain plus a fraction of PWG.
 * Result is always negative.
 */
export function calculateNWG(pwg: number, upperTax: TaxLevel): number {
  const { flat, mult } = WEALTH.nwgParams[upperTax];
  return -(flat + mult * pwg);
}

/**
 * Net wealth change per season = PWG + NWG − devastation drain.
 * Devastation drain is −2/season while devastationTimer > 0.
 */
export function calculateNetWealthChange(province: Province, terrain?: string): number {
  const pwg = calculatePWG(province, terrain);
  const nwg = calculateNWG(pwg, province.upperTax);
  const devastationDrain = province.devastationTimer > 0 ? -WEALTH.devastationDrain : 0;
  return pwg + nwg + devastationDrain;
}

// ── Population → building slots ──

/** Building slots for a given population (driven by SETTLEMENT.tiers). */
export function getBuildingSlots(pop: number): number {
  for (const tier of SETTLEMENT.tiers) {
    if (pop <= tier.maxPop) return tier.slots;
  }
  return SETTLEMENT.tiers[SETTLEMENT.tiers.length - 1].slots;
}

/** Settlement size label for a given population (driven by SETTLEMENT.tiers). */
export function getSettlementLabel(pop: number): string {
  for (const tier of SETTLEMENT.tiers) {
    if (pop <= tier.maxPop) return tier.label;
  }
  return SETTLEMENT.tiers[SETTLEMENT.tiers.length - 1].label;
}

/**
 * Buildings currently available in a province.
 * Returns all universal buildings plus any terrain-exclusive buildings whose
 * InvestmentType values are registered (i.e. have INVESTMENT_DATA entries).
 *
 * Universal buildings are defined in UNIVERSAL_BUILDINGS (terrain-data.ts).
 * Terrain-exclusive buildings are defined per-terrain in TERRAIN_AVAILABLE_BUILDINGS;
 * only those whose slugs appear in INVESTMENT_DATA are included — the remaining 6
 * (granary, mine, forge, sacred_grove, training_ground, watchtower) are pending
 * future tasks.
 */
export function getAvailableBuildings(province: Province): InvestmentType[] {
  const universals: InvestmentType[] = [...UNIVERSAL_BUILDINGS];
  // Terrain-gated buildings: include any exclusive building whose slug is registered in INVESTMENT_DATA.
  const terrainBuildings = TERRAIN_AVAILABLE_BUILDINGS[province.terrain] as string[];
  const investmentSlugs = Object.keys(INVESTMENT_DATA) as string[];
  for (const slug of terrainBuildings) {
    if (investmentSlugs.includes(slug)) {
      universals.push(slug as InvestmentType);
    }
  }
  return universals;
}

/**
 * Total food production for a province per season.
 * Sums: base subsistence + terrain + building foodBonus + trade good flatGrowth + governor traits.
 */
export function calculateFoodProduction(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): number {
  let food = FOOD.baseSubsistence + (FOOD.terrainFood[province.terrain] ?? 0);

  // Building food bonuses (from InvestmentLevelEffect.foodBonus)
  for (const inv of province.investments) {
    const effect = INVESTMENT_DATA[inv.type]?.levels[inv.level - 1];
    food += effect?.foodBonus ?? 0;
  }

  // Trade good food contribution (Grain +3, Fish +1, Salt +1, Olives +1 via flatGrowth)
  if (province.tradeGood) {
    food += TRADE_GOOD_DATA[province.tradeGood].flatGrowth;
  }

  // Synergy food bonuses (e.g., Aqueduct+Granary → Irrigated Farms +2 food)
  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'food') food += syn.bonus.amount;
  }

  // Governor population-growth trait → food production bonus
  for (const trait of governorTraits) {
    if (trait.type === 'population-growth') food += trait.amount;
  }

  // Unique feature food bonus
  if (province.uniqueFeature?.foodPerSeason) {
    food += province.uniqueFeature.foodPerSeason;
  }

  return food;
}

/** Tax food penalty fraction for a given lower-tax level. */
export function getTaxFoodPenalty(level: TaxLevel): number {
  return FOOD.taxFoodPenalty[level];
}

/**
 * Effective food production after tax friction.
 * `effectiveFood = rawProduction × (1 − effectiveTaxPenalty)`
 * Marketplace mitigates the tax penalty multiplicatively.
 */
export function calculateEffectiveFoodProduction(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): number {
  const raw = calculateFoodProduction(province, governorTraits);
  let penalty = getTaxFoodPenalty(province.lowerTax);

  // Marketplace mitigates tax food penalty
  const marketplace = province.investments.find(i => i.type === 'market');
  if (marketplace) {
    penalty *= (1 - (FOOD.marketplaceMitigation[marketplace.level] ?? 0));
  }

  return raw * (1 - penalty);
}

/**
 * Food consumption for a province per season.
 * Each population point consumes 1 food.
 */
export function calculateFoodConsumption(province: Province): number {
  return province.population;
}

/**
 * Net food surplus (effective production − consumption).
 * Positive = growth fuel, zero = equilibrium, negative = starvation.
 * Tax friction is already applied to production.
 */
export function calculateFoodSurplus(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): number {
  return calculateEffectiveFoodProduction(province, governorTraits) - calculateFoodConsumption(province);
}

// ── Beautiness & immigration (S20) ──

/**
 * Province beautiness score (0–100%, clamped).
 * Sums beautinessBonus from all installed buildings.
 * Green buildings add, industrial buildings subtract.
 */
export function calculateBeautiness(province: Province): number {
  let score = 0;
  for (const inv of province.investments) {
    const effect = INVESTMENT_DATA[inv.type]?.levels[inv.level - 1];
    score += effect?.beautinessBonus ?? 0;
  }
  // Unique feature beautiness bonus
  if (province.uniqueFeature?.beautinessBonus) {
    score += province.uniqueFeature.beautinessBonus;
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * Roll immigration for a province. Rolls d100; if roll <= beautiness%,
 * the province gains +1 population.
 * Returns the updated province and whether immigration succeeded.
 */
export function rollImmigration(province: Province): { province: Province; immigrated: boolean } {
  const beautiness = calculateBeautiness(province);
  if (beautiness <= 0) {
    return { province, immigrated: false };
  }

  const roll = Math.floor(Math.random() * 100) + 1; // 1–100
  if (roll <= beautiness) {
    return {
      province: { ...province, population: province.population + 1 },
      immigrated: true,
    };
  }

  return { province, immigrated: false };
}

// ── Population growth accumulator ──

/** Growth threshold to gain 1 population point. */
export function calculateGrowthThreshold(currentPop: number): number {
  return GROWTH.thresholdBase + currentPop * GROWTH.thresholdPerPop;
}

/**
 * Advance one season of population growth (S20 food-surplus driven).
 *
 * Growth is fueled by food surplus: only positive surplus feeds the accumulator.
 * Zero surplus = equilibrium (no growth). Negative surplus = starvation (handled
 * separately by tickFamine in S20-04; this function does not decrease population).
 *
 * When the accumulator reaches the threshold, population increments by 1
 * and the accumulator resets by subtracting the threshold (preserving overflow).
 * Food supply is the natural ceiling — no hard population cap.
 *
 * Returns an updated Province — does NOT mutate the input.
 */
export function tickPopulationGrowth(
  province: Province,
  _terrain?: string,
  governorTraits: GovernorTrait[] = [],
): Province {
  const surplus = calculateFoodSurplus(province, governorTraits);

  // Only positive surplus drives growth; zero/negative = no accumulation
  if (surplus <= 0) {
    return province;
  }

  const newAccumulator = province.growthAccumulator + surplus;
  const threshold = calculateGrowthThreshold(province.population);

  if (newAccumulator >= threshold) {
    return { ...province, population: province.population + 1, growthAccumulator: newAccumulator - threshold };
  }

  return { ...province, growthAccumulator: newAccumulator };
}

// ── Famine system (S20) ──


/**
 * Advance one season of famine tracking.
 *
 * - Surplus >= 0 → reset famineTimer to 0 (recovery).
 * - Surplus < 0, famineTimer 1-2 (soft phase) → growth blocked (handled by
 *   tickPopulationGrowth), unrest added via calculateUnrestDelta.
 * - Surplus < 0, famineTimer 3+ (hard phase) → lose 1 pop/season (min 1),
 *   reset growthAccumulator to 0.
 *
 * Returns an updated Province — does NOT mutate the input.
 */
export function tickFamine(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): Province {
  const surplus = calculateFoodSurplus(province, governorTraits);

  if (surplus >= 0) {
    // Recovery: reset famine timer
    if (province.famineTimer > 0) {
      return { ...province, famineTimer: 0 };
    }
    return province;
  }

  // Deficit: increment famine timer
  const newTimer = province.famineTimer + 1;

  // Granary T3 delays hard starvation by extra seasons
  const granary = province.investments.find(i => i.type === 'granary');
  const hardThreshold = FOOD.famineHardThreshold
    + (granary && granary.level >= 3 ? FOOD.granaryT3FamineDelay : 0);

  if (newTimer >= hardThreshold) {
    // Hard phase: lose 1 pop (floor at 1), reset growth accumulator
    const newPop = Math.max(1, province.population - 1);
    return { ...province, famineTimer: newTimer, population: newPop, growthAccumulator: 0 };
  }

  // Soft phase: just increment timer (growth blocked by tickPopulationGrowth)
  return { ...province, famineTimer: newTimer };
}

/**
 * Famine unrest contribution based on famineTimer.
 * Soft (1-2): +10/season. Hard (3+): +25/season. None (0): 0.
 */
export function getFamineUnrest(province: Province): number {
  if (province.famineTimer >= FOOD.famineHardThreshold) return FOOD.famineUnrestHard;
  if (province.famineTimer >= 1) return FOOD.famineUnrestSoft;
  return 0;
}

// ── Unrest + rebellion system ──

/**
 * Net unrest change per season.
 *   base  = tax_unrest + famine − 2 (natural decay) + investment/governor modifier
 *   accel = (unrest > 60) ? (unrest − 60) × 0.25 : 0
 *   total = base + accel
 *
 * `getUnrestModifier()` is negative when buildings/governor suppress unrest.
 */
export function calculateUnrestDelta(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): number {
  const taxUnrest = getLowerTaxUnrest(province.lowerTax) + getUpperTaxUnrest(province.upperTax);
  const famineUnrest = getFamineUnrest(province);
  const featureUnrest = province.uniqueFeature?.unrestPerSeason ?? 0;
  const mod = getUnrestModifier(province, governorTraits); // negative = suppresses unrest
  const base = taxUnrest + famineUnrest + featureUnrest - 2 + mod;
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
 * rebellionCount 0 → 1st rebellion: destroy 1–2 buildings, −1 pop,
 *   unrest→40, devastation 4 seasons, rubble 2 seasons.
 * rebellionCount 1 → 2nd rebellion: destroy 2 buildings, −2 pop,
 *   same devastation + rubble.
 * rebellionCount 2 → 3rd rebellion (Ruined): all buildings gone, pop→1,
 *   wealth→0, 8-season devastation + rubble. Governor auto-dismissed.
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
      famineTimer: 0,
      growthAccumulator: 0,
      devastationTimer: 8,
      rubbleTimer: 8,
      rebellionCount: 3,
    };
  }

  // ── 1st or 2nd rebellion ──
  const destroyCount = n === 0 ? (rng() < 0.5 ? 1 : 2) : 2;
  const popLoss = n === 0 ? 1 : 2;

  return {
    ...province,
    investments: destroyMostExpensive(province.investments, destroyCount),
    population: Math.max(1, province.population - popLoss),
    unrest: 40,
    devastationTimer: 4,
    rubbleTimer: 2,
    rebellionCount: n + 1,
  };
}
