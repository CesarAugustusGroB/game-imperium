// S31-03: single-file tunables for campaign-map per-move costs.
// All deltas live here so balance passes don't need to chase logic across
// HexMapView and campaign-state.

import type { EventType, TerrainType } from './campaign-types';

export const SUPPLIES_MAX = 99;
export const MORALE_MAX = 100;
export const SUPPLY_COST_BASE = 1;
export const STARVATION_MORALE_PENALTY = 10;

export function getSupplyCost(terrain: TerrainType): number {
  if (terrain === 'road') return 0;
  if (terrain === 'river') return SUPPLY_COST_BASE + 1;
  return SUPPLY_COST_BASE;
}

export function getMoraleDelta(terrain: TerrainType, event: EventType): number {
  let delta = 0;

  if (terrain === 'camp') delta += 5;
  else if (terrain === 'ruins') delta -= 2;
  else if (terrain === 'mountains') delta -= 3;
  else if (terrain === 'road') delta += 1;

  if (event === 'rest') delta += 5;
  else if (event === 'ambush') delta -= 8;
  else if (event === 'story') delta += 2;

  return delta;
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
  event: EventType,
): MoveOutcome {
  const supplyCost = getSupplyCost(terrain);
  const supplies = clamp(prev.supplies - supplyCost, 0, SUPPLIES_MAX);

  const starvationTriggered = prev.supplies > 0 && supplies === 0;

  const moraleDelta =
    getMoraleDelta(terrain, event) -
    (starvationTriggered ? STARVATION_MORALE_PENALTY : 0);

  const morale = clamp(prev.morale + moraleDelta, 0, MORALE_MAX);

  return { supplies, morale, starvationTriggered };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
