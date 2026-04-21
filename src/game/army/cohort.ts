import type {
  MovementProfileId, UnitRole, UnitStats,
} from '../../battle/battle-types';

/**
 * Rarity tier for a recruitable cohort. Mirrors the ladder authored in
 * `public/asset/soldiers/style-guide.json > rarities` and the sprite catalog
 * in `public/asset/soldiers/soldiers.json`. Drives tier cues in the
 * Recruitment Screen and (later) any rarity-based drop / gacha logic.
 */
export type CohortRarity = 'common' | 'uncommon' | 'rare' | 'super-rare' | 'secret-rare' | 'leader';

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
   * Rarity tier. Mirrors `style-guide.json > rarities[id]`; links this cohort
   * to its art-catalog entry in `soldiers.json`. Optional for older entries.
   */
  rarity?: CohortRarity;
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
  /**
   * FT-SUP: carried-over current HP. Undefined means the cohort is at full
   * health (`stats.hp`). Decremented by the spoke supply-attrition loop in
   * `supplies.consumeTraversal`. Read by `battle/deployment.ts` when
   * spawning BattleUnits so HP damage persists from strategic layer to
   * tactical layer. `stats.hp` is NEVER decremented — it remains the max
   * HP of the spawned BattleUnit so the health bar renders correctly.
   */
  currentHp?: number;
}

/**
 * Sum of all cohort HP in a roster. Used as the initial `size` value on
 * ArmyData when an army is created with cohorts (S14-03).
 */
export function computeArmySize(cohorts: readonly Cohort[]): number {
  return cohorts.reduce((sum, c) => sum + c.stats.hp, 0);
}
