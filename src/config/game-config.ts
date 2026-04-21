/**
 * GAME_CONFIG — single source of truth for all tunable gameplay constants.
 *
 * Change numbers here to retune the game. Functions throughout the codebase
 * read from this config rather than using inline magic numbers.
 */

import type { TerrainType } from '../data/terrain-data';
import type { TaxLevel } from '../types/index';

// ══════════════════════════════════════════════
//  SEASON & DOOM
// ══════════════════════════════════════════════

export const SEASON = {
  /** Maximum seasons before the final invasion. */
  max: 24,
  /** Doom upkeep thresholds: [doomLevel, goldPerSeason]. Checked high→low. */
  doomUpkeep: [
    { threshold: 75, gold: 3 },
    { threshold: 50, gold: 2 },
    { threshold: 25, gold: 1 },
  ] as const,
};

// ══════════════════════════════════════════════
//  PROVINCE DEFAULTS
// ══════════════════════════════════════════════

export const PROVINCE_DEFAULTS = {
  population: 3,
  unrest: 20,
  baseExpenses: 1,
  lowerTax: 3 as TaxLevel,
  upperTax: 3 as TaxLevel,
  /** Population multiplier for initial wealth calculation. */
  wealthPerPop: 5,
};

// ══════════════════════════════════════════════
//  FOOD SYSTEM
// ══════════════════════════════════════════════

export const FOOD = {
  /** Base subsistence food every province produces (gathering, small plots). */
  baseSubsistence: 3,
  /** Terrain base food production per season. */
  terrainFood: {
    farmland: 3, plains: 2, coast: 1, forest: 1,
    hills: 1, mountains: 0, desert: 0, marsh: 1,
  } as Record<TerrainType, number>,
  /** Tax food penalty fraction by lower-tax level (1=Minimal … 5=Oppressive). */
  taxFoodPenalty: { 1: 0, 2: 0.10, 3: 0.20, 4: 0.35, 5: 0.55 } as Record<TaxLevel, number>,
  /** Marketplace tax penalty mitigation by tier (multiplicative reduction). */
  marketplaceMitigation: { 1: 0.15, 2: 0.25, 3: 0.35 } as Record<number, number>,
  /** Famine unrest per season: soft phase (timer 1-2). */
  famineUnrestSoft: 10,
  /** Famine unrest per season: hard phase (timer 3+). */
  famineUnrestHard: 25,
  /** Seasons of deficit before population death begins. */
  famineHardThreshold: 3,
  /** Granary T3 adds this many extra seasons before hard phase. */
  granaryT3FamineDelay: 1,
};

// ══════════════════════════════════════════════
//  POPULATION GROWTH
// ══════════════════════════════════════════════

export const GROWTH = {
  /** Growth threshold formula: base + pop × multiplier. */
  thresholdBase: 3,
  thresholdPerPop: 1,
  /** Feature pool: min and max features assigned per run. */
  featurePoolMin: 8,
  featurePoolMax: 12,
};

// ══════════════════════════════════════════════
//  TAX SYSTEM
// ══════════════════════════════════════════════

export const TAX = {
  /** Tax rate (fraction of wealth) by combined lower+upper level (2-10). */
  rates: {
    2: 0.03, 3: 0.05, 4: 0.07, 5: 0.09, 6: 0.12,
    7: 0.15, 8: 0.18, 9: 0.21, 10: 0.25,
  } as Record<number, number>,
  /** Unrest delta per season from lower-tax level. */
  lowerUnrest: { 1: -3, 2: -1, 3: 0, 4: 3, 5: 8 } as Record<TaxLevel, number>,
  /** Unrest delta per season from upper-tax level. */
  upperUnrest: { 1: -2, 2: 0, 3: 0, 4: 3, 5: 8 } as Record<TaxLevel, number>,
  /** Display labels. */
  labels: { 1: 'Minimal', 2: 'Low', 3: 'Normal', 4: 'High', 5: 'Oppressive' } as Record<TaxLevel, string>,
};

// ══════════════════════════════════════════════
//  WEALTH SYSTEM
// ══════════════════════════════════════════════

