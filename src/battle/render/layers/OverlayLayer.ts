import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';

/**
 * Full-canvas overlay layers drawn in world space (before the camera restore):
 *  1. Victory / draw banner — shown when the battle concludes.
 *  2. Pause screen — shown when the battle is paused (if supported by state).
 *
 * Both checks are guarded by `suppressVictoryOverlay`.
 */
export class OverlayLayer implements Layer {
  name = 'overlay';

  enabled(rc: RenderContext): boolean {
    // Pause overlay is always rendered when paused. Victory/draw overlay is
    // skipped when the Preact BattleScreenV2 is mounted (its own overlay
    // takes over), or when explicitly suppressed.
    if (rc.state.paused) return true;
    if (rc.suppressVictoryOverlay) return false;
    if (typeof window !== 'undefined' && window.location.hash === '#battleV2') return false;
    return rc.state.phase === 'victory' || rc.state.phase === 'draw';
  }

  render(rc: RenderContext): void {
    if (rc.state.paused) {
      this.drawPauseOverlay(rc);
      return;
    }

    const isDraw    = rc.state.phase === 'draw';
    const isVictory = rc.state.phase === 'victory' && rc.state.winner !== null;
    if (!isDraw && !isVictory) return;

    this.drawVictoryOverlay(rc, isDraw);
  }

  private drawVictoryOverlay(rc: RenderContext, isDraw: boolean): void {
    const { ctx, state, w, h } = rc;

    // Dim background.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    const label = isDraw
      ? 'Draw!'
      : state.winner === 'blue' ? 'Blue Faction Wins!' : 'Red Faction Wins!';
    const color = isDraw
      ? '#ccaa44'
      : state.winner === 'blue' ? '#5588dd' : '#dd5555';

    // Banner background.
    const bannerH = 100;
    const bannerY = (h - bannerH) / 2;
    ctx.fillStyle = 'rgba(10, 10, 30, 0.9)';
    ctx.fillRect(0, bannerY, w, bannerH);

    // Top / bottom gold lines.
    ctx.strokeStyle = 'rgba(220, 190, 100, 0.6)';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, bannerY);
    ctx.lineTo(w, bannerY);
    ctx.moveTo(0, bannerY + bannerH);
    ctx.lineTo(w, bannerY + bannerH);
    ctx.stroke();

    // Victory text.
    ctx.font          = "bold 36px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillStyle     = color;
    ctx.shadowColor   = color;
    ctx.shadowBlur    = 16;
    ctx.fillText(label, w / 2, bannerY + bannerH / 2 - 8);
    ctx.shadowColor   = 'transparent';

    // Subtitle.
    ctx.font      = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(200, 190, 160, 0.6)';
    ctx.fillText(
      `Battle concluded in ${state.roundCount} rounds \u2014 press ESC to return`,
      w / 2, bannerY + bannerH / 2 + 22,
    );
  }

  private drawPauseOverlay(rc: RenderContext): void {
    const { ctx, w, h } = rc;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, w, h);

    ctx.font          = "bold 48px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.fillStyle     = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('PAUSED', w / 2, h / 2);

    ctx.font      = "14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = 'rgba(200, 190, 160, 0.6)';
    ctx.fillText('Press SPACE to resume', w / 2, h / 2 + 32);
  }
}
