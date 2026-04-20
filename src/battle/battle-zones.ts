import type { Hex } from './hex';
import type { BattleFaction } from './battle-types';

/**
 * 3×3 battlefield zones — purely geometric, faction-relative.
 *
 *   Depth (along advance axis):  back → middle → front
 *   Lane  (along flank axis):    left → center → right
 *
 * A faction's own deployment zone is `back`. The enemy deployment zone is
 * `front`. Lanes mirror per faction so each faction's `left` is on their own
 * left side. Zones are independent of unit roles — use them for deployment,
 * flanking checks, and coarse AI heuristics, not for role-specific logic.
 */

export type DepthBand = 'back' | 'middle' | 'front';
export type LaneBand = 'left' | 'center' | 'right';

export interface ZoneCoord {
  depth: DepthBand;
  lane: LaneBand;
}

/** Fraction of the axis claimed by each outer band (back/front, or left/right). */
const OUTER_BAND_FRAC = 0.3;

/** Start/end (inclusive/exclusive) of each band along an axis. */
export interface AxisBands {
  low:  { start: number; end: number };
  mid:  { start: number; end: number };
  high: { start: number; end: number };
}

export function getAxisBands(axisLen: number): AxisBands {
  const lowEnd = Math.round(axisLen * OUTER_BAND_FRAC);
  const highStart = axisLen - Math.round(axisLen * OUTER_BAND_FRAC);
  return {
    low:  { start: 0,         end: lowEnd },
    mid:  { start: lowEnd,    end: highStart },
    high: { start: highStart, end: axisLen },
  };
}

function bandIndex(pos: number, axisLen: number): 0 | 1 | 2 {
  const b = getAxisBands(axisLen);
  if (pos < b.low.end) return 0;
  if (pos >= b.high.start) return 2;
  return 1;
}

// ── Hex → offset projections ──

/** Offset column (pointy-top even-r) — horizontal advance axis. */
export function hexToCol(hex: Hex): number {
  return hex.q + Math.floor(hex.r / 2);
}

/** Offset row (flat-top even-q) — vertical advance axis. */
export function hexToFlatRow(hex: Hex): number {
  return hex.r + Math.floor(hex.q / 2);
}

interface AxisProjection {
  advance: number;
  flank: number;
  advanceLen: number;
  flankLen: number;
}

function project(hex: Hex, cols: number, rows: number, vertical: boolean): AxisProjection {
  if (vertical) {
    return { advance: hexToFlatRow(hex), flank: hex.q, advanceLen: rows, flankLen: cols };
  }
  return { advance: hexToCol(hex), flank: hex.r, advanceLen: cols, flankLen: rows };
}

// ── Classification ──

/** Classify a hex into (depth, lane) from a given faction's perspective. */
export function classifyZone(
  hex: Hex, cols: number, rows: number, faction: BattleFaction, vertical: boolean,
): ZoneCoord {
  const p = project(hex, cols, rows, vertical);
  const di = bandIndex(p.advance, p.advanceLen);
  const li = bandIndex(p.flank, p.flankLen);

  // Which end of the advance axis is this faction's own back?
  //   Horizontal: blue sits at low-col (left), red at high-col (right).
  //   Vertical:   red sits at low-row (top),  blue at high-row (bottom).
  const ownsLowEnd = vertical ? faction === 'red' : faction === 'blue';
  const depth: DepthBand = ownsLowEnd
    ? (di === 0 ? 'back'  : di === 2 ? 'front' : 'middle')
    : (di === 0 ? 'front' : di === 2 ? 'back'  : 'middle');

  // Lanes mirror on red so each faction's "left" is on their own left.
  const lane: LaneBand = faction === 'red'
    ? (li === 0 ? 'right' : li === 2 ? 'left'  : 'center')
    : (li === 0 ? 'left'  : li === 2 ? 'right' : 'center');

  return { depth, lane };
}

/** Depth band of a hex from a faction's perspective. */
export function depthOf(
  hex: Hex, cols: number, rows: number, faction: BattleFaction, vertical: boolean,
): DepthBand {
  return classifyZone(hex, cols, rows, faction, vertical).depth;
}

/** Lane band of a hex from a faction's perspective. */
export function laneOf(
  hex: Hex, cols: number, rows: number, faction: BattleFaction, vertical: boolean,
): LaneBand {
  return classifyZone(hex, cols, rows, faction, vertical).lane;
}

/** True if the hex is in the faction's own deployment zone (back band). */
export function isInDeploymentZone(
  hex: Hex, cols: number, rows: number, faction: BattleFaction, vertical: boolean,
): boolean {
  return depthOf(hex, cols, rows, faction, vertical) === 'back';
}

/** True if the hex is in the enemy deployment zone (faction's front band). */
export function isInEnemyDeploymentZone(
  hex: Hex, cols: number, rows: number, faction: BattleFaction, vertical: boolean,
): boolean {
  return depthOf(hex, cols, rows, faction, vertical) === 'front';
}

/** True if the hex is on one of the faction's flanks (left or right lane). */
export function isOnFlank(
  hex: Hex, cols: number, rows: number, faction: BattleFaction, vertical: boolean,
): boolean {
  const l = laneOf(hex, cols, rows, faction, vertical);
  return l === 'left' || l === 'right';
}
