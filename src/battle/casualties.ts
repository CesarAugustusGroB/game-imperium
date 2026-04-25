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

import type { BattleUnit } from './battle-types';
import type { Cohort } from '../game/army/cohort';

/** Surviving HP > 0 and not in death animation. */
function isAlive(unit: BattleUnit): boolean {
  return !unit.isDying && unit.currentHp > 0;
}

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
