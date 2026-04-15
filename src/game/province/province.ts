import type { Faction, ResourceType } from '../core/commander';
import type { ResourceCost, TaxLevel, TierTuple } from '../../types/index';
import type { GovernorTrait } from './governor';
import type { TerrainType } from '../../data/terrain-data';
import { UNIVERSAL_BUILDINGS, TERRAIN_AVAILABLE_BUILDINGS, TERRAIN_DATA } from '../../data/terrain-data';
import type { TradeGoodType } from '../../data/trade-goods';
import { TRADE_GOOD_DATA } from '../../data/trade-goods';

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
}

// ── Investment data ──

export interface InvestmentLevelEffect {
  incomeBonus: Partial<Record<ResourceType, number>>;
  expensesBonus: number;   // additional gold upkeep
  unrestChange: number;    // negative = suppresses unrest per spoke
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
      { incomeBonus: {},                    expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 5 },                       description: 'Garrison deters minor raids. -5 Unrest/spoke.', beautinessBonus: -3 },
      { incomeBonus: {},                    expensesBonus: 2, unrestChange: -10, buildCost: { gold: 10, momentum: 3 },          description: 'Full cohort stationed. -10 Unrest/spoke. Free levy unit in defense battles.', beautinessBonus: -4 },
      { incomeBonus: { momentum: 1 },       expensesBonus: 3, unrestChange: -15, buildCost: { gold: 20, momentum: 6 },          description: 'Veteran legion presence. -15 Unrest/spoke. +1 Momentum/spoke. Free veteran unit.', beautinessBonus: -5 },
    ],
  },
  basilica: {
    type: 'basilica', color: 'blue',
    name: 'Basilica',
    flavour: 'A court of law that channels political loyalty upward.',
    levels: [
      { incomeBonus: { influence: 1 },      expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 5 },                       description: '+1 Influence/spoke.', beautinessBonus: 3 },
      { incomeBonus: { influence: 2 },      expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 10, influence: 3 },         description: '+2 Influence/spoke. -5 Unrest/spoke.', beautinessBonus: 4 },
      { incomeBonus: { influence: 3 },      expensesBonus: 2, unrestChange: -10, buildCost: { gold: 20, influence: 6 },         description: '+3 Influence/spoke. -10 Unrest/spoke. +1 extra event choice.', beautinessBonus: 5 },
    ],
  },
  pantheon: {
    type: 'pantheon', color: 'gold',
    name: 'Pantheon',
    flavour: 'Temples to the Roman gods maintain divine favour and civic morale.',
    levels: [
      { incomeBonus: { faith: 1 },          expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 5 },                       description: '+1 Faith/spoke. -5 Unrest/spoke.', beautinessBonus: 5 },
      { incomeBonus: { faith: 2 },          expensesBonus: 1, unrestChange: -10, buildCost: { gold: 10, faith: 3 },             description: '+2 Faith/spoke. -10 Unrest/spoke.', beautinessBonus: 8 },
      { incomeBonus: { faith: 3 },          expensesBonus: 2, unrestChange: -15, buildCost: { gold: 20, faith: 6 },             description: '+3 Faith/spoke. -15 Unrest/spoke. Units in this province\'s battles revive once.', beautinessBonus: 10 },
    ],
  },
  market: {
    type: 'market', color: 'purple',
    name: 'Market',
    flavour: 'A bustling forum that taxes trade flowing through the province.',
    levels: [
      { incomeBonus: { gold: 2 },           expensesBonus: 0, unrestChange: 0,   buildCost: { gold: 5 },                       description: '+2 Gold/spoke.', beautinessBonus: -2 },
      { incomeBonus: { gold: 4 },           expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 12 },                      description: '+4 Gold/spoke.', beautinessBonus: -2 },
      { incomeBonus: { gold: 6 },           expensesBonus: 1, unrestChange: 0,   buildCost: { gold: 24 },                      description: '+6 Gold/spoke. Resource exchange rates in this province improved by 1.', beautinessBonus: -3 },
    ],
  },
  aqueduct: {
    type: 'aqueduct', color: 'purple',
    name: 'Aqueduct',
    flavour: 'Running water feeds population growth and scales all income.',
    levels: [
      { incomeBonus: { gold: 1 },           expensesBonus: 1, unrestChange: -5,  buildCost: { gold: 6 },                       description: '+1 Gold/spoke. +1 Food. +1 Pop cap. -5 Unrest/spoke.', beautinessBonus: 3, foodBonus: 1 },
      { incomeBonus: { gold: 2 },           expensesBonus: 2, unrestChange: -5,  buildCost: { gold: 14 },                      description: '+2 Gold/spoke. +2 Food. +2 Pop cap. -5 Unrest/spoke.', beautinessBonus: 4, foodBonus: 2 },
      { incomeBonus: { gold: 3 },           expensesBonus: 2, unrestChange: -10, buildCost: { gold: 26 },                      description: '+3 Gold/spoke. +3 Food. +3 Pop cap. -10 Unrest/spoke. All income +10%.', beautinessBonus: 5, foodBonus: 3 },
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
      { incomeBonus: { gold: 2 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 4 },                         description: '+2 Gold/spoke. +1 Food/spoke.', foodBonus: 1 },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 9 },                         description: '+3 Gold/spoke. +2 Food/spoke.', foodBonus: 2 },
      { incomeBonus: { gold: 4 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 16 },                        description: '+4 Gold/spoke. +3 Food/spoke. Coastal settlements fed.', foodBonus: 3 },
    ],
  },
  villa: {
    type: 'villa', color: 'gold',
    name: 'Villa',
    flavour: 'Country estates of the rich yield harvests and social stability.',
    levels: [
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: -3, buildCost: { gold: 5 },                        description: '+1 Gold/spoke. +1 Food/spoke. -3 Unrest/spoke.', foodBonus: 1 },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: -5, buildCost: { gold: 10 },                       description: '+2 Gold/spoke. +2 Food/spoke. -5 Unrest/spoke.', foodBonus: 2 },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: -8, buildCost: { gold: 18 },                       description: '+3 Gold/spoke. +3 Food/spoke. -8 Unrest/spoke. Farmland yield doubled.', foodBonus: 3 },
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
      { incomeBonus: { gold: 1 },                 expensesBonus: 0, unrestChange: 0, buildCost: { gold: 3 },                         description: '+1 Gold/spoke. +1 Food/spoke.', foodBonus: 1 },
      { incomeBonus: { gold: 2 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 8 },                         description: '+2 Gold/spoke. +2 Food/spoke.', foodBonus: 2 },
      { incomeBonus: { gold: 3 },                 expensesBonus: 1, unrestChange: 0, buildCost: { gold: 15 },                        description: '+3 Gold/spoke. +3 Food/spoke. Marshland mastered.', foodBonus: 3 },
    ],
  },
  // ── S20: Food & Population ──
  granary: {
    type: 'granary', color: 'white',
    name: 'Granary',
    flavour: 'Raised storehouses keep grain dry and the province fed through lean seasons.',
    levels: [
      { incomeBonus: {},                           expensesBonus: 1, unrestChange: 0,  buildCost: { gold: 5 },                         description: '+1 Food/spoke. Stores surplus grain.', foodBonus: 1 },
      { incomeBonus: {},                           expensesBonus: 1, unrestChange: 0,  buildCost: { gold: 10 },                        description: '+2 Food/spoke. Improved storage capacity.', foodBonus: 2 },
      { incomeBonus: {},                           expensesBonus: 2, unrestChange: 0,  buildCost: { gold: 20 },                        description: '+3 Food/spoke. Famine recovery -1 season.', foodBonus: 3 },
    ],
  },
  gardens: {
    type: 'gardens', color: 'gold',
    name: 'Gardens & Fountains',
    flavour: 'Terraced gardens and marble fountains draw settlers from across the realm.',
    levels: [
      { incomeBonus: {},                           expensesBonus: 1, unrestChange: -2, buildCost: { gold: 6, influence: 2 },            description: '+10% Beautiness. -2 Unrest/spoke.', beautinessBonus: 10 },
      { incomeBonus: {},                           expensesBonus: 1, unrestChange: -4, buildCost: { gold: 12, influence: 4 },           description: '+15% Beautiness. -4 Unrest/spoke.', beautinessBonus: 15 },
      { incomeBonus: {},                           expensesBonus: 2, unrestChange: -6, buildCost: { gold: 22, influence: 6 },           description: '+20% Beautiness. -6 Unrest/spoke. A jewel of the empire.', beautinessBonus: 20 },
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
  // Synergy pop-cap bonuses (Insula+Aqueduct → +1)
  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'pop-cap') max += syn.bonus.amount;
  }
  // Trade good pop-cap bonus (Grain → +2)
  if (province.tradeGood) {
    const special = TRADE_GOOD_DATA[province.tradeGood].special;
    if (special?.type === 'pop-cap-bonus') max += special.amount;
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
    ...overrides,
  };
}