export const WEALTH = {
  /** Base Positive Wealth Generation per season. */
  basePWG: 2,
  /** PWG bonus from commercial buildings by type and level. */
  buildingPWG: {
    market:       { 1: 2, 2: 3, 3: 4 },
    port:         { 1: 2, 2: 3, 3: 4 },
    oasis_market: { 1: 2, 2: 3, 3: 4 },
    caravan_post: { 1: 3, 2: 4, 3: 5 },
  } as Record<string, Record<number, number>>,
  /** Negative Wealth Generation formula: NWG = -(flat + mult × PWG). */
  nwgParams: {
    1: { flat: 0.5, mult: 0.05 },
    2: { flat: 1.0, mult: 0.10 },
    3: { flat: 1.5, mult: 0.20 },
    4: { flat: 3.0, mult: 0.50 },
    5: { flat: 5.0, mult: 1.00 },
  } as Record<TaxLevel, { flat: number; mult: number }>,
  /** Terrain base wealth for newly conquered provinces. */
  terrainBase: {
    coast: 35, farmland: 30, hills: 25, plains: 20,
    forest: 20, desert: 15, marsh: 10, mountains: 10,
  } as Record<TerrainType, number>,
  /** Trade good wealth bonus for newly conquered provinces. */
  tradeGoodBonus: {
    gold_ore: 20, silk: 15, salt: 10, iron: 8, marble: 8,
    incense: 8, wine: 6, horses: 5, fish: 5, olives: 5,
    grain: 3, timber: 3,
  } as Record<string, number>,
  /** Wealth drained per season during active devastation. */
  devastationDrain: 2,
};

// ══════════════════════════════════════════════
//  UNREST & REBELLION
// ══════════════════════════════════════════════

export const UNREST = {
  /** Natural unrest decay per season. */
  naturalDecay: 2,
  /** Acceleration factor when unrest > 60: (unrest - 60) × factor. */
  accelThreshold: 60,
  accelFactor: 0.25,
  /** Unrest added per province when empire can't cover all expenses. */
  expenseShortfall: 10,
  /** Base rebellion threshold. */
  rebellionThreshold: 80,
  /** Insula T2 raises threshold to this. */
  insulaT2Threshold: 90,
  /** Insula T3 makes rebellion impossible (threshold above 100). */
  insulaT3Threshold: 101,
  /** Rebellion consequences by count (0=1st, 1=2nd, 2=3rd/Ruined). */
  rebellion: {
    first:  { destroyMin: 1, destroyMax: 2, popLoss: 1, unrestReset: 40, devastation: 4, rubble: 2 },
    second: { destroy: 2,                   popLoss: 2, unrestReset: 40, devastation: 4, rubble: 2 },
    ruined: {                               popFloor: 1, unrestReset: 40, devastation: 8, rubble: 8, wealthReset: 0 },
  },
};

// ══════════════════════════════════════════════
//  SETTLEMENT TIERS
// ══════════════════════════════════════════════

export const SETTLEMENT = {
  /** Population thresholds for settlement labels and building slots. */
  tiers: [
    { maxPop:  2, label: 'Settlement',  slots: 1 },
    { maxPop:  4, label: 'Village',     slots: 2 },
    { maxPop:  6, label: 'Town',        slots: 3 },
    { maxPop:  8, label: 'City',        slots: 4 },
    { maxPop: 10, label: 'Major City',  slots: 5 },
    { maxPop: Infinity, label: 'Metropolis', slots: 6 },
  ],
  /** Wealth tier thresholds for map dot coloring. */
  wealthTiers: [
    { maxWealth:  20, label: 'Destitute',  color: '#c24a3a' },
    { maxWealth:  50, label: 'Poor',       color: '#d4a843' },
    { maxWealth: 100, label: 'Growing',    color: '#c8c0a8' },
    { maxWealth: 200, label: 'Prosperous', color: '#5a8a4a' },
    { maxWealth: Infinity, label: 'Wealthy', color: '#f0d080' },
  ],
};

