/**
 * LandmarkMap (S29-04) — illustrated campaign-map container for the
 * SpokeCampaignScreen. Pure layout — no game logic, no grid, no map
 * engine. Renders four stacked layers:
 *
 *   1. Background — CSS background-image at `/asset/maps/gaul-campaign-bg.png`
 *      with a parchment-gradient fallback (the asset isn't shipped yet; the
 *      fallback keeps the screen usable for MVP).
 *   2. SVG route layer — full-cover `<svg viewBox="0 0 100 100">` so the
 *      caller can stroke routes between nodes in normalized coordinates.
 *      Filled in by S29-06.
 *   3. Node layer — absolute-positioned wrappers at each node's `(x%, y%)`.
 *      The caller's `renderNode` returns the visual (S29-05).
 *   4. Optional fog / highlight overlay — pass-through `children` slot
 *      stacked above the route + node layers.
 *
 * Coordinates come from `getNodeCoord(node, idx, total)` — percentages.
 * The default resolver lays the chain along a gentle sine path so the
 * screen has something usable before per-node x/y data exists. When
 * SpokeNode eventually carries explicit coordinates, swap the resolver
 * and every call site keeps working unchanged.
 */

import type { ComponentChildren } from 'preact';
import type { SpokeNode } from '../../../game/progression/spoke';

export interface MapCoord {
  /** 0..100 — percentage from left. */
  x: number;
  /** 0..100 — percentage from top. */
  y: number;
}

export interface LandmarkMapRouteSegment {
  from: MapCoord;
  to: MapCoord;
  fromNode: SpokeNode;
  toNode: SpokeNode;
  /** Index of `toNode` in the `nodes` array (so the caller can read state). */
  toIndex: number;
}

export interface LandmarkMapProps {
  nodes: readonly SpokeNode[];
  /** Visual for each node tile — positioned in the node layer. */
  renderNode: (node: SpokeNode, coord: MapCoord, index: number) => ComponentChildren;
  /** Visual for each consecutive route segment — emitted inside the SVG route layer. */
  renderRoute?: (segment: LandmarkMapRouteSegment) => ComponentChildren;
  /** Override the default sine-path coord resolver. */
  getNodeCoord?: (node: SpokeNode, index: number, total: number) => MapCoord;
  /** Optional overlay layer (fog, highlights, intel pings). */
  children?: ComponentChildren;
  /** Background image URL — defaults to the (currently unshipped) Gaul map. */
  backgroundUrl?: string;
  /**
   * Render the parchment fallback (gradient bg + vignette + frame). Default
   * `false` so the component is transparent and the parent's painted bg
   * shows through. Pass `true` for standalone uses (e.g. legacy node-map).
   */
  withParchment?: boolean;
}

if (typeof document !== 'undefined' && !document.getElementById('landmark-map-styles')) {
  const el = document.createElement('style');
  el.id = 'landmark-map-styles';
  el.textContent = `
    .landmark-map {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 280px;
      isolation: isolate;
      /* Default: transparent — parent owns the painted background. The
         caller can opt into the parchment fallback via the withParchment
         prop (legacy / standalone use). */
      background: transparent;
    }
    .landmark-map--parchment {
      aspect-ratio: 16 / 9;
      max-height: calc(100vh - 220px);
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(180, 160, 100, 0.35),
                  inset 0 0 60px rgba(0, 0, 0, 0.55);
      background-color: #2a1f12;
      background-image:
        radial-gradient(ellipse at 30% 20%, rgba(150, 120, 70, 0.35), transparent 55%),
        radial-gradient(ellipse at 70% 80%, rgba(80, 50, 30, 0.55), transparent 60%),
        repeating-linear-gradient(
          45deg,
          rgba(120, 90, 50, 0.05) 0,
          rgba(120, 90, 50, 0.05) 2px,
          transparent 2px,
          transparent 6px
        ),
        linear-gradient(180deg, #3a2a18 0%, #1f160c 100%);
      background-size: cover, cover, auto, cover;
    }
    /* Real art (when present) layers on top of the parchment fallback so the
       art uses the gradient as ambient lighting if it has transparent edges. */
    .landmark-map[data-bg-loaded="true"]::before {
      content: '';
      position: absolute;
      inset: 0;
      background: var(--landmark-map-bg) center/cover no-repeat;
      z-index: 0;
    }

    .landmark-map-route-layer {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    .landmark-map-node-layer {
      position: absolute;
      inset: 0;
      z-index: 2;
    }
    .landmark-map-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 3;
    }

    .landmark-map-node-anchor {
      position: absolute;
      transform: translate(-50%, -50%);
      pointer-events: auto;
    }

    /* Subtle vignette only on the parchment variant. */
    .landmark-map--parchment::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
      background: radial-gradient(ellipse at center, transparent 55%, rgba(0, 0, 0, 0.45) 100%);
    }
  `;
  document.head.appendChild(el);
}

