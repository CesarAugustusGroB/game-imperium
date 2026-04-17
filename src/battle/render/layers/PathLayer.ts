import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';

/**
 * Draws dashed path lines for units that have a queued movement path.
 */
export class PathLayer implements Layer {
  name = 'paths';

  render(rc: RenderContext): void {
    const { ctx, state, origin } = rc;
    const size = state.config.hexSize;

    for (const unit of state.units.values()) {
      if (unit.path.length === 0) continue;

      ctx.save();
      ctx.strokeStyle = unit.faction === 'blue'
        ? 'rgba(100, 180, 255, 0.5)'
        : 'rgba(255, 100, 100, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);

      const start = rc.hp(unit.hex, size, origin);
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      for (const pathHex of unit.path) {
        const pt = rc.hp(pathHex, size, origin);
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();

      // Target circle at final destination.
      const last   = unit.path[unit.path.length - 1];
      const target = rc.hp(last, size, origin);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(target.x, target.y, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }
}