// ══════════════════════════════════════════════
//  ARMY
// ══════════════════════════════════════════════

export const ARMY = {
  /** Legate hire cost in gold. */
  legateHireCost: 80,
  /** Cohort recruitment costs (gold). */
  cohortCosts: {
    velites:    30,
    hastati:    40,
    principes:  80,
    equites:    90,
    triarii:   100,
  } as Record<string, number>,
  /** Enemy threat scaling: multiplier = 1 + threat × factor. */
  threatScalingFactor: 0.05,
};

// ══════════════════════════════════════════════
//  COUNCIL
// ══════════════════════════════════════════════

export const COUNCIL = {
  /** XP required for tier-up. */
  xpTier2: 5,
  xpTier3: 12,
};

// ══════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════

export const NOTIFICATIONS = {
  /** Default auto-dismiss durations in ms. */
  toastDuration: 3000,
  alertDuration: 1500,
  /** Rebellion/famine alert duration. */
  criticalDuration: 4000,
};

// ══════════════════════════════════════════════
//  ASSET PATHS
// ══════════════════════════════════════════════

export const ASSETS = {
  textures: {
    terrainMap: '/textures/v2/terrain_map.png',
    battlegrounds: [
      '/textures/battlegrounds/battleground.png',
      '/textures/battlegrounds/battleground2.png',
      '/textures/battlegrounds/Battleground3.png',
    ],
  },
  shields: {
    viking:    '/asset/soldiers/viking_common_soldier.png',
    samurai:   '/asset/soldiers/samurai_uncommon_soldier.png',
    elephant:  '/asset/soldiers/war_elephant_rare_soldier.png',
    persian:   '/asset/soldiers/persian_immortal_uncommon_soldier.png',
    roman:     '/asset/soldiers/roman_common_soldier.png',
    spartan:   '/asset/soldiers/spartan_rare_soldier.png',
    commander: '/asset/soldiers/commander_leader_card.png',
  },
  commanders: {
    pope:     '/asset/characters/char_pope_leo.png',
    boudicca: '/asset/characters/char_boudicca_v2.png',
    augustus:  '/asset/characters/char_caesar_augustus_v2.png',
    crassus:  '/asset/characters/char_marcus_crassus_v2.jpeg',
  },
  ui: {
    curtainLeft: '/asset/ui/cortina_izq.png',
    victoryBanner: '/asset/ui/victory_banner.png',
    /** Dynamic building icon path. Use: `ASSETS.ui.buildingIcon('castrum')` */
    buildingIcon: (type: string) => `/asset/buildings/building_${type}.png`,
  },
};

// ══════════════════════════════════════════════
//  MAP VIEW
// ══════════════════════════════════════════════

export const MAP_VIEW = {
  radiusSelected: 8,
  radiusOwned: 5,
  radiusUnclaimed: 3,
  clickHitRadius: 15,
  cssHeight: 200,
  labelFont: '9px "Segoe UI", system-ui, sans-serif',
  unrestDotMinThreshold: 30,
};

// ══════════════════════════════════════════════
//  INVESTMENT DISCOUNT
// ══════════════════════════════════════════════

export const ECONOMY = {
  /** Maximum investment discount (prevents free buildings). */
  maxInvestmentDiscount: 90,
};

// ══════════════════════════════════════════════
//  ARMY SUPPLIES (FT-SUP)
// ══════════════════════════════════════════════

/** Gold cost per supply unit bought in the Exercitus tab. */
export const SUPPLIES_COST_GOLD = 1;

/** Cap on supplies an army can carry into a spoke. */
export const SUPPLY_MAX_CARRY = 40;

/** Fraction of max HP each cohort loses on a deficit node traversal. */
export const SUPPLY_HP_DAMAGE_PCT = 0.20;

/** Absolute morale points lost per deficit traversal (accumulates). */
export const SUPPLY_MORALE_PENALTY_PER_DEFICIT = 8;

/** Cap on the cumulative morale penalty from supply deficit. */
export const SUPPLY_MORALE_PENALTY_CAP = 40;
