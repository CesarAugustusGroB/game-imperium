import type { InvestmentType } from '../game/province/province';

// ── Terrain types ──

export type TerrainType =
  | 'farmland'
  | 'hills'
  | 'coast'
  | 'forest'
  | 'plains'
  | 'mountains'
  | 'marsh'
  | 'desert';

/**
 * Terrain-specific building slugs — not yet in InvestmentType.
 * Will be merged into InvestmentType in S17-05 when INVESTMENT_DATA entries
 * are added for each building.
 */
export type TerrainBuildingType =
  | 'granary'
  | 'villa'
  | 'mine'
  | 'forge'
  | 'port'
  | 'fishery'
  | 'sacred_grove'
  | 'lumber_camp'
  | 'training_ground'
  | 'stables'
  | 'watchtower'
  | 'mountain_pass'
  | 'oracle_shrine'
  | 'reed_harvest'
  | 'oasis_market'
  | 'caravan_post';

// ── Terrain modifier shape ──

export interface TerrainModifiers {
  /** Delta to raw population growth per season (e.g. +2 farmland, -2 desert). */
  growthModifier: number;
  /** Delta to Positive Wealth Generation (PWG) per season (e.g. +1 hills/coast). */
  pwgModifier: number;
  /** Bonus faith income per season (+1 forest/marsh). */
  faithBonus: number;
  /** Bonus momentum income per season (+1 plains). */
  momentumBonus: number;
  /** Passive garrison strength bonus (+2 mountains). */
  garrisonBonus: number;
}

// ── Terrain data shape ──

export interface TerrainData {
  id: TerrainType;
  name: string;
  baseModifiers: TerrainModifiers;
  /**
   * Buildings available only in provinces with this terrain.
   * Type TerrainBuildingType for now; S17-05 will promote these to InvestmentType
   * and add their INVESTMENT_DATA entries.
   */
  exclusiveBuildings: TerrainBuildingType[];
  /** Short flavour text for UI display. */
  flavour: string;
}

// ── Zero-modifier baseline (for extending) ──

const ZERO_MODIFIERS: TerrainModifiers = {
  growthModifier: 0,
  pwgModifier: 0,
  faithBonus: 0,
  momentumBonus: 0,
  garrisonBonus: 0,
};

// ── Canonical terrain table ──

export const TERRAIN_DATA: Record<TerrainType, TerrainData> = {
  farmland: {
    id: 'farmland',
    name: 'Farmland',
    baseModifiers: { ...ZERO_MODIFIERS, growthModifier: 2 },
    exclusiveBuildings: ['granary', 'villa'],
    flavour: 'Fertile fields and pastoral estates feed a growing population.',
  },
  hills: {
    id: 'hills',
    name: 'Hills',
    baseModifiers: { ...ZERO_MODIFIERS, pwgModifier: 1 },
    exclusiveBuildings: ['mine', 'forge'],
    flavour: 'Ore-rich slopes reward the patient miner with steady metal wealth.',
  },
  coast: {
    id: 'coast',
    name: 'Coast',
    baseModifiers: { ...ZERO_MODIFIERS, pwgModifier: 1 },
    exclusiveBuildings: ['port', 'fishery'],
    flavour: 'Sea lanes and tidal nets make coastal towns naturally prosperous.',
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    baseModifiers: { ...ZERO_MODIFIERS, faithBonus: 1 },
    exclusiveBuildings: ['sacred_grove', 'lumber_camp'],
    flavour: 'Ancient groves inspire reverence and yield timber in equal measure.',
  },
  plains: {
    id: 'plains',
    name: 'Plains',
    baseModifiers: { ...ZERO_MODIFIERS, momentumBonus: 1 },
    exclusiveBuildings: ['training_ground', 'stables'],
    flavour: 'Open ground breeds swift cavalry and disciplined legions.',
  },
  mountains: {
    id: 'mountains',
    name: 'Mountains',
    baseModifiers: { ...ZERO_MODIFIERS, growthModifier: -1, garrisonBonus: 2 },
    exclusiveBuildings: ['watchtower', 'mountain_pass'],
    flavour: 'Harsh peaks make growth slow, but defenders hold the high ground.',
  },
  marsh: {
    id: 'marsh',
    name: 'Marsh',
    baseModifiers: { ...ZERO_MODIFIERS, growthModifier: -1, faithBonus: 1 },
    exclusiveBuildings: ['oracle_shrine', 'reed_harvest'],
    flavour: 'Mist and murk birth strange faiths and strange harvests alike.',
  },
  desert: {
    id: 'desert',
    name: 'Desert',
    baseModifiers: { ...ZERO_MODIFIERS, growthModifier: -2, pwgModifier: 2 },
    exclusiveBuildings: ['oasis_market', 'caravan_post'],
    flavour: 'Sparse population but lucrative trade routes crossing the sands.',
  },
};

// ── Helpers ──

/** Return the base modifiers for a terrain type. */
export function getTerrainModifiers(terrain: TerrainType): TerrainModifiers {
  return TERRAIN_DATA[terrain].baseModifiers;
}

/**
 * Return the exclusive buildings available in a province with this terrain.
 * These will become `InvestmentType[]` once S17-05 adds their INVESTMENT_DATA entries.
 */
export function getExclusiveBuildings(terrain: TerrainType): TerrainBuildingType[] {
  return TERRAIN_DATA[terrain].exclusiveBuildings;
}

/**
 * Universal buildings (available in all terrain types, regardless of Province.terrain).
 * Kept here for reference so terrain-gating logic (S17-04) has one source of truth.
 */
export const UNIVERSAL_BUILDINGS: InvestmentType[] = [
  'castrum',
  'basilica',
  'pantheon',
  'market',
  'aqueduct',
  'insula',
];
