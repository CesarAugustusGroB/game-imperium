/**
 * LandmarkRoute (S29-06) — SVG segment renderer for the campaign map.
 *
 * Consumed by `LandmarkMap` via its `renderRoute(segment)` slot. The map's
 * SVG layer uses `viewBox="0 0 100 100"` with `preserveAspectRatio="none"`
 * so coordinates land on the right pixels regardless of map aspect ratio,
 * but stroke widths would scale with that distortion. We pin every stroke
 * with `vector-effect="non-scaling-stroke"` so the visual weight stays
 * consistent across viewport sizes.
 *
 * The map's SVG layer is `pointer-events: none` (set in `LandmarkMap`),
 * so the route layer never intercepts clicks meant for nodes.
 *
 * Treatments are derived from the destination node + its position relative
 * to `currentNodeIdx`. A single `<line>` is enough for MVP; no curved
 * paths until we have explicit route metadata to motivate them.
 */

import type { SpokeNode } from '../../../game/progression/spoke';
import type { SpokeEffect } from '../../../game/progression/spoke-effects';
import type { LandmarkMapRouteSegment } from './LandmarkMap';

export type LandmarkRouteState =
  | 'resolved'
  | 'current'
  | 'boss'
  | 'risky'
  | 'revealed'
  | 'reachable'
  | 'fogged';

export interface LandmarkRouteProps {
  segment: LandmarkMapRouteSegment;
  /** Current main-chain node index — drives reachability. */
  currentNodeIdx: number;
  /** Faction accent color from the active commander. */
  accent: string;
}

export function deriveRouteState(
  segment: LandmarkMapRouteSegment,
  currentNodeIdx: number,
): LandmarkRouteState {
  const { fromNode, toNode, toIndex } = segment;

  // Both endpoints already played → resolved trail.
  // T2.2: This also covers the spoke-complete state (nodeIdx >= nodes.length)
  // because every node will be resolved before completeSpoke() fires, so
  // all segments naturally fall into this branch. No special-case needed.
  if (fromNode.resolved && toNode.resolved) return 'resolved';

  // The boss path always wins over reachable so the player sees the climax
  // route distinctly even before they reach it.
  if (toNode.encounterType === 'boss' || toNode.type === 'boss') return 'boss';

  // Risky: scouted dangerous destination, or a known net-negative haul.
  if (isRiskyTarget(toNode)) return 'risky';

  // Active step (player → next): the live edge.
  if (toIndex === currentNodeIdx + 1 && !toNode.resolved) return 'current';

  // Reachable but not the immediate live edge — partially scouted target.
  const intel = toNode.scoutedLevel ?? (toNode.revealed === false ? 0 : 2);
  if (toIndex <= currentNodeIdx + 1 || (intel >= 1 && toIndex === currentNodeIdx + 2)) {
    return intel >= 2 ? 'reachable' : 'revealed';
  }

  // Beyond the visible horizon.
  return 'fogged';
}

function isRiskyTarget(node: SpokeNode): boolean {
  if (node.threatHint === 'deadly') return false; // boss tier handled separately
  if (node.threatHint === 'high') return true;
  if (!node.effects || node.effects.length === 0) return false;
  // A target is "risky" if it carries a meaningful negative payload across
  // morale / supplies / iuniores. Threat-up alone doesn't make a route red.
  let net = 0;
  for (const e of node.effects) {
    if (isResourceEffect(e)) net += e.delta;
  }
  return net <= -10;
}

function isResourceEffect(
  e: SpokeEffect,
): e is SpokeEffect & { type: 'morale' | 'supplies' | 'iuniores'; delta: number } {
  return e.type === 'morale' || e.type === 'supplies' || e.type === 'iuniores';
}

interface RouteStyle {
  stroke: string;
  width: number;
  dasharray: string | undefined;
  opacity: number;
  /** Drop-shadow filter for the live edge so it reads as the active path. */
  glow?: string;
}

function styleForState(state: LandmarkRouteState, accent: string): RouteStyle {
  switch (state) {
    case 'resolved':
      return { stroke: 'rgba(212, 168, 67, 0.55)', width: 2, dasharray: undefined, opacity: 0.85 };
    case 'current':
      return { stroke: accent, width: 3, dasharray: undefined, opacity: 1, glow: accent };
    case 'boss':
      return { stroke: '#a83a3a', width: 3, dasharray: '6 3', opacity: 0.9, glow: '#a83a3a' };
    case 'risky':
      return { stroke: '#c24a3a', width: 2, dasharray: '4 4', opacity: 0.85 };
    case 'revealed':
      return { stroke: 'rgba(212, 168, 67, 0.7)', width: 1.6, dasharray: '6 2', opacity: 0.8 };
    case 'reachable':
      return { stroke: 'rgba(212, 168, 67, 0.55)', width: 1.6, dasharray: '4 4', opacity: 0.7 };
    case 'fogged':
      return { stroke: 'rgba(180, 160, 100, 0.3)', width: 1.2, dasharray: '1 4', opacity: 0.55 };
  }
}

export function LandmarkRoute({ segment, currentNodeIdx, accent }: LandmarkRouteProps) {
  const state = deriveRouteState(segment, currentNodeIdx);
  const style = styleForState(state, accent);
  const { from, to } = segment;

  // Two-pass stroke: a wider dark "shadow" line behind the colored stroke
  // so routes stay legible against the bright painted-map background.
  const filter = style.glow
    ? `drop-shadow(0 0 4px ${style.glow}) drop-shadow(0 1px 1px rgba(0,0,0,0.6))`
    : 'drop-shadow(0 1px 1px rgba(0,0,0,0.6))';

  return (
    <g data-route-state={state}>
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke="rgba(0, 0, 0, 0.55)"
        stroke-width={style.width + 1.5}
        stroke-linecap="round"
        opacity={Math.min(1, style.opacity + 0.1)}
        vector-effect="non-scaling-stroke"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={style.stroke}
        stroke-width={style.width}
        stroke-dasharray={style.dasharray}
        stroke-linecap="round"
        opacity={style.opacity}
        vector-effect="non-scaling-stroke"
        filter={filter}
      />
    </g>
  );
}
