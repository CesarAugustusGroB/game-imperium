import { SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY } from '../battle-config';

/**
 * 2D camera translation + screen-shake + zoom for the battle canvas.
 *
 * BattleInput reads `camera.x` / `camera.y` directly (via the
 * `cameraX` / `cameraY` getters on BattleRenderer) for WASD panning.
 * Zoom is driven by the mouse wheel and anchored at the cursor so the
 * world point under the cursor stays fixed across scale changes.
 */
export class Camera {
  /** Current horizontal pan offset in CSS pixels. */
  x = 0;
  /** Current vertical pan offset in CSS pixels. */
  y = 0;
  /** World-to-screen scale factor. 1 = no zoom. */
  zoom = 1;

  static readonly MIN_ZOOM = 0.5;
  static readonly MAX_ZOOM = 2.5;

  /**
   * Apply pan + shake + zoom to `ctx` (wrapped in a `save`). Order:
   *   1. translate(pan)       — screen-space pan offset
   *   2. translate(shake)     — screen-space jitter (not scaled by zoom)
   *   3. scale(zoom)          — world content scale
   * Returns a cleanup function that restores the transform.
   */
  begin(ctx: CanvasRenderingContext2D, screenShake = 0): () => void {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (screenShake > 0) {
      ctx.save();
      const intensity = screenShake * SCREEN_SHAKE_INTENSITY / SCREEN_SHAKE_DURATION;
      const sx = (Math.random() - 0.5) * intensity * 2;
      const sy = (Math.random() - 0.5) * intensity * 2;
      ctx.translate(sx, sy);
      ctx.scale(this.zoom, this.zoom);
      return () => { ctx.restore(); ctx.restore(); };
    }
    ctx.scale(this.zoom, this.zoom);
    return () => { ctx.restore(); };
  }

  /** Convert a screen-space point (CSS pixels) to world-space. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.x) / this.zoom, y: (sy - this.y) / this.zoom };
  }

  /**
   * Multiply current zoom by `factor`, keeping the world point beneath the
   * given screen-space cursor stable. Clamped to [MIN_ZOOM, MAX_ZOOM].
   */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    const target = Math.min(Camera.MAX_ZOOM, Math.max(Camera.MIN_ZOOM, this.zoom * factor));
    if (target === this.zoom) return;
    const ratio = target / this.zoom;
    this.x = screenX - (screenX - this.x) * ratio;
    this.y = screenY - (screenY - this.y) * ratio;
    this.zoom = target;
  }
}
