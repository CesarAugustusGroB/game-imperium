import type { TerrainType } from './terrain-data';
import type { TerrainBuildingType } from './terrain-data';

// ── Trade good types ──

export type TradeGoodType =
  | 'grain'
  | 'iron'
  | 'silk'
  | 'marble'
  | 'wine'
  | 'timber'
  | 'fish'
  | 'horses'
  | 'gold_ore'
  | 'incense'
  | 'salt'
  | 'olives';

// ── Special effect shape ──

/**
 * Discriminated union of special effects a trade good may grant.
 * null = no special effect.
 */
export type TradeGoodSpecial =
  | { type: 'pop-cap-bonus'; amount: number }
  | { type: 'build-cost-discount'; percent: number }
  | { type: 'unrest-reduction'; amount: number }
  | { type: 'enables-building'; building: TerrainBuildingType }
  | null;

// ── Trade good data shape ──

export interface TradeGoodData {
  id: TradeGoodType;
  name: string;
  /** Flat gold income per season (not multiplied by wealth tier or tax). */
  flatGold: number;
  /** Flat population growth contribution per season. */
  flatGrowth: number;
  /** Flat iuniores (recruit) income per season. */
  flatIuniores: number;
  /** Flat Positive Wealth Generation (PWG) bonus per season. */
  wealthGrowthBonus: number;
  /** Optional special effect (pop cap, build discount, unrest, building enabler, cavalry). */
  special: TradeGoodSpecial;
  /** Terrain types in which this good can be found. */
  validTerrains: TerrainType[];
}

// ── Canonical trade goods table ──

export const TRADE_GOOD_DATA: Record<TradeGoodType, TradeGoodData> = {
  grain: {
    id: 'grain', name: 'Grain',
    flatGold: 0, flatGrowth: 5, flatIuniores: 0, wealthGrowthBonus: 0,
    special: null,
    validTerrains: ['farmland'],
  },
  iron: {
    id: 'iron', name: 'Iron',
    flatGold: 1, flatGrowth: 0, flatIuniores: 1, wealthGrowthBonus: 0,
    special: { type: 'enables-building', building: 'forge' },
    validTerrains: ['hills'],
  },
  silk: {
    id: 'silk', name: 'Silk',
    flatGold: 3, flatGrowth: 0, flatIuniores: 0, wealthGrowthBonus: 2,
    special: null,
    validTerrains: ['coast', 'desert'],
  },
  marble: {
    id: 'marble', name: 'Marble',
    flatGold: 1, flatGrowth: 0, flatIuniores: 0, wealthGrowthBonus: 0,
    special: { type: 'build-cost-discount', percent: 15 },
    validTerrains: ['hills'],
  },
  wine: {
    id: 'wine', name: 'Wine',
    flatGold: 1, flatGrowth: 0, flatIuniores: 0, wealthGrowthBonus: 0,
    special: { type: 'unrest-reduction', amount: 5 },
    validTerrains: ['farmland'],
  },
  timber: {
    id: 'timber', name: 'Timber',
    flatGold: 1, flatGrowth: 0, flatIuniores: 0, wealthGrowthBonus: 0,
    special: { type: 'build-cost-discount', percent: 10 },
    validTerrains: ['forest'],
  },
  fish: {
    id: 'fish', name: 'Fish',
    flatGold: 1, flatGrowth: 1, flatIuniores: 0, wealthGrowthBonus: 0,
    special: null,
    validTerrains: ['coast'],
  },
  horses: {
    id: 'horses', name: 'Horses',
    flatGold: 0, flatGrowth: 0, flatIuniores: 2, wealthGrowthBonus: 0,
    special: null,
    validTerrains: ['plains'],
  },
  gold_ore: {
    id: 'gold_ore', name: 'Gold Ore',
    flatGold: 4, flatGrowth: 0, flatIuniores: 0, wealthGrowthBonus: 2,
    special: null,
    validTerrains: ['hills', 'desert'],
  },
  incense: {
    id: 'incense', name: 'Incense',
    flatGold: 2, flatGrowth: 0, flatIuniores: 0, wealthGrowthBonus: 0,
    special: null,
    validTerrains: ['forest', 'marsh'],
  },
  salt: {
    id: 'salt', name: 'Salt',
    flatGold: 2, flatGrowth: 1, flatIuniores: 0, wealthGrowthBonus: 1,
    special: null,
    validTerrains: ['coast', 'marsh'],
  },
  olives: {
    id: 'olives', name: 'Olives',
    flatGold: 1, flatGrowth: 1, flatIuniores: 0, wealthGrowthBonus: 0,
    special: null,
    validTerrains: ['farmland', 'coast'],
  },
};

// ── Helpers ──

/** All trade goods valid for a given terrain type. */
export function getTradeGoodsForTerrain(terrain: TerrainType): TradeGoodType[] {
  return (Object.keys(TRADE_GOOD_DATA) as TradeGoodType[]).filter(
    k => TRADE_GOOD_DATA[k].validTerrains.includes(terrain),
  );
}
