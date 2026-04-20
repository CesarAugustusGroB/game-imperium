import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import type { LieutenantOrder } from '../../battle-types';

/**
 * HUD indicators drawn in screen-space (fixed layer):
 *  - Order indicator (top-left): current lieutenant order + key hints
 *  - Veteran indicator (bottom-left): Boudicca flame stacks + damage bonus
 *
 * Both are suppressed when the battle is not in the `fighting` phase.
 */
export class IndicatorsLayer implements Layer {
  name = 'indicators';
  fixed = true;

  render(rc: RenderContext): void {
    const { state } = rc;
    if (state.phase !== 'fighting') return;

    this.drawOrderIndicator(rc);
    this.drawVeteranIndicator(rc);
  }

  private drawOrderIndicator(rc: RenderContext): void {
    const { ctx, state } = rc;
    const labels: Record<LieutenantOrder, { text: string; icon: string }> = {
      auto:     { text: 'AUTO',     icon: '\u2699' },
      attack:   { text: 'ATTACK',   icon: '\u2694' },
      defend:   { text: 'DEFEND',   icon: '\uD83D\uDEE1' },
      skirmish: { text: 'SKIRMISH', icon: '\u21C4' },
      mobile:   { text: 'MOBILE',   icon: '\u27A5' },
    };
    const info = labels[state.lieutenantOrder];

    ctx.save();
    ctx.font          = "bold 14px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign     = 'left';
    ctx.textBaseline  = 'top';
    ctx.fillStyle     = 'rgba(200, 180, 140, 0.7)';
    ctx.shadowColor   = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur    = 4;
    ctx.fillText(`${info.icon} ${info.text}`, 12, 12);
    ctx.shadowColor   = 'transparent';
    ctx.font          = "11px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle     = 'rgba(180, 170, 150, 0.4)';
    ctx.fillText('0-Auto  1-Attack  2-Defend  3-Skirmish  4-Mobile', 12, 30);
    ctx.restore();
  }

  private drawVeteranIndicator(rc: RenderContext): void {
    const { ctx, state, h } = rc;
    if (state.veteranBonus <= 0) return;

    const stacks = Math.round(state.veteranBonus / 0.05);
    const pct    = Math.round(state.veteranBonus * 100);

    ctx.save();
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'bottom';

    ctx.font        = "bold 16px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle   = '#ff6b35';
    ctx.shadowColor = 'rgba(255, 100, 0, 0.7)';
    ctx.shadowBlur  = 10;
    ctx.fillText(`\uD83D\uDD25 ${stacks}`, 12, h - 58);
    ctx.shadowColor = 'transparent';

    ctx.font        = "bold 12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle   = 'rgba(255, 160, 80, 0.75)';
    ctx.shadowColor = 'rgba(255, 100, 0, 0.5)';
    ctx.shadowBlur  = 6;
    ctx.fillText(`+${pct}% DMG`, 12, h - 40);
    ctx.shadowColor = 'transparent';

    ctx.restore();
  }
}
