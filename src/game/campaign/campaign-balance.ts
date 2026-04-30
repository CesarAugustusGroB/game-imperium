// S31-03: single-file tunables for campaign-map per-move costs.
// All deltas live here so balance passes don't need to chase logic across
// HexMapView and campaign-state.

import type { TerrainType } from './campaign-types';

export const SUPPLIES_MAX = 99;
export const MORALE_MAX = 100;
export const CAMPAIGN_MOVEMENT_POINTS_MAX = 2;
export const SUPPLY_COST_BASE = 1;
export const STARVATION_MORALE_PENALTY = 10;

export function getSupplyCost(terrain: TerrainType): number {
  if (terrain === 'road') return 0;
  if (terrain === 'river') return SUPPLY_COST_BASE + 1;
  return SUPPLY_COST_BASE;
}

/**
 * Per-step morale shift from the terrain alone. Event-driven morale (rest +,
 * ambush -, story +, …) lives in `encounter-bridge` (S31-05a) so each event
 * is paid for once at resolution time, not double-counted on tile entry +
 * encounter resolution.
 */
export function getMoraleDelta(terrain: TerrainType): number {
  if (terrain === 'camp') return 5;
  if (terrain === 'ruins') return -2;
  if (terrain === 'mountains') return -3;
  if (terrain === 'road') return 1;
  return 0;
}

export type MoveOutcome = {
  supplies: number;
  morale: number;
  starvationTriggered: boolean;
};

/**
 * Pure helper — given a (supplies, morale) pair and the tile being entered,
 * returns the post-move pair plus a one-shot starvation flag. Starvation fires
 * only on the transition from positive supplies to 0; subsequent moves at 0
 * supplies pay no further morale penalty (otherwise morale would tank in two
 * moves and the warning notification would spam).
 */
export function applyMoveDeltas(
  prev: { supplies: number; morale: number },
  terrain: TerrainType,
): MoveOutcome {
  const supplyCost = getSupplyCost(terrain);
  const supplies = clamp(prev.supplies - supplyCost, 0, SUPPLIES_MAX);

  const starvationTriggered = prev.supplies > 0 && supplies === 0;

  const moraleDelta =
    getMoraleDelta(terrain) -
    (starvationTriggered ? STARVATION_MORALE_PENALTY : 0);

  const morale = clamp(prev.morale + moraleDelta, 0, MORALE_MAX);

  return { supplies, morale, starvationTriggered };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
