import type { Faction, ResourceType } from '../game/core/commander';

// ── Army ──────────────────────────────────────────────────
// Cohort is defined in the army domain module. Imported here for use in
// ArmyData and re-exported so it's importable project-wide from 'src/types'.
import type { Cohort } from '../game/army/cohort';
export type { Cohort };

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

export interface ArmyData {
  id: number;
  owner: string;
  name: string;
  /**
   * Current effective size (troop count). On creation, initialized as the
   * sum of cohort HP via `computeArmySize`. Legacy strategic-map combat
   * (src/game/map/army.ts) subtracts damage directly from this field;
   * cohort-level HP tracking is deferred to a future sprint.
   */
  size: number;
  /**
   * Cohort roster — source of truth for army composition. Consumed by the
   * cohort→BattleUnit mapper (S14-04) when an army is deployed to a Pitched
   * Battle. May be an empty array for armies created without cohort data.
   */
  cohorts: Cohort[];
  /**
   * Attached Legate id, or `null` if none. Resolved through the hiring pool
   * in `src/game/army/legate-pool.ts` (S14-02).
   */
  legateId: string | null;
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

/** Tax level for lower/upper class (1=Very Low … 5=Very High) */
export type TaxLevel = 1 | 2 | 3 | 4 | 5;

/** Wealth tier for province display (1=Poor … 5=Wealthy) */
export type WealthTier = 1 | 2 | 3 | 4 | 5;

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
