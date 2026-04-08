import type { Hex } from './hex';
import type { BattleFaction } from './battle-types';

export interface ZoneBounds {
  campEnd: number;     // last camp column (inclusive)
  reserveEnd: number;  // last reserve column (inclusive)
  // center = reserveEnd+1 to midfield
}

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