// ── Initial wealth calculation (ETW-style: terrain + resource + population) ──

/** Terrain base wealth for newly conquered provinces. */
const TERRAIN_BASE_WEALTH: Record<TerrainType, number> = {
  coast: 35, farmland: 30, hills: 25, plains: 20,
  forest: 20, desert: 15, marsh: 10, mountains: 10,
};

/** Trade good bonus to initial wealth. */
const TRADE_GOOD_WEALTH: Record<string, number> = {
  gold_ore: 20, silk: 15, salt: 10, iron: 8, marble: 8,
  incense: 8, wine: 6, horses: 5, fish: 5, olives: 5,
  grain: 3, timber: 3,
};

/** Calculate initial wealth for a newly conquered province. */
export function calculateInitialWealth(
  terrain: TerrainType, tradeGood: string | null, population: number,
): number {
  return (TERRAIN_BASE_WEALTH[terrain] ?? 20)
    + (tradeGood ? (TRADE_GOOD_WEALTH[tradeGood] ?? 0) : 0)
    + population * 5;
}

// ── Tax rate system (ETW-style: tax is a percentage of provincial wealth) ──

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
 * Tax rate (decimal fraction) from the dual tax sliders — applied to the
 * provincial wealth pool to calculate tax revenue (ETW-style).
 * Combined = lowerTax + upperTax (range 2–10).
 */
