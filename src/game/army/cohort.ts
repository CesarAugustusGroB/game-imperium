import type {
  MovementProfileId, UnitRole, UnitStats,
} from './unit-types';
import { getCohortById, getGallicCohortById } from './cohort-data';

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
  /**
   * Stable per-instance identity for this recruited roster entry.
   *
   * Multiple cohorts may share the same catalog `id` (e.g. two Hastati), so
   * downstream systems that need to track one specific roster entry across
   * embark/save/battle must key on `instanceId` instead of the cohort type.
   *
   * Optional for migration: legacy saves/older roster creators may omit it,
   * and `normalizeCohortRoster()` will backfill a value.
   */
  instanceId?: string;
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
   * Mercenary cohorts are hired for gold only. They bypass the standard
   * iuniores recruitment gate but otherwise behave like normal cohorts.
   */
  mercenary?: boolean;
  /**
   * FT-SUP: carried-over current HP. Undefined means the cohort is at full
   * health (`stats.hp`). Decremented by the spoke supply-attrition loop in
   * `supplies.consumeTraversal`. Read by `battle/deployment.ts` when
   * spawning BattleUnits so HP damage persists from strategic layer to
   * tactical layer. `stats.hp` is NEVER decremented — it remains the max
   * HP of the spawned BattleUnit so the health bar renders correctly.
   */
  currentHp?: number;
  /**
   * FT-HEAL: cohort survived battle but is unavailable for deployment until
   * replenished in the Hub. Healing APIs clear this flag automatically once
   * HP is restored to a deployable state.
   */
  outOfAction?: boolean;
}

/**
 * Sum of all cohort HP in a roster. Used as the initial `size` value on
 * ArmyData when an army is created with cohorts (S14-03).
 */
export function computeArmySize(cohorts: readonly Cohort[]): number {
  return cohorts.reduce((sum, c) => sum + c.stats.hp, 0);
}

