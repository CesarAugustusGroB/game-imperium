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
//
// ──────────────────────────────────────────────────────────────────────────
// S35-08: Bellum Resource Tension — balance memo
// ──────────────────────────────────────────────────────────────────────────
// Single landing pad for every magic number the S35 sprint introduced.
// All values are starting points; revise based on playthrough feel.
//
// Sprint goals these numbers serve:
//   - Each move feels like a real tactical decision, not just step + repeat.
//   - Morale bleeds slowly so camps and rest events have actual value.
//   - Gold, momentum, iuniores all matter MID-CAMPAIGN, not just post-run.
//   - Combat is rarely the only option — silver and momentum buy alternatives.
//
// LEVERS
//
//   Movement budget per season (this file)
//     CAMPAIGN_MOVEMENT_POINTS_MAX — currently 6.
//     ↓ tighter season pacing if seasons feel too long.
//     ↑ if 6 moves still feels rushed once events get denser.
//
//   Total campaign length (src/config/game-config.ts → SEASON.max)
//     Currently 24. Total Bellum moves ≈ 144 (was 72 pre-S35).
//     If a full run feels too long, halve to 12 — keeps total moves near pre-S35.
//
//   March fatigue per non-camp move (this file → getMarchFatigueDelta)
//     Plains/forest/hills/river: -1, ruins: -2, camp/road: 0.
//     ↑ magnitudes if morale curve stays too high through midgame.
//     ↓ if the player is forced to camp every other move just to break even.
//
//   Camp recovery (this file → getMoraleDelta('camp'))
//     +5 morale per camp traversal, plus +20 from "Make Camp" action,
//     plus +3 from "Tend the Wounded" iuniores spend (S35-04).
//     ↓ +20 if camps feel too forgiving.
//     ↑ if the S35-03 fatigue bleed outpaces camp recovery in long runs.
//
//   Camp replenishment cost (src/game/army/army-replenishment.ts)
//     1000 iuniores fully heals any one cohort (cost scales with missing HP).
//     Sequential cheapest-first allocation — change to per-cohort caps if
//     elite cohorts dominate the early heal queue.
//
//   Combat resource branches (src/game/campaign/encounter-effects-data.ts)
//     battle "Bribe Scouts": 30 gold + 2 morale loss to skip the fight.
//       ↑ gold cost if bribing becomes auto-pick over fighting.
//       ↓ if the player can never afford it in early game.
//     elite_battle "Press the Advantage": 1 momentum, grants high_ground.
//       Tune by changing the SpokeEffect modifierId, not the cost (1
//       momentum is the smallest non-zero spend; cheaper would be free).
//
//   Merchant trade (src/game/campaign/encounter-effects-data.ts)
//     -10 gold for +5 supplies. Untouched by S35 balance pass on purpose —
//     the historic ratio is a known-good baseline.
//
//   Morale warning threshold (src/game/campaign/campaign-defeat.ts)
//     BELLUM_MORALE_WARNING_THRESHOLD = 20.
//     The S35-06 chip pulse and the WarningBanner both fire at this value.
//     Defeat at morale ≤ 0 is hard-coded — not a tuning lever.
//
// PLAYTHROUGH HOOKS — what to watch for
//
//   1. Average morale at end of run should land 30–50 (not 90+, not 5–).
//   2. Supplies bottleneck should bite 1–2 times per run, never permanently.
//   3. Iuniores recruit cadence: ~one cohort heal every 2–3 camps.
//   4. Bribe-scouts and press-the-advantage should each be picked by an
//      experienced player roughly 1–2 times per run, not every encounter.
//   5. The 6-moves-per-season rhythm should feel like a real season —
//      enough room for a battle, a forage, a camp, and a wandering choice.
//
// All numbers above are starting points. Edit in place when playthrough
// data lands; this comment block is the single source of truth so future
// tuning doesn't have to grep across encounter-effects-data, bellum-army-view,
// army-replenishment, and game-config to figure out what changed.
// ──────────────────────────────────────────────────────────────────────────

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
