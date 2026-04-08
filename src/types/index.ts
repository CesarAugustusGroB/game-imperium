import type { Faction, ResourceType } from '../game/core/commander';

export interface ProvinceData {
  index: number;
  color: [number, number, number];
  name: string;
  terrain: string;
  owner: string;
  population: number;
}

export interface NationData {
  id: string;
  name: string;
  color: [number, number, number];
  capital: number;
}

export interface MapTextures {
  idMap: WebGLTexture;
  terrain: WebGLTexture;
  heightmap: WebGLTexture;
  normalMap: WebGLTexture;
  borders: WebGLTexture;
  mapWidth: number;
  mapHeight: number;
}

export interface ArmyData {
  id: number;
  owner: string;
  name: string;
  size: number;
  provinceIndex: number;       // Current province (or origin during movement)
  targetProvinceIndex: number | null;  // Destination province during movement
  progress: number;            // 0-1 interpolation during movement
  path: number[];              // Queued province indices to traverse
  inCombat: boolean;
  combatTarget: number | null; // Enemy army ID
  lastRoll: number;            // Last dice roll (for display)
}

export interface BattleEvent {
  attackerId: number;
  attackerName: string;
  defenderId: number;
  defenderName: string;
  attackerRoll: number;
  defenderRoll: number;
  attackerDamage: number;
  defenderDamage: number;
  provinceIndex: number;
  timestamp: number;
}

export interface TopologyData {
  centers: Record<string, [number, number]>;  // province index -> [u, v]
  adjacency: Record<string, number[]>;        // province index -> neighbor indices
}

// ── Shared Entity Interfaces ──────────────────────────────

/** Base identity for all game objects */
export interface GameEntity {
  id: string;
  name: string;
}

/** Entity affiliated with a faction color */
export interface FactionAffiliated {
  color: Faction;
}

/** Fixed 3-tier progression level */
export type TierLevel = 1 | 2 | 3;

/** Tuple of exactly 3 tier definitions */
export type TierTuple<T> = [T, T, T];

/** Entity with a 3-tier progression system */
export interface Tiered<T> {
  tiers: TierTuple<T>;
}

/** Player-owned item with faction color */
export interface Collectible extends GameEntity, FactionAffiliated {}

/** Resource cost (used across 5+ systems) */
export type ResourceCost = Partial<Record<ResourceType, number>>;
