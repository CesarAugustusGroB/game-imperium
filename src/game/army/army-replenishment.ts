/**
 * army-replenishment — iuniores-powered rest-node army HP recovery (S25-04 / FT-IUN).
 *
 * Pure-logic companion to `supplies.ts`. Given an army's cohort roster and
 * the current iuniores pool, `previewReplenishment` computes:
 *
 *  - Per-cohort iuniores cost to fully heal (formula: round(missingHp × 1000 / maxHp))
 *  - Sequential-fill distribution when the pool is insufficient: each damaged
 *    cohort in roster order receives up to its full-heal cost until the pool
 *    is empty. The last cohort to be funded may be partially healed.
 *  - The next cohort roster with updated `currentHp` values.
 *
 * The 1000-iuniores-fully-heals-any-cohort invariant means elite cohorts with
 * larger maxHp are MORE efficient to heal per iuniores spent (a 2000-HP Triarii
 * at 50% heals for 500 iuniores, same as a 1000-HP Militia at 50%).
 *
 * Cohort destruction (R-3 from FT-IUN): cohorts at 0 HP are removed upstream
 * by the battle layer and by `supplies.consumeTraversal` before the player
 * can reach a rest node. This module sees only survivors. No revive-from-dead
 * and no iuniores refund on death — veterans went home.
 *
 * The preview function is PURE — S25-08's UI will call it as a dry-run. The
 * commit function `replenishBoundArmy` is side-effecting: it spends iuniores
 * from the pool, mutates `currentSpoke.boundArmy.cohorts`, and updates the
 * `lastReplenishmentSummary` signal that the rest modal reads.
 */

import { signal } from '@preact/signals';
import type { Cohort } from './cohort';
import type { ArmyData } from '../../types/index';
import { computeArmySize } from './cohort';
import { iuniores, spendResource } from '../core/resources';
import { currentSpoke } from '../progression/spoke';

export interface CohortReplenishment {
  cohortId: string;
  cohortName: string;
  maxHp: number;
  currentHp: number;
  missingHp: number;
  /** Iuniores required to fully restore this cohort. */
  iunioresToFullHeal: number;
  /** Iuniores actually spent on this cohort under the current allocation. */
  iunioresSpent: number;
  /** HP actually restored. */
  hpRestored: number;
  /** New currentHp after the replenishment (may be < maxHp on partial heal). */
  newCurrentHp: number;
}

export interface ReplenishmentPreview {
  perCohort: CohortReplenishment[];
  /** Sum of per-cohort full-heal costs before any allocation. */
  totalIunioresNeeded: number;
  /** Snapshot of the pool at the time of preview. */
  iunioresAvailable: number;
  /** Total iuniores actually spent (≤ iunioresAvailable and ≤ totalIunioresNeeded). */
  iunioresSpent: number;
  /** Total HP restored across all cohorts. */
  hpRestored: number;
  /** True when iunioresAvailable < totalIunioresNeeded. */
  partialHeal: boolean;
  /** New cohort roster with updated currentHp. Never drops cohorts. */
  nextCohorts: Cohort[];
}

/**
 * Compute the replenishment outcome for a given cohort roster and pool size.
 * PURE — does not spend iuniores, does not mutate inputs. Safe to call from
 * S25-08's preview UI on every render.
 *
 * Formula (per cohort):
 *   maxHp       = cohort.stats.hp
 *   currentHp   = cohort.currentHp ?? maxHp
 *   missingHp   = maxHp - currentHp
 *   fullCost    = round(missingHp × 1000 / maxHp)
 *
 * Distribution: sequential fill in roster order. Each cohort drains up to
 * `fullCost` iuniores from the remaining pool; the last funded cohort may
 * be partially healed if the pool runs short. HP restored for a cohort
 * given `spent` iuniores:
 *
 *   hpRestored = min(missingHp, floor(spent × maxHp / 1000))
 *
 * The `min(missingHp, ...)` cap prevents over-heal from rounding artifacts.
 */
