/**
 * battle-casualties — write-back from BattleState → boundArmy cohorts (S26-03 / FT-HEAL).
 *
 * After a battle ends (victory / defeat / retreat), each player cohort needs
 * its HP and out-of-action status persisted onto the strategic side so the
 * next encounter can read damaged state. Deployment spawns 1 BattleUnit per
 * cohort tagged with `cohortInstanceId` (see `src/battle/deployment.ts`), so
 * the mapping back is 1:1 by instance identity — no HP averaging.
 *
 * Pure: does not mutate inputs, has no signal access. The orchestrator in
 * `src/main.tsx` calls this helper and writes the result onto
 * `currentSpoke.value.boundArmy`.
 *
 * Outcomes per cohort:
 *   - Surviving unit (currentHp > 0 AND !isDying) → currentHp is updated;
 *     the field is dropped when the unit is at full health (canonical shape).
 *   - Dying / 0-HP unit                            → currentHp = 1, outOfAction = true.
 *   - No matching unit found                       → cohort preserved verbatim
 *     (defensive: covers cohorts that never got placed for any reason).
 *
 * The `outOfAction` rule fires only when the cohort's single unit reached 0 HP
 * (or is mid-death-animation). FT-HEAL R-3 — a cohort with units alive at >0
 * HP is not flagged. With 1 cohort = 1 unit this collapses to the binary
 * "did the unit survive?" question.
 */

import { signal } from '@preact/signals';
import type { BattleUnit } from './battle-types';
import type { Cohort } from '../game/army/cohort';
import { VICTORY_CAP_RATIO } from '../config/game-config';

/** Surviving HP > 0 and not in death animation. */
function isAlive(unit: BattleUnit): boolean {
  return !unit.isDying && unit.currentHp > 0;
}

/**
 * Per-cohort breakdown of how much HP loss the victory cap absorbed.
 * S26-08's post-battle UI reads this to render the "Field Recovery" line.
 */
export interface VictoryCapAbsorption {
  cohortInstanceId: string;
  cohortName: string;
  /** Raw HP loss before the cap was applied (post-battle currentHp delta). */
  rawLoss: number;
  /** HP loss after the cap. ≤ rawLoss. */
  cappedLoss: number;
  /** rawLoss − cappedLoss. Zero when the cap didn't bind. */
  absorbedHp: number;
}

export interface VictoryCapResult {
  /** Final cohort roster after the cap was applied. */
  cohorts: Cohort[];
  /** Per-cohort breakdown for the post-battle UI. */
  absorbedPerCohort: VictoryCapAbsorption[];
  /** Total HP absorbed across all cohorts. */
  totalAbsorbedHp: number;
  /** unitsKilled / unitsDeployed at the moment the cap was computed. */
  unitLossRatio: number;
}

/**
 * Last applied victory cap result. Set by `src/main.tsx` on a victorious
 * battle, read by S26-08's post-battle "Field Recovery" panel. Cleared
 * before the next battle (no-op for defeats / retreats — the cap is
 * never applied on those outcomes).
 */
export const lastVictoryCapSummary = signal<VictoryCapResult | null>(null);

/**
 * Project per-unit battle HP back onto a cohort roster. Returns a new array
 * with updated `currentHp` / `outOfAction` fields. Reference-stable for any
 * cohort whose state didn't change.
 */
export function extractCohortHpSnapshot(
  units: readonly BattleUnit[],
  cohorts: readonly Cohort[],
): Cohort[] {
  // Build instance lookup once. Battle units without an instanceId (e.g.
  // Augustus allies, doctrine spawns) don't map to any cohort and are
  // ignored here.
  const unitByInstance = new Map<string, BattleUnit>();
  for (const unit of units) {
    if (unit.cohortInstanceId !== undefined) {
      unitByInstance.set(unit.cohortInstanceId, unit);
    }
  }

  return cohorts.map((cohort) => {
    if (cohort.instanceId === undefined) return cohort;
    const unit = unitByInstance.get(cohort.instanceId);
    if (!unit) return cohort;

    const maxHp = cohort.stats.hp;

    if (isAlive(unit)) {
      // Surviving cohort: clear any prior outOfAction, write back HP.
      const newCurrentHp = Math.max(0, Math.min(maxHp, unit.currentHp));
      return applyCohortState(cohort, newCurrentHp, false);
    }

    // 0-HP or dying: mark out of action, hold at 1 HP so the cohort stays in
    // the roster but is not deployable until healed.
    return applyCohortState(cohort, 1, true);
  });
}

