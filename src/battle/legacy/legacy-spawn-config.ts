/**
 * @deprecated V1 battlefield spawn constants — used only by
 * `legacy-cohort-mapping.ts` and the legacy entry path. BattleV2 uses
 * `src/battle/deployment.ts` (central-spawn formation) instead.
 *
 * These define the fixed col/row slots on the 20×14 horizontal grid where
 * each role of each faction's cohorts was placed. Do not add new callers.
 */

// ── Blue slots (horizontal V1 grid) ──
export const BLUE_VANGUARD_ROWS = [1, 3, 5, 7, 9, 11];
export const BLUE_VANGUARD_COL = 6;
export const BLUE_RESERVE_ROWS = [4, 10];
export const BLUE_RESERVE_COL = 4;
export const BLUE_GUARD_ROWS = [5, 9];
export const BLUE_GUARD_COL = 1;

// ── Red slots (horizontal V1 grid) ──
export const RED_VANGUARD_ROWS = [1, 3, 5, 7, 9, 11];
export const RED_VANGUARD_COL = 13;
export const RED_RESERVE_ROWS = [4, 10];
export const RED_RESERVE_COL = 15;
export const RED_GUARD_ROWS = [5, 9];
export const RED_GUARD_COL = 18;

// ── Overflow (S15-04: extended red capacity from 10 to 18) ──
export const RED_VANGUARD_ROWS_2 = [2, 4, 6, 8, 10, 12];
export const RED_VANGUARD_COL_2 = 14;
export const RED_RESERVE_ROWS_2 = [5, 9];
export const RED_RESERVE_COL_2 = 16;
