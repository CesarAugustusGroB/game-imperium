import type { Hex } from './hex';
import type { BattleFaction } from './battle-types';

export interface ZoneBounds {
  campEnd: number;     // last camp column/row (inclusive)
  reserveEnd: number;  // last reserve column/row (inclusive)
  // center = reserveEnd+1 to midfield
}

// ── Horizontal zones (column-based, default) ──

export function getZones(cols: number, faction: BattleFaction): ZoneBounds {
  const campCols = Math.round(cols * 0.2);     // 4 cols
  const reserveCols = Math.round(cols * 0.15);  // 3 cols
  if (faction === 'blue') {
    return { campEnd: campCols - 1, reserveEnd: campCols + reserveCols - 1 };
  } else {
    return {
      campEnd: cols - campCols,        // col 16 (cols 16-19 = camp)
      reserveEnd: cols - campCols - reserveCols, // col 13 (cols 13-15 = reserve)
    };
  }
}

/** Check if an offset column is in the camp zone. */
export function isInCamp(col: number, zones: ZoneBounds, faction: BattleFaction): boolean {
  return faction === 'blue' ? col <= zones.campEnd : col >= zones.campEnd;
}

/** Check if an offset column is in the reserve zone (or deeper). */
export function isInReserveOrDeeper(col: number, zones: ZoneBounds, faction: BattleFaction): boolean {
  return faction === 'blue' ? col <= zones.reserveEnd : col >= zones.reserveEnd;
}

/** Convert axial hex to approximate offset column. */
export function hexToCol(hex: Hex): number {
  return hex.q + Math.floor(hex.r / 2);
}

// ── Vertical zones (row-based) ──

export function getVerticalZones(rows: number, faction: BattleFaction): ZoneBounds {
  const campRows = Math.round(rows * 0.2);
  const reserveRows = Math.round(rows * 0.15);
  if (faction === 'blue') {
    // Blue camp = bottom (high r)
    return {
      campEnd: rows - campRows,
      reserveEnd: rows - campRows - reserveRows,
    };
  } else {
    // Red camp = top (low r)
    return {
      campEnd: campRows - 1,
      reserveEnd: campRows + reserveRows - 1,
    };
  }
}

/** Check if a row is in the camp zone (vertical). */
export function isInCampVertical(row: number, zones: ZoneBounds, faction: BattleFaction): boolean {
  return faction === 'blue' ? row >= zones.campEnd : row <= zones.campEnd;
}

/** Check if a row is in the reserve zone or deeper (vertical). */
export function isInReserveOrDeeperVertical(row: number, zones: ZoneBounds, faction: BattleFaction): boolean {
  return faction === 'blue' ? row >= zones.reserveEnd : row <= zones.reserveEnd;
}