function buildCohortInstanceId(cohortId: string): string {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${cohortId}-${suffix}`;
}

/**
 * Clone a catalog cohort into a distinct roster instance with its own stable
 * identity. Use this for recruitment/starter armies instead of spreading the
 * catalog object directly.
 */
export function createCohortInstance(cohort: Cohort): Cohort {
  return {
    ...cohort,
    instanceId: buildCohortInstanceId(cohort.id),
  };
}

/**
 * Returns the stable lookup key for a cohort, falling back to the catalog id
 * when `instanceId` is missing (legacy / pre-S26-01 saves). Use this anywhere
 * that builds a Map keyed by cohort identity for write-back or replenishment.
 */
export function cohortInstanceKey(cohort: Cohort): string {
  return cohort.instanceId ?? cohort.id;
}

/**
 * Build a Cohort with updated HP/outOfAction state, preserving reference
 * stability when the inputs already match. Strips `currentHp` when at maxHp
 * (FT-SUP convention: undefined = full health) and strips `outOfAction`
 * when false. Always returns a fresh object when something changed.
 */
export function applyCohortHealthState(
  cohort: Cohort,
  newCurrentHp: number,
  outOfAction: boolean,
): Cohort {
  const maxHp = cohort.stats.hp;
  const targetCurrentHp = newCurrentHp >= maxHp ? undefined : newCurrentHp;
  const targetOutOfAction = outOfAction ? true : undefined;

  if (cohort.currentHp === targetCurrentHp && (cohort.outOfAction === true) === outOfAction) {
    return cohort;
  }

  const { currentHp: _currentHp, outOfAction: _outOfAction, ...rest } = cohort;
  void _currentHp;
  void _outOfAction;

  const next: Cohort = { ...rest };
  if (targetCurrentHp !== undefined) next.currentHp = targetCurrentHp;
  if (targetOutOfAction !== undefined) next.outOfAction = targetOutOfAction;
  return next;
}

/**
 * Normalize a roster so every cohort has a unique stable instanceId.
 *
 * This backfills legacy saves and also defends against accidental duplicate
 * instance ids inside the same roster.
 */
export function normalizeCohortRoster(cohorts: readonly Cohort[]): Cohort[] {
  const seen = new Set<string>();
  return cohorts.map((cohort) => {
    const candidate = cohort.instanceId;
    const instanceId = candidate && !seen.has(candidate)
      ? candidate
      : buildCohortInstanceId(cohort.id);
    seen.add(instanceId);
    // Refresh stats from the catalog by id so legacy saves (old atk/def/agi
    // shape, varying hp) adopt the current flat-HP + power-stat block. Clamp any
    // carried-over currentHp down to the new max.
    const template = getCohortById(cohort.id) ?? getGallicCohortById(cohort.id);
    const stats = template ? template.stats : cohort.stats;
    const next: Cohort = { ...cohort, instanceId, stats };
    if (next.currentHp != null && next.currentHp > stats.hp) next.currentHp = stats.hp;
    return next;
  });
}

// ── Merge / consolidate (FT-MERGE) ──

/** Total CURRENT hp across a roster — the quantity merge conserves (≠ computeArmySize,
 *  which sums MAX hp × cohort count and so legitimately drops when cohorts merge). */
export function totalCurrentHp(cohorts: readonly Cohort[]): number {
  return cohorts.reduce((sum, c) => sum + (c.currentHp ?? c.stats.hp), 0);
}

/** Same-type instances in a roster, by catalog id. */
function cohortsOfType(roster: readonly Cohort[], cohortId: string): Cohort[] {
  return roster.filter((c) => c.id === cohortId);
}

/**
 * Whether merging the `cohortId` group would actually free a roster slot — i.e.
 * there are ≥2 instances and their combined current HP repacks into fewer full
 * cohorts than the current count (so at least one is damaged). Drives the
 * "Merge" button's enabled state.
 */
export function canConsolidate(roster: readonly Cohort[], cohortId: string): boolean {
  const group = cohortsOfType(roster, cohortId);
  if (group.length < 2) return false;
  const maxHp = group[0].stats.hp;
  const packed = Math.max(1, Math.ceil(totalCurrentHp(group) / maxHp));
  return packed < group.length;
}

/**
 * Consolidate all roster instances sharing `cohortId` into the fewest cohorts
 * that conserve the group's total CURRENT HP ("lossless, with remainder"):
 * damaged same-type cohorts are repacked into full cohorts (maxHp each) plus at
 * most one partial holding the remainder; the now-empty slots are dropped. This
 * frees roster slots and can revive out-of-action fragments into a deployable
 * cohort WITHOUT spending iuniores — the cost is the surrendered slot(s), not HP.
 *
 * `totalCurrentHp` is invariant across the call (no HP is created or destroyed);
 * `computeArmySize` (max capacity) intentionally shrinks. Non-group cohorts are
 * returned untouched, and the survivors take the position of the group's first
 * instance so overall order is preserved. Pure — returns a new roster.
 */
export function consolidateCohorts(roster: readonly Cohort[], cohortId: string): Cohort[] {
  const group = cohortsOfType(roster, cohortId);
  if (group.length < 2) return roster.slice();

  const maxHp = group[0].stats.hp;
  let remaining = totalCurrentHp(group);
  const outCount = Math.max(1, Math.ceil(remaining / maxHp));

  // Reuse the first `outCount` stable instance identities; fill full, then remainder.
  const survivors: Cohort[] = [];
  for (let i = 0; i < outCount; i++) {
    const hp = Math.min(maxHp, remaining);
    remaining -= hp;
    survivors.push(applyCohortHealthState(group[i], hp, false));
  }

  // Replace the group's instances with the survivors at the first group position.
  const result: Cohort[] = [];
  let emitted = false;
  for (const c of roster) {
    if (c.id === cohortId) {
      if (!emitted) { result.push(...survivors); emitted = true; }
    } else {
      result.push(c);
    }
  }
  return result;
}
