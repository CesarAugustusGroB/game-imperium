import type { Point } from '../hex';
import { hexToPixel, hexCorners } from '../hex';
import type { BattleState } from '../battle-state';
import type { SpriteManager } from './SpriteManager';

/**
 * Snapshot of all shared state passed to every Layer's `render()` call.
 *
 * Built once per frame by BattleRenderer; layers must treat this as
 * read-only (mutation causes undefined behaviour in subsequent layers).
 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  /** The current game / battle state. */
  state: BattleState;
  /** Canvas CSS width (logical pixels). */
  w: number;
  /** Canvas CSS height (logical pixels). */
  h: number;
  /** Pre-computed grid origin for this frame. */
  origin: Point;
  /** Whether grids use flat-top orientation (engine.config.vertical). */
  flatTop: boolean;
  /** Sprite cache manager (shields, star, background). */
  sprites: SpriteManager;
  /** Currently hovered hex, or null. */
  hoveredHex: { q: number; r: number } | null;
  /** Whether offset col,row coordinate labels are shown on each hex. */
  showCoords: boolean;
  /** When true the victory overlay is suppressed (e.g. during replay). */
  suppressVictoryOverlay: boolean;

  // ── Convenience hex-drawing helpers (built once, closed over ctx) ──

  /** Pointy-top hexToPixel with the frame's flatTop & origin baked in. */
  hp(hex: { q: number; r: number }, size: number, origin: Point): Point;
  /** hexCorners — thin wrapper so layers don't need to import hex.ts. */
  hc(center: Point, size: number): Point[];
  /** Fill a hex with a solid colour. */
  fillHex(center: Point, size: number, style: string): void;
  /** Stroke a hex using the current ctx strokeStyle / lineWidth. */
  strokeHex(center: Point, size: number): void;
  /** Stroke a hex with a given style and line width. */
  strokeHexStyled(center: Point, size: number, style: string, lineWidth: number): void;
}

/** Build a new RenderContext for a single frame. */
export function buildRenderContext(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  w: number,
  h: number,
  sprites: SpriteManager,
  hoveredHex: { q: number; r: number } | null,
  showCoords: boolean,
  suppressVictoryOverlay: boolean,
): RenderContext {
  const flatTop = !!state.config.vertical;
  const origin = state.getGridOrigin(w, h);

  function cornersFor(center: Point, size: number): Point[] {
    return hexCorners(center, size, flatTop);
  }

  function fillHex(center: Point, size: number, style: string): void {
    const corners = cornersFor(center, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }

  function strokeHexRaw(center: Point, size: number): void {
    const corners = cornersFor(center, size);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  function strokeHexStyled(center: Point, size: number, style: string, lineWidth: number): void {
    ctx.save();
    ctx.strokeStyle = style;
    ctx.lineWidth = lineWidth;
    strokeHexRaw(center, size);
    ctx.restore();
  }

  return {
    ctx,
    state,
    w,
    h,
    origin,
    flatTop,
    sprites,
    hoveredHex,
    showCoords,
    suppressVictoryOverlay,
    hp: (hex, size, orig) => hexToPixel(hex, size, orig, flatTop),
    hc: cornersFor,
    fillHex,
    strokeHex: strokeHexRaw,
    strokeHexStyled,
  };
}
