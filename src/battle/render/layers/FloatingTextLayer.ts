import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';

/**
 * Draws floating combat-text labels (DODGE!, CRIT!!, damage numbers, etc.)
 * that rise and fade above their source hex.
 *
 * Uses a single outlined-text style for every label — no shadowBlur, which
 * was the layer's worst per-label cost.  The dark stroke already provides
 * enough contrast against the grid.
 */
export class FloatingTextLayer implements Layer {
  name = 'floatingText';

  render(rc: RenderContext): void {
    const { ctx, state, origin } = rc;
    const texts = state.floatingTexts;
    if (texts.length === 0) return;
    const size = state.config.hexSize;

    // Shared text state — set once for the whole batch.
    ctx.save();
    ctx.font          = "bold 16px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.strokeStyle   = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth     = 3;

    for (const ft of texts) {
      const center  = rc.hp(ft.hex, size, origin);
      const t       = 1 - ft.timer / ft.duration; // 0→1 as text ages
      const offsetY = -30 - t * 40;               // float upward
      const alpha   = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; // fade last 30%
      const x = center.x;
      const y = center.y + offsetY;

      ctx.globalAlpha = alpha;
      ctx.strokeText(ft.text, x, y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, x, y);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