export function previewReplenishment(
  cohorts: readonly Cohort[],
  poolAvailable: number,
): ReplenishmentPreview {
  const perCohort: CohortReplenishment[] = [];
  let totalIunioresNeeded = 0;
  let iunioresSpent = 0;
  let hpRestored = 0;
  let poolRemaining = Math.max(0, poolAvailable);
  const nextCohorts: Cohort[] = [];

  for (const c of cohorts) {
    const maxHp = c.stats.hp;
    const currentHp = c.currentHp ?? maxHp;
    const missingHp = Math.max(0, maxHp - currentHp);

    // Formula: 1000 iuniores fully heal any cohort. Round to nearest.
    const fullCost = missingHp > 0 ? Math.round((missingHp * 1000) / maxHp) : 0;
    totalIunioresNeeded += fullCost;

    const spend = Math.min(fullCost, poolRemaining);
    poolRemaining -= spend;

    // Inverse formula for partial-heal HP restoration, capped at missingHp.
    const healed = spend > 0
      ? Math.min(missingHp, Math.floor((spend * maxHp) / 1000))
      : 0;
    const newCurrentHp = currentHp + healed;

    iunioresSpent += spend;
    hpRestored += healed;

    perCohort.push({
      cohortId: c.id,
      cohortName: c.name,
      maxHp,
      currentHp,
      missingHp,
      iunioresToFullHeal: fullCost,
      iunioresSpent: spend,
      hpRestored: healed,
      newCurrentHp,
    });

    // Only attach currentHp if it differs from maxHp (supplies.ts convention:
    // undefined means full health).
    if (newCurrentHp < maxHp) {
      nextCohorts.push({ ...c, currentHp: newCurrentHp });
    } else {
      const { currentHp: _unused, ...rest } = c;
      void _unused;
      nextCohorts.push(rest);
    }
  }

  return {
    perCohort,
    totalIunioresNeeded,
    iunioresAvailable: Math.max(0, poolAvailable),
    iunioresSpent,
    hpRestored,
    partialHeal: iunioresSpent < totalIunioresNeeded,
    nextCohorts,
  };
}

/**
 * The last replenishment outcome. Set by `replenishBoundArmy`. S25-08's
 * rest-modal UI reads this to render the per-cohort summary. Reset to null
 * at spoke end (handled by strategic-store.resetStrategicSpoke / resetSpoke).
 */
export const lastReplenishmentSummary = signal<ReplenishmentPreview | null>(null);

/**
 * Commit a replenishment on the currently-bound army (the army traversing
 * the active spoke). Reads `currentSpoke.value.boundArmy` and the current
 * `iuniores.value`, computes the preview, spends iuniores, and writes back
 * the updated army.
 *
 * Returns the summary and stores it in `lastReplenishmentSummary`. Returns
 * null (and stores null) if there is no active spoke, no bound army, or no
 * cohorts to heal.
 *
 * Called by `NodeMapScreen.openRestModal()` when the player lands on a
 * rest node. S25-08 will add a preview-before-commit gate on top.
 */
export function replenishBoundArmy(): ReplenishmentPreview | null {
  const spoke = currentSpoke.value;
  if (!spoke) { lastReplenishmentSummary.value = null; return null; }
  const army = spoke.boundArmy;
  if (!army || army.cohorts.length === 0) {
    lastReplenishmentSummary.value = null;
    return null;
  }

  const preview = previewReplenishment(army.cohorts, iuniores.value);

  // No-op: nothing to heal — don't touch pool or signal.
  if (preview.iunioresSpent === 0) {
    lastReplenishmentSummary.value = preview;
    return preview;
  }

  // Guarded by preview.iunioresSpent ≤ iuniores.value, so spendResource succeeds.
  spendResource('iuniores', preview.iunioresSpent);

  const nextArmy: ArmyData = {
    ...army,
    cohorts: preview.nextCohorts,
    size: computeArmySize(preview.nextCohorts),  // maxHp-based, unchanged by healing but safe to recompute
  };
  currentSpoke.value = { ...spoke, boundArmy: nextArmy };

  lastReplenishmentSummary.value = preview;
  return preview;
}
