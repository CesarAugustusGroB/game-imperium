import type {
  MovementProfileId, UnitRole, UnitStats,
} from '../../battle/battle-types';

/**
 * Cohort — the atomic unit of an Imperium army.
 *
 * Each Cohort in an army is a roster entry that, when deployed to a Pitched
 * Battle, spawns exactly one BattleUnit on the hex grid with the cohort's
 * stats and target role.
 *
 * Cohort types are data-driven (see cohort-data.ts) so new types can be added
 * without code changes (S14 NFR-1).
 */
export interface Cohort {
  /** Unique identifier for the cohort type (e.g. "hastati"). */
  id: string;
  /** Display name (e.g. "Hastati"). */
  name: string;
  /** BattleUnit role this cohort maps to when spawned on the hex grid. */
  role: UnitRole;
  /** Combat stats applied to the spawned BattleUnit. */
  stats: UnitStats;
  /** Aurum cost to recruit one cohort of this type. */
  aurumCost: number;
  /** Flavor description shown in the Recruitment Screen. */
  description: string;
  /**
   * Optional sprite override for this cohort. Must match a key registered by
   * `SpriteManager` (see `/asset/soldiers/soldiers.json` ids, e.g. "samurai",
   * "viking"). When unset, the renderer falls back to `${faction}:${role}`.
   */
  spriteId?: string;
  /**
   * Optional movement AI profile for this cohort. Decoupled from `role` so two
   * cohorts sharing a role can play distinctly (e.g. Hastati march forward while
   * Velites skirmish). When unset, a role-based default is applied at spawn.
   * Keys must exist in `MOVEMENT_PROFILES` (see `src/battle/movements/profiles.ts`).
   */
  movementProfile?: MovementProfileId;
}

/**
 * Sum of all cohort HP in a roster. Used as the initial `size` value on
 * ArmyData when an army is created with cohorts (S14-03).
 */
export function computeArmySize(cohorts: readonly Cohort[]): number {
  return cohorts.reduce((sum, c) => sum + c.stats.hp, 0);
}
