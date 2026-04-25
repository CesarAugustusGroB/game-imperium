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
import { preparedArmy } from '../progression/strategic-store';

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

function getCohortCurrentHp(cohort: Cohort): number {
  if (cohort.currentHp !== undefined) return cohort.currentHp;
  if (cohort.outOfAction) return 1;
  return cohort.stats.hp;
}

function applyHealedState(cohort: Cohort, newCurrentHp: number): Cohort {
  const maxHp = cohort.stats.hp;
  const { currentHp: _currentHp, outOfAction: _outOfAction, ...rest } = cohort;
  void _currentHp;
  void _outOfAction;

  if (newCurrentHp >= maxHp) {
    return rest;
  }

  return {
    ...rest,
    currentHp: newCurrentHp,
  };
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
    const currentHp = getCohortCurrentHp(c);
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
    // undefined means full health). FT-HEAL extension: also normalize cohorts
    // that arrived at the rest node already at full HP but still carrying a
    // stale `currentHp = maxHp` field or a leftover `outOfAction` flag — those
    // are cleaned up here so downstream consumers see a canonical shape.
    const shouldNormalize = healed > 0 || (missingHp === 0 && (c.currentHp !== undefined || c.outOfAction));
    // Preserve reference for untouched cohorts so Preact memoization downstream
    // doesn't see a spurious change.
    nextCohorts.push(shouldNormalize ? applyHealedState(c, newCurrentHp) : c);
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
 * Hub-only citizen replenishment preview. Mercenaries are excluded from the
 * iuniores pass and remain unchanged in `nextCohorts`.
 */
export function previewHubReplenishment(
  cohorts: readonly Cohort[],
  iunioresAvailable: number,
): ReplenishmentPreview {
  const perCohort: CohortReplenishment[] = [];
  let totalIunioresNeeded = 0;
  let iunioresSpent = 0;
  let hpRestored = 0;
  let poolRemaining = Math.max(0, iunioresAvailable);
  // Shallow-copy the array but preserve cohort references; only touched
  // entries are replaced below. Mirrors the rest-node preview's no-op path.
  const nextCohorts: Cohort[] = cohorts.slice();
  const eligible = cohorts
    .map((cohort, index) => {
      if (cohort.mercenary) return null;
      const maxHp = cohort.stats.hp;
      const currentHp = getCohortCurrentHp(cohort);
      const missingHp = Math.max(0, maxHp - currentHp);
      if (missingHp <= 0) return null;
      return {
        cohort,
        index,
        maxHp,
        currentHp,
        missingHp,
        fullCost: Math.round((missingHp * 1000) / maxHp),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.fullCost - b.fullCost || a.index - b.index);

  for (const entry of eligible) {
    totalIunioresNeeded += entry.fullCost;

    const spend = Math.min(entry.fullCost, poolRemaining);
    poolRemaining -= spend;
    const healed = spend > 0
      ? Math.min(entry.missingHp, Math.floor((spend * entry.maxHp) / 1000))
      : 0;
    const newCurrentHp = entry.currentHp + healed;

    iunioresSpent += spend;
    hpRestored += healed;

    perCohort.push({
      cohortId: entry.cohort.id,
      cohortName: entry.cohort.name,
      maxHp: entry.maxHp,
      currentHp: entry.currentHp,
      missingHp: entry.missingHp,
      iunioresToFullHeal: entry.fullCost,
      iunioresSpent: spend,
      hpRestored: healed,
      newCurrentHp,
    });

    if (healed > 0) {
      nextCohorts[entry.index] = applyHealedState(entry.cohort, newCurrentHp);
    }
  }

  return {
    perCohort,
    totalIunioresNeeded,
    iunioresAvailable: Math.max(0, iunioresAvailable),
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

/**
 * Commit citizen-only replenishment against the persistent Hub roster
 * (`preparedArmy`). Mercenaries are skipped entirely; their gold-based pass
 * is deferred to S27.
 */
export function replenishHubRoster(): ReplenishmentPreview | null {
  const army = preparedArmy.value;
  if (!army || army.cohorts.length === 0) return null;

  const preview = previewHubReplenishment(army.cohorts, iuniores.value);
  if (preview.perCohort.length === 0) return preview;
  if (preview.iunioresSpent === 0) return preview;

  spendResource('iuniores', preview.iunioresSpent);
  preparedArmy.value = {
    ...army,
    cohorts: preview.nextCohorts,
    size: computeArmySize(preview.nextCohorts),
  };
  return preview;
}

/**
 * Heal a single cohort in the Hub roster, spending up to its full citizen
 * replenishment cost. If the pool is short, applies a partial heal.
 *
 * `cohortIdx` addresses `preparedArmy.cohorts` directly. Returns the per-cohort
 * replenishment summary on success (caller parity with `replenishHubRoster`),
 * or null when nothing was healed (out-of-bounds, mercenary, full HP, empty pool).
 *
 * NOTE: index-based addressing is fragile against roster reorders; once the
 * S26-01 `instanceId` lands on this branch, switch to instance-based lookup.
 */
export function healCohortInRoster(cohortIdx: number): CohortReplenishment | null {
  const army = preparedArmy.value;
  if (!army) return null;
  if (cohortIdx < 0 || cohortIdx >= army.cohorts.length) return null;

  const cohort = army.cohorts[cohortIdx];
  if (cohort.mercenary) return null;

  const maxHp = cohort.stats.hp;
  const currentHp = getCohortCurrentHp(cohort);
  const missingHp = Math.max(0, maxHp - currentHp);
  if (missingHp <= 0) return null;

  const fullCost = Math.round((missingHp * 1000) / maxHp);
  const spend = Math.min(fullCost, iuniores.value);
  if (spend <= 0) return null;

  const healed = Math.min(missingHp, Math.floor((spend * maxHp) / 1000));
  if (healed <= 0) return null;

  spendResource('iuniores', spend);

  const newCurrentHp = currentHp + healed;
  const nextCohorts = [...army.cohorts];
  nextCohorts[cohortIdx] = applyHealedState(cohort, newCurrentHp);
  preparedArmy.value = {
    ...army,
    cohorts: nextCohorts,
    size: computeArmySize(nextCohorts),
  };

  return {
    cohortId: cohort.id,
    cohortName: cohort.name,
    maxHp,
    currentHp,
    missingHp,
    iunioresToFullHeal: fullCost,
    iunioresSpent: spend,
    hpRestored: healed,
    newCurrentHp,
  };
}
