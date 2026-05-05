// S33-05: Bridge layer between Bellum's per-tile traversal and the canonical
// army systems (`army/supplies.ts`, `army/morale.ts`). This module is the
// single entry point for Bellum-side supply/morale mutations — all callers
// that previously touched `campaignState.supplies/morale` now go through here.
//
// Source-of-truth decisions:
//  - Supplies  → `preparedArmy.supplies` (clamped [0, SUPPLY_MAX_CARRY])
//  - Morale    → `computeArmyMorale(bellumSpokeView).total/.tier`
//               Events accumulate on `preparedArmy.campaignMoraleDelta`,
//               consumed by `campaignEffectsContributor` in `army/morale.ts`.

import { preparedArmy, preparedLegate } from '../progression/strategic-store';
import type { Spoke } from '../progression/spoke';
import { computeArmyMorale, NEUTRAL_MORALE, type MoraleResult } from '../army/morale';
import { consumeTraversal, type TraversalAttritionLog } from '../army/supplies';
import { computeArmySize } from '../army/cohort';
import { SUPPLY_MAX_CARRY } from '../../config/game-config';
import { getMoraleDelta, getMarchFatigueDelta } from './campaign-balance';
import type { TerrainType } from './campaign-types';
import { HEX_ENCOUNTER_LABEL } from './hex-battle';

/**
 * Spoke-shaped view over the active Bellum legion. Used purely as input to
 * `computeArmyMorale` and other spoke-aware helpers — no nodes, no posture.
 * Returns null when there is no preparedArmy.
 */
export function getBellumSpokeView(): Spoke | null {
  const army = preparedArmy.value;
  if (!army) return null;
  return {
    nodes: [],
    label: HEX_ENCOUNTER_LABEL,
    completed: false,
    duration: 1,
    currentSeason: 1,
    posture: 'attacking',
    boundArmy: army,
    boundLegate: preparedLegate.value,
  };
}

/** Wraps `computeArmyMorale` against the synthesized Bellum view. Returns
 *  NEUTRAL_MORALE when no army is present. */
export function computeBellumMorale(): MoraleResult {
  const view = getBellumSpokeView();
  if (!view) return NEUTRAL_MORALE;
  return computeArmyMorale(view);
}

/** Clamped supplies delta against `preparedArmy.supplies`. No-op when there is
 *  no army. */
export function addArmySupplies(delta: number): void {
  const army = preparedArmy.value;
  if (!army) return;
  const next = Math.max(0, Math.min(SUPPLY_MAX_CARRY, army.supplies + delta));
  preparedArmy.value = { ...army, supplies: next };
}

/** Signed morale delta accumulated on `preparedArmy.campaignMoraleDelta`.
 *  Consumed by `campaignEffectsContributor`. No-op when no army. */
export function addCampaignMorale(delta: number): void {
  const army = preparedArmy.value;
  if (!army) return;
  const prev = army.campaignMoraleDelta ?? 0;
  preparedArmy.value = { ...army, campaignMoraleDelta: prev + delta };
}

export type BellumTraversalResult = {
  supplyLog: TraversalAttritionLog | null;
  starvationTriggered: boolean;
  terrainMoraleDelta: number;
  /** S35-03: passive per-step morale bleed from non-camp/road traversal. */
  marchFatigueDelta: number;
};

/**
 * Execute one Bellum-tile traversal:
 *  - Consume supplies (1 × cohortCount) + apply HP attrition / supply morale
 *    penalty via `consumeTraversal`.
 *  - Apply per-terrain morale shift AND march-fatigue bleed (S35-03) to
 *    `preparedArmy.campaignMoraleDelta`. Both deltas accumulate into the
 *    same campaign-events bucket; the return type carries them split so
 *    HUD callers can attribute each contribution if they want to.
 * Returns the supply log (null when no army or no cohorts), a starvation
 * flag (true when this traversal had a deficit), and the morale deltas.
 */
export function consumeBellumTraversal(terrain: TerrainType): BellumTraversalResult {
  const army = preparedArmy.value;
  const terrainDelta = getMoraleDelta(terrain);
  const fatigueDelta = getMarchFatigueDelta(terrain);

  if (!army || army.cohorts.length === 0) {
    // Still apply morale even if there are no cohorts — there's an army
    // record (just empty); morale events are part of the world.
    if (army) {
      const total = terrainDelta + fatigueDelta;
      if (total !== 0) addCampaignMorale(total);
    }
    return {
      supplyLog: null,
      starvationTriggered: false,
      terrainMoraleDelta: army ? terrainDelta : 0,
      marchFatigueDelta: army ? fatigueDelta : 0,
    };
  }
  const { army: nextArmy, log } = consumeTraversal(army);
  preparedArmy.value = { ...nextArmy, size: computeArmySize(nextArmy.cohorts) };
  const total = terrainDelta + fatigueDelta;
  if (total !== 0) addCampaignMorale(total);
  return {
    supplyLog: log,
    starvationTriggered: log.supplyDeficit > 0,
    terrainMoraleDelta: terrainDelta,
    marchFatigueDelta: fatigueDelta,
  };
}