/**
 * Compute the victory damage cap for a battle the player won (FT-HEAL FR-11).
 *
 * Pure: takes the pre-battle cohorts (input to `extractCohortHpSnapshot`),
 * the post-battle cohorts (output of `extractCohortHpSnapshot`), and the
 * unit-loss ratio (player units killed / deployed across the whole faction,
 * including allies). Returns a final cohort roster where each non-OoA cohort
 * has its HP loss reduced by `min(rawLoss, maxHp × VICTORY_CAP_RATIO ×
 * unitLossRatio)`.
 *
 * Behavior:
 *   - **Crushing win** (unitLossRatio = 0): every cohort's loss is absorbed,
 *     HP restored to its pre-battle value.
 *   - **Pyrrhic win** (unitLossRatio = 1): cap binds at `0.5 × maxHp`; cohorts
 *     never lose more than half their max in a single battle.
 *   - **Out-of-action cohorts** (R-8): the cap does NOT rescue them. A 0-HP
 *     cohort that triggered `outOfAction` in `extractCohortHpSnapshot` stays
 *     at 1 HP outOfAction. Only fractional damage is softened.
 *   - **Cohorts that didn't take damage**: passed through unchanged with
 *     reference stability preserved.
 *
 * Caller responsibilities (`src/main.tsx`):
 *   1. Run `extractCohortHpSnapshot` first → raw post-battle cohorts
 *   2. Compute `unitLossRatio` from `BattleState.getBattleFactionUnits('blue')`
 *   3. Call this function ONLY on victory outcomes
 *   4. Stash result in `lastVictoryCapSummary` for S26-08
 */
export function applyVictoryCap(
  preBattle: readonly Cohort[],
  postBattle: readonly Cohort[],
  unitLossRatio: number,
): VictoryCapResult {
  const clampedRatio = Math.max(0, Math.min(1, unitLossRatio));
  const lossFactor = VICTORY_CAP_RATIO * clampedRatio;

  // Build pre-battle lookup so cap math is correct even if the post-battle
  // ordering ever diverges from the pre-battle ordering (it shouldn't today,
  // but the helper stays robust against future write-back changes).
  const preByInstance = new Map<string, Cohort>();
  for (const c of preBattle) {
    if (c.instanceId !== undefined) preByInstance.set(c.instanceId, c);
  }

  const absorbedPerCohort: VictoryCapAbsorption[] = [];
  let totalAbsorbedHp = 0;

  const cohorts = postBattle.map((post) => {
    if (post.outOfAction) return post; // R-8: cap never overrides OoA
    if (post.instanceId === undefined) return post;

    const pre = preByInstance.get(post.instanceId);
    if (!pre) return post;

    const maxHp = post.stats.hp;
    const preHp = pre.currentHp ?? maxHp;
    const postHp = post.currentHp ?? maxHp;
    const rawLoss = Math.max(0, preHp - postHp);
    if (rawLoss === 0) return post;

    const maxAllowedLoss = Math.floor(maxHp * lossFactor);
    const cappedLoss = Math.min(rawLoss, maxAllowedLoss);
    const absorbed = rawLoss - cappedLoss;
    if (absorbed === 0) return post;

    totalAbsorbedHp += absorbed;
    absorbedPerCohort.push({
      cohortInstanceId: post.instanceId,
      cohortName: post.name,
      rawLoss,
      cappedLoss,
      absorbedHp: absorbed,
    });

    const finalHp = preHp - cappedLoss;
    return applyCohortState(post, finalHp, false);
  });

  return {
    cohorts,
    absorbedPerCohort,
    totalAbsorbedHp,
    unitLossRatio: clampedRatio,
  };
}

/**
 * Build the next cohort shape, preserving the reference when nothing changed.
 * Strips `currentHp` when at max (FT-SUP convention: undefined = full health)
 * and strips `outOfAction` when false (only set when truly OoA).
 */
function applyCohortState(
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
