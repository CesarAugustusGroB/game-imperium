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

// One move = roughly two weeks of marching. Six moves = one season → season
// tick fires when movementPoints hits 0 (see PixiHexMap.applyMove handler).
// S35-01: bumped 3 → 6 to give the player room for tactical decisions
// (foraging, fighting, bribing, recruiting) inside a single season instead
// of every move being terminal. Total campaign length scales with SEASON.max
// in src/config/game-config.ts; total moves now ~144 vs the old 72 — the
// S35-08 balance pass tunes whether SEASON.max should drop to compensate.
export const CAMPAIGN_MOVEMENT_POINTS_MAX = 6;

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
