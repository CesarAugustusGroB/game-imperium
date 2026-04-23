import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import type { BattleFaction } from '../../battle-types';
import { CAPTURE_DURATION } from '../../battle-config';

/**
 * Draws the capture-objective star icons and their progress arcs.
 *
 * Only rendered when `victoryMode === 'capture'`.
 */
export class StarLayer implements Layer {
  name = 'stars';

  enabled(rc: RenderContext): boolean {
    return rc.state.config.victoryMode === 'capture';
  }

  render(rc: RenderContext): void {
    const { ctx, state, origin, sprites } = rc;
    const size = state.config.hexSize;

    for (const faction of ['blue', 'red'] as BattleFaction[]) {
      const star = state.stars.get(faction);
      if (!star) continue;

      const center       = rc.hp(star, size, origin);
      const progress     = state.captureProgress.get(faction) ?? 0;
      const captureRatio = Math.min(1, progress / CAPTURE_DURATION);

      // Hex highlight — faction tint, pulses while being captured.
      const baseAlpha  = 0.12 + captureRatio * 0.2;
      const pulseAlpha = captureRatio > 0
        ? baseAlpha + 0.1 * Math.sin(rc.time / 150)
        : baseAlpha;
      const color = faction === 'blue' ? '80, 140, 255' : '255, 80, 80';
      rc.fillHex(center, size, `rgba(${color}, ${pulseAlpha})`);
      rc.strokeHexStyled(center, size, `rgba(${color}, ${0.4 + captureRatio * 0.4})`, 2);

      // Commander round image (or procedural fallback star shape).
      ctx.save();
      ctx.translate(center.x, center.y);
      const glowColor = faction === 'blue' ? '#5588ff' : '#ff5555';
      ctx.shadowColor = glowColor;
      ctx.shadowBlur  = 10 + captureRatio * 10;

      const iconSize = size * 1.2;
      if (sprites.starImage) {
        ctx.drawImage(sprites.starImage, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
      } else {
        const starRadius  = size * 0.45;
        const innerRadius = starRadius * 0.4;
        this.drawStarShape(ctx, starRadius, innerRadius, faction === 'blue' ? '#6699ff' : '#ff6666');
      }
      ctx.restore();

      // Capture progress arc.
      if (captureRatio > 0) {
        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.6, -Math.PI / 2, -Math.PI / 2 + captureRatio * Math.PI * 2);
        const enemyColor = faction === 'blue' ? '#ff4444' : '#4488ff';
        ctx.strokeStyle  = enemyColor;
        ctx.lineWidth    = 3;
        ctx.shadowColor  = enemyColor;
        ctx.shadowBlur   = 6;
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawStarShape(
    ctx: CanvasRenderingContext2D,
    outerR: number,
    innerR: number,
    fillColor: string,
  ): void {
    const spikes = 5;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else         ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle   = fillColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }
}
