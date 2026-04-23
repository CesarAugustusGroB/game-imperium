import type { Point } from '../hex';
import { hexToPixel, hexCorners } from '../hex';
import type { BattleState } from '../battle-state';
import type { SpriteManager } from './SpriteManager';

/**
 * Snapshot of all shared state passed to every Layer's `render()` call.
 *
 * Built once at renderer construction and mutated in place each frame — see
 * `updateRenderContext`.  Hoisted off the per-frame allocation path: layers
 * treat this as read-only (mutation between layers causes undefined behaviour).
 */
export interface RenderContext {
  ctx: CanvasRenderingContext2D;
  state: BattleState;
  w: number;
  h: number;
  origin: Point;
  flatTop: boolean;
  sprites: SpriteManager;
  hoveredHex: { q: number; r: number } | null;
  showCoords: boolean;
  suppressVictoryOverlay: boolean;
  /** Per-layer render cost (EMA ms). Read by FpsLayer when the perf HUD is on. */
  perfStats?: ReadonlyMap<string, number>;
  /** Smoothed total frame ms — set by BattleRenderer at the start of each frame. */
  frameMs?: number;
  /**
   * Wall-clock ms at the start of this frame (from `performance.now()`).
   * Layers that animate should read this instead of calling `Date.now()`
   * themselves, so all layers in one frame see the same time sample.
   */
  time: number;

  // ── Convenience hex-drawing helpers (bound to this context instance) ──

  hp(hex: { q: number; r: number }, size: number, origin: Point): Point;
  hc(center: Point, size: number): Point[];
  fillHex(center: Point, size: number, style: string): void;
  strokeHex(center: Point, size: number): void;
  strokeHexStyled(center: Point, size: number, style: string, lineWidth: number): void;
}

/**
 * Concrete RenderContext backed by a class so helper methods are allocated
 * once per renderer instead of 6 closures every frame.
 */
class FrameContext implements RenderContext {
  ctx!: CanvasRenderingContext2D;
  state!: BattleState;
  w = 0;
  h = 0;
  origin: Point = { x: 0, y: 0 };
  flatTop = false;
  sprites!: SpriteManager;
  hoveredHex: { q: number; r: number } | null = null;
  showCoords = false;
  suppressVictoryOverlay = false;
  perfStats?: ReadonlyMap<string, number>;
  frameMs?: number;
  time = 0;

  hp(hex: { q: number; r: number }, size: number, origin: Point): Point {
    return hexToPixel(hex, size, origin, this.flatTop);
  }

  hc(center: Point, size: number): Point[] {
    return hexCorners(center, size, this.flatTop);
  }

  fillHex(center: Point, size: number, style: string): void {
    const corners = hexCorners(center, size, this.flatTop);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }

  strokeHex(center: Point, size: number): void {
    const corners = hexCorners(center, size, this.flatTop);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  strokeHexStyled(center: Point, size: number, style: string, lineWidth: number): void {
    const ctx = this.ctx;
    const prevStyle = ctx.strokeStyle;
    const prevWidth = ctx.lineWidth;
    ctx.strokeStyle = style;
    ctx.lineWidth = lineWidth;
    this.strokeHex(center, size);
    ctx.strokeStyle = prevStyle;
    ctx.lineWidth = prevWidth;
  }
}

/** Allocate a reusable RenderContext instance (call once per BattleRenderer). */
export function createRenderContext(): RenderContext {
  return new FrameContext();
}

/** Mutate an existing RenderContext in place for this frame. */
export function updateRenderContext(
  rc: RenderContext,
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  w: number,
  h: number,
  sprites: SpriteManager,
  hoveredHex: { q: number; r: number } | null,
  showCoords: boolean,
  suppressVictoryOverlay: boolean,
  time: number,
): void {
  const fc = rc as FrameContext;
  fc.ctx = ctx;
  fc.state = state;
  fc.w = w;
  fc.h = h;
  fc.sprites = sprites;
  fc.hoveredHex = hoveredHex;
  fc.showCoords = showCoords;
  fc.suppressVictoryOverlay = suppressVictoryOverlay;
  fc.flatTop = !!state.config.vertical;
  fc.origin = state.getGridOrigin(w, h);
  fc.time = time;
}
