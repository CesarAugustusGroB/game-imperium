/**
 * supplies — spoke-layer supply stockpile & attrition (FT-SUP).
 *
 * Pure logic module. Given an `ArmyData` with a `supplies` stockpile and
 * a cohort roster, `consumeTraversal` computes the next army state after
 * one spoke node traversal:
 *
 *  - Consumes `1 supply × cohortCount`.
 *  - If fully supplied: clears `supplyMoralePenalty` and resets
 *    `supplyDeficitStreak` (instant morale recovery on resupply).
 *  - If under-supplied: each cohort loses `SUPPLY_HP_DAMAGE_PCT` of its
 *    max HP from `currentHp`; cohorts reaching 0 are removed from the
 *    roster. The morale penalty grows by `SUPPLY_MORALE_PENALTY_PER_DEFICIT`,
 *    capped at `SUPPLY_MORALE_PENALTY_CAP`.
 *
 * The function is pure — it never mutates the input — so Preact signal
 * consumers can compare references to detect change.
 */

import type { ArmyData, Cohort } from '../../types/index';
import { computeArmySize } from './cohort';
import {
  SUPPLY_HP_DAMAGE_PCT,
  SUPPLY_MORALE_PENALTY_PER_DEFICIT,
  SUPPLY_MORALE_PENALTY_CAP,
} from '../../config/game-config';

export interface TraversalAttritionLog {
  /** How many supplies short the army was this traversal. 0 = fully supplied. */
  supplyDeficit: number;
  /** Fraction of max HP each cohort lost this traversal. 0 if no damage. */
  hpDamagePerCohortPct: number;
  /** Absolute amount added to `supplyMoralePenalty` this traversal. */
  moralePenaltyDelta: number;
  /** Ids of cohorts whose currentHp hit 0 and were removed from the roster. */
  cohortsKilled: string[];
}

const ZERO_LOG: TraversalAttritionLog = {
  supplyDeficit: 0,
  hpDamagePerCohortPct: 0,
  moralePenaltyDelta: 0,
  cohortsKilled: [],
};

/**
 * Supplies needed to cover `nodesRemaining` full traversals of a given
 * cohort count. Used by the UI (EmbarkCard warning banner).
 */
export function supplyCostForNodes(cohortCount: number, nodesRemaining: number): number {
  if (cohortCount <= 0 || nodesRemaining <= 0) return 0;
  return cohortCount * nodesRemaining;
}

/**
 * Compute the next army state after one node traversal. Pure.
 */
export function consumeTraversal(
  army: ArmyData,
): { army: ArmyData; log: TraversalAttritionLog } {
  const cohortCount = army.cohorts.length;
  if (cohortCount === 0) {
    return { army, log: { ...ZERO_LOG } };
  }

  const need = cohortCount;
  const have = army.supplies;

  // ── Fully supplied: consume, clear penalty, reset streak ──
  if (have >= need) {
    const next: ArmyData = {
      ...army,
      supplies: have - need,
      supplyMoralePenalty: undefined,
      supplyDeficitStreak: 0,
    };
    return { army: next, log: { ...ZERO_LOG } };
  }

  // ── Under-supplied: apply per-cohort HP damage & morale penalty ──
  const deficit = need - have;
  const cohortsKilled: string[] = [];
  const nextCohorts: Cohort[] = [];
  for (const c of army.cohorts) {
    const maxHp = c.stats.hp;
    const current = c.currentHp ?? maxHp;
    const damage = Math.max(1, Math.floor(maxHp * SUPPLY_HP_DAMAGE_PCT));
    const after = current - damage;
    if (after <= 0) {
      cohortsKilled.push(c.id);
      continue;
    }
    nextCohorts.push({ ...c, currentHp: after });
  }

  const prevPenalty = army.supplyMoralePenalty ?? 0;
  const penaltyDelta = SUPPLY_MORALE_PENALTY_PER_DEFICIT;
  const nextPenalty = Math.min(
    SUPPLY_MORALE_PENALTY_CAP,
    prevPenalty + penaltyDelta,
  );

  const prevStreak = army.supplyDeficitStreak ?? 0;

  const next: ArmyData = {
    ...army,
    supplies: 0,
    cohorts: nextCohorts,
    size: computeArmySize(nextCohorts),
    supplyMoralePenalty: nextPenalty,
    supplyDeficitStreak: prevStreak + 1,
  };

  const log: TraversalAttritionLog = {
    supplyDeficit: deficit,
    hpDamagePerCohortPct: SUPPLY_HP_DAMAGE_PCT,
    moralePenaltyDelta: nextPenalty - prevPenalty,
    cohortsKilled,
  };
  return { army: next, log };
}