const DEFAULT_BG_URL = '/asset/maps/gaul-campaign-bg.png';

/**
 * Default resolver — lays the chain horizontally with a gentle sine wobble.
 * Padding leaves room for node tiles at the edges.
 */
function defaultCoord(_node: SpokeNode, index: number, total: number): MapCoord {
  if (total <= 1) return { x: 50, y: 50 };
  const padX = 8; // %
  const t = index / (total - 1);
  const x = padX + (100 - 2 * padX) * t;
  // Centerline at 55% (slightly below middle so the top reads as sky/labels),
  // wobble amplitude ±12%. Edges flatten so start/boss sit on a stable line.
  const isEdge = index === 0 || index === total - 1;
  const wobble = isEdge ? 0 : Math.sin(index * 0.85) * 12;
  return { x, y: 55 + wobble };
}

export function LandmarkMap({
  nodes,
  renderNode,
  renderRoute,
  getNodeCoord = defaultCoord,
  children,
  backgroundUrl = DEFAULT_BG_URL,
  withParchment = false,
}: LandmarkMapProps) {
  const total = nodes.length;
  const coords = nodes.map((n, i) => getNodeCoord(n, i, total));

  // The CSS variable is harmless when the file 404s — the parchment fallback
  // is rendered first and the layered ::before only displays once we mark
  // the asset as loaded. We do that with a probe `<img>` (image element
  // doesn't render — it just gates the data attribute).
  const style = backgroundUrl
    ? ({ '--landmark-map-bg': `url("${backgroundUrl}")` } as preact.JSX.CSSProperties)
    : undefined;

  const className = `landmark-map${withParchment ? ' landmark-map--parchment' : ''}`;

  return (
    <div class={className} style={style} role="img" aria-label="Campaign map">
      {backgroundUrl && withParchment && (
        <img
          src={backgroundUrl}
          alt=""
          aria-hidden="true"
          style={{ display: 'none' }}
          onLoad={(e) => {
            const root = (e.currentTarget as HTMLImageElement).closest('.landmark-map');
            root?.setAttribute('data-bg-loaded', 'true');
          }}
          onError={(e) => {
            // T2.1: Silently suppress 404 — the parchment CSS fallback is
            // already rendered; no need to propagate the error to the console.
            (e.currentTarget as HTMLImageElement).setAttribute('data-bg-loaded', 'false');
          }}
        />
      )}

      {renderRoute && total > 1 && (
        <svg
          class="landmark-map-route-layer"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {coords.slice(1).map((to, i) => {
            const fromIdx = i;       // segment connects nodes[i] → nodes[i+1]
            const toIdx = i + 1;
            return renderRoute({
              from: coords[fromIdx],
              to,
              fromNode: nodes[fromIdx],
              toNode: nodes[toIdx],
              toIndex: toIdx,
            });
          })}
        </svg>
      )}

      <div class="landmark-map-node-layer">
        {nodes.map((node, i) => {
          const coord = coords[i];
          return (
            <div
              key={node.id}
              class="landmark-map-node-anchor"
              style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
            >
              {renderNode(node, coord, i)}
            </div>
          );
        })}
      </div>

      {children && <div class="landmark-map-overlay">{children}</div>}
    </div>
  );
}
