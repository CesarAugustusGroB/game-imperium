import { SCREEN_SHAKE_DURATION, SCREEN_SHAKE_INTENSITY } from '../battle-config';

/**
 * 2D camera translation + screen-shake for the battle canvas.
 *
 * BattleInput reads `camera.x` / `camera.y` directly (via the
 * `cameraX` / `cameraY` getters on BattleRenderer) for WASD panning.
 */
export class Camera {
  /** Current horizontal pan offset in CSS pixels. */
  x = 0;
  /** Current vertical pan offset in CSS pixels. */
  y = 0;

  /**
   * Apply the camera translation to `ctx` (wrapped in a `save`). When
   * `screenShake > 0` the unit also jitters within an intensity envelope
   * that scales from the current shake timer remaining. Returns a cleanup
   * function that restores the transform.
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
      return () => { ctx.restore(); ctx.restore(); };
    }
    return () => { ctx.restore(); };
  }
}
