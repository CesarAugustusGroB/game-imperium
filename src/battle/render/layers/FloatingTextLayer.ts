import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import { hexToPixel } from '../../hex';

/**
 * Draws floating combat-text labels (DODGE!, CRIT!!, damage numbers, etc.)
 * that rise and fade above their source hex.
 */
export class FloatingTextLayer implements Layer {
  name = 'floatingText';

  render(rc: RenderContext): void {
    const { ctx, state, origin } = rc;
    const size = state.config.hexSize;

    for (const ft of state.floatingTexts) {
      const center  = hexToPixel(ft.hex, size, origin);
      const t       = 1 - ft.timer / ft.duration; // 0→1 as text ages
      const offsetY = -30 - t * 40;               // float upward
      const alpha   = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; // fade last 30%

      ctx.save();
      ctx.translate(center.x, center.y + offsetY);
      ctx.font          = "bold 16px 'Segoe UI', system-ui, sans-serif";
      ctx.textAlign     = 'center';
      ctx.textBaseline  = 'middle';
      ctx.globalAlpha   = alpha;
      // Dark outline
      ctx.strokeStyle   = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth     = 3;
      ctx.strokeText(ft.text, 0, 0);
      // Coloured fill with glow
      ctx.fillStyle     = ft.color;
      ctx.shadowColor   = ft.color;
      ctx.shadowBlur    = 8;
      ctx.fillText(ft.text, 0, 0);
      ctx.restore();
    }
  }
}
