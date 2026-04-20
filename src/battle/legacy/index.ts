/**
 * @deprecated Legacy BattleV1 module.
 *
 * Everything exported from this barrel is scheduled for removal once BattleV2
 * (the 50×30 vertical battlefield + central-spawn deployment) has been
 * validated across all campaign paths.
 *
 * Current legacy callers:
 *   - `BattleMode.enter()` in `src/battle/index.ts` — only reached via direct
 *     import, no longer wired into screen routing.
 *   - `BattleState.placeFactionUnits()` — imports `mapArmyToBattleUnits` to
 *     place cohorts on the V1 horizontal grid when the legacy entry runs.
 *
 * No new code should import from this folder.
 */

export * from './legacy-spawn-config';
export * from './legacy-cohort-mapping';
