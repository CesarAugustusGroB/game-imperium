import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import type { Hex } from '../../hex';

/**
 * Draws:
 *  1. The movement-range tint for the selected unit (batched Path2D).
 *  2. The selected-unit hex highlight.
 *  3. The hovered-hex highlight (skipped when it is the selected hex).
 *
 * The movement range is re-computed only when selection/position/unit-count
 * changes; on stable frames we just re-stroke the cached Path2D.
 */
export class HoverLayer implements Layer {
  name = 'hover';

  // ── Cached movement-range batch ──
  private cacheKey  = '';
  private cachePath: Path2D | null = null;

  render(rc: RenderContext): void {
    const { state, origin } = rc;
    const size = state.config.hexSize;

    // ── Movement range ──
    const selected = state.getSelectedUnit();
    if (selected) {
      const key = `${selected.id}:${selected.hex.q},${selected.hex.r}:${state.units.size}:${size}:${rc.flatTop ? 1 : 0}`;
      if (key !== this.cacheKey || !this.cachePath) {
        const range = state.getMovementRange(selected.hex);
        this.cachePath = this.buildRangePath(rc, range, size);
        this.cacheKey  = key;
      }

      // Origin moves with the camera/resize, but the path is built in
      // world-space relative to `origin`. Re-translate by the delta each frame.
      const ctx = rc.ctx;
      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.fillStyle = 'rgba(100, 200, 255, 0.18)';
      ctx.fill(this.cachePath);
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.5)';
      ctx.lineWidth   = 1.5;
      ctx.stroke(this.cachePath);
      ctx.restore();

      // ── Selected hex ──
      const selCenter = rc.hp(selected.hex, size, origin);
      rc.fillHex(selCenter, size, 'rgba(255, 215, 0, 0.2)');
      rc.strokeHexStyled(selCenter, size, 'rgba(255, 215, 0, 0.7)', 2);
    } else {
      // Drop cache when nothing is selected so the next selection rebuilds.
      this.cacheKey = '';
      this.cachePath = null;
    }

    // ── Hovered hex ──
    const hov = rc.hoveredHex;
    if (!hov) return;
    if (!state.isValidHex(hov)) return;
    if (selected && selected.hex.q === hov.q && selected.hex.r === hov.r) return;

    const hovCenter = rc.hp(hov, size, origin);
    rc.fillHex(hovCenter, size, 'rgba(255, 255, 255, 0.08)');
  }

  /**
   * Build a Path2D that contains every hex in `range` outlined around an
   * origin of (0,0).  Draws are then positioned by translating the ctx.
   */
  private buildRangePath(rc: RenderContext, range: Hex[], size: number): Path2D {
    const path = new Path2D();
    for (const hex of range) {
      const center  = rc.hp(hex, size, { x: 0, y: 0 });
      const corners = rc.hc(center, size);
      path.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) path.lineTo(corners[i].x, corners[i].y);
      path.closePath();
    }
    return path;
  }
}
