// S31-03: tunables for the Bellum campaign-map movement economy.
//
// Supply consumption and HP attrition now live in `army/supplies.ts`
// (`consumeTraversal`). This file is intentionally narrow: per-terrain
// morale shifts applied to `preparedArmy.campaignMoraleDelta` and the
// movement-point budget constant.
//
// S33-05: `applyMoveDeltas`, `getSupplyCost`, `STARVATION_MORALE_PENALTY`,
// `SUPPLIES_MAX`, and `MORALE_MAX` were removed. Supply/HP attrition is now
// handled by `consumeTraversal` in `army/supplies.ts`; callers use
// `consumeBellumTraversal` from `bellum-army-view.ts`.

import type { TerrainType } from './campaign-types';

// One move = one month. Three months = one season → season tick fires
// when movementPoints hits 0 (see PixiHexMap.applyMove handler).
export const CAMPAIGN_MOVEMENT_POINTS_MAX = 3;

/**
 * Per-step morale shift from the terrain alone. Event-driven morale (rest +,
 * ambush -, story +, …) lives in `encounter-bridge` (S31-05a) so each event
 * is paid for once at resolution time, not double-counted on tile entry +
 * encounter resolution.
 *
 * Applied to `preparedArmy.campaignMoraleDelta` by `consumeBellumTraversal`.
 */
export function getMoraleDelta(terrain: TerrainType): number {
  if (terrain === 'camp') return 5;
  if (terrain === 'ruins') return -2;
  if (terrain === 'mountains') return -3;
  if (terrain === 'road') return 1;
  return 0;
}

/**
 * S35-03: passive march fatigue. Every move that isn't on a camp or a road
 * bleeds morale a little — the legion grinds itself down between rest stops.
 * Stacks with `getMoraleDelta` (terrain shift) inside `consumeBellumTraversal`.
 *
 * Camp / road: 0 (no fatigue — these tiles are recovery surfaces)
 * Ruins:       -2 (a bad rest is worse than no rest)
 * Plains, forest, hills, river, mountains: -1 (steady drift)
 *
 * Mountains are pathfinding-impassable (`getMovementCost` = 999), so the
 * mountain branch never fires today — kept symmetric in case a future
 * ticket allows mountain crossings.
 *
 * Final values land in S35-08's playthrough pass.
 */
export function getMarchFatigueDelta(terrain: TerrainType): number {
  if (terrain === 'camp' || terrain === 'road') return 0;
  if (terrain === 'ruins') return -2;
  return -1;
}