export function getTaxRate(lowerTax: TaxLevel, upperTax: TaxLevel): number {
  const RATES: Record<number, number> = {
    2:  0.03,
    3:  0.05,
    4:  0.07,
    5:  0.09,
    6:  0.12,
    7:  0.15,
    8:  0.18,
    9:  0.21,
    10: 0.25,
  };
  return RATES[lowerTax + upperTax];
}

/** Format a tax rate decimal as a display percentage string (e.g. "12%"). */
export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
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

// TERRAIN_PWG replaced by direct TERRAIN_DATA lookup in calculatePWG (S17-07).

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
  const terrainKey = (terrain ?? province.terrain) as TerrainType;
  pwg += TERRAIN_DATA[terrainKey]?.baseModifiers.pwgModifier ?? 0;
  for (const inv of province.investments) {
    pwg += BUILDING_PWG[inv.type]?.[inv.level] ?? 0;
  }
  for (const syn of getActiveSynergies(province)) {
    if (syn.bonus.type === 'pwg') pwg += syn.bonus.amount;
  }
  // Trade good wealth growth bonus — Silk +2, Gold Ore +2, Salt +1
  if (province.tradeGood) {
    pwg += TRADE_GOOD_DATA[province.tradeGood].wealthGrowthBonus;
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

// ── Food system config (S20) — single source of truth for balance tuning ──

/**
 * All food/famine/immigration constants in one place.
 * Modify these values to retune the economy without searching the file.
 */
export const FOOD_CONFIG = {
  /** Base subsistence food every province produces (gathering, small plots). */
  baseSubsistence: 2,
  /** Terrain base food production per season. */
  terrainFood: {
    farmland: 3, plains: 2, coast: 1, forest: 1,
    hills: 1, mountains: 0, desert: 0, marsh: 1,
  } as Record<TerrainType, number>,
  /** Tax food penalty fraction by lower-tax level (1=Minimal … 5=Oppressive). */
  taxFoodPenalty: { 1: 0, 2: 0.10, 3: 0.20, 4: 0.35, 5: 0.55 } as Record<TaxLevel, number>,
  /** Marketplace tax penalty mitigation by tier (multiplicative reduction). */
  marketplaceMitigation: { 1: 0.05, 2: 0.10, 3: 0.15 } as Record<number, number>,
  /** Famine unrest per season: soft phase (timer 1-2). */
  famineUnrestSoft: 10,
  /** Famine unrest per season: hard phase (timer 3+). */
  famineUnrestHard: 25,
  /** Default hard-famine threshold (seasons of deficit before pop death). */
  famineHardThreshold: 3,
  /** Granary T3 raises hard-famine threshold by this many seasons. */
  granaryT3FamineDelay: 1,
};

/**
 * Total food production for a province per season.
 * Sums: base subsistence + terrain + building foodBonus + trade good flatGrowth + governor traits.
 */
export function calculateFoodProduction(
  province: Province,
  governorTraits: GovernorTrait[] = [],
): number {
  let food = FOOD_CONFIG.baseSubsistence + (FOOD_CONFIG.terrainFood[province.terrain] ?? 0);

  // Building food bonuses (from InvestmentLevelEffect.foodBonus)
  for (const inv of province.investments) {
    const effect = INVESTMENT_DATA[inv.type]?.levels[inv.level - 1];
    food += effect?.foodBonus ?? 0;
  }

  // Trade good food contribution (Grain +3, Fish +1, Salt +1, Olives +1 via flatGrowth)
  if (province.tradeGood) {
    food += TRADE_GOOD_DATA[province.tradeGood].flatGrowth;
  }

  // Governor population-growth trait → food production bonus
  for (const trait of governorTraits) {
    if (trait.type === 'population-growth') food += trait.amount;
  }

  return food;
}

/** Tax food penalty fraction for a given lower-tax level. */
export function getTaxFoodPenalty(level: TaxLevel): number {
  return FOOD_CONFIG.taxFoodPenalty[level];
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
    penalty *= (1 - (FOOD_CONFIG.marketplaceMitigation[marketplace.level] ?? 0));
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
  return Math.max(0, Math.min(100, score));
}

/**
 * Roll immigration for a province. Rolls d100; if roll <= beautiness%,
 * the province gains +1 population (capped at maxPop).
 * Returns the updated province and whether immigration succeeded.
 */
export function rollImmigration(province: Province): { province: Province; immigrated: boolean } {
  const beautiness = calculateBeautiness(province);
  if (beautiness <= 0) {
    return { province, immigrated: false };
  }

  const roll = Math.floor(Math.random() * 100) + 1; // 1–100
  if (roll <= beautiness) {
    const maxPop = getEffectiveMaxPop(province);
    if (province.population >= maxPop) {
      return { province, immigrated: false }; // at cap
    }
    return {
      province: { ...province, population: province.population + 1 },
      immigrated: true,
    };
  }

  return { province, immigrated: false };
}

// ── Population growth accumulator ──

/** Growth threshold to gain 1 population point: `8 + current_pop × 2`. */
export function calculateGrowthThreshold(currentPop: number): number {
  return 8 + currentPop * 2;
}

/**
 * Advance one season of population growth (S20 food-surplus driven).
 *
 * Growth is fueled by food surplus: only positive surplus feeds the accumulator.
 * Zero surplus = equilibrium (no growth). Negative surplus = starvation (handled
 * separately by tickFamine in S20-04; this function does not decrease population).
 *
 * When the accumulator reaches the threshold, population increments by 1
 * (capped at maxPopulation) and the accumulator resets by subtracting the
 * threshold (preserving overflow).
 *
 * Returns an updated Province — does NOT mutate the input.
 */
export function tickPopulationGrowth(
  province: Province,
  _terrain?: string,
  governorTraits: GovernorTrait[] = [],
): Province {
  const maxPop = getEffectiveMaxPop(province);
  if (province.population >= maxPop) {
    return province; // already at cap
  }

  const surplus = calculateFoodSurplus(province, governorTraits);

  // Only positive surplus drives growth; zero/negative = no accumulation
  if (surplus <= 0) {
    return province;
  }

  const newAccumulator = province.growthAccumulator + surplus;
  const threshold = calculateGrowthThreshold(province.population);

  if (newAccumulator >= threshold) {
    const newPop = Math.min(province.population + 1, maxPop);
    return { ...province, population: newPop, growthAccumulator: newAccumulator - threshold };
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
  const hardThreshold = FOOD_CONFIG.famineHardThreshold
    + (granary && granary.level >= 3 ? FOOD_CONFIG.granaryT3FamineDelay : 0);

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
  if (province.famineTimer >= FOOD_CONFIG.famineHardThreshold) return FOOD_CONFIG.famineUnrestHard;
  if (province.famineTimer >= 1) return FOOD_CONFIG.famineUnrestSoft;
  return 0;
}

// ── Unrest + rebellion system ──

/**
 * Net unrest change per season.
 *   base  = tax_unrest + famine + doom − 2 (natural decay) + investment/governor modifier
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
  const famineUnrest = getFamineUnrest(province);
  const mod = getUnrestModifier(province, governorTraits); // negative = suppresses unrest
  const base = taxUnrest + famineUnrest + doom - 2 + mod;
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
