import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import { hexToPixel } from '../../hex';

/**
 * Renders in-flight projectiles (arrows) with a parabolic arc.
 *
 * Visual priority: drawn AFTER UnitLayer (arrows pass over units) and BEFORE
 * ParticleLayer (impact sparks cover the arrow on landing).
 *
 * Sprite path: if `sprites.shields.get('arrow')` returns a canvas, it is drawn
 * as a rotated sprite. Otherwise a programmatic line + arrowhead + fletching is
 * rendered. To activate sprite rendering, register an arrow image under the key
 * `'arrow'` in SpriteManager (see comment there).
 */
export class ProjectileLayer implements Layer {
  name = 'projectiles';

  render(rc: RenderContext): void {
    const projectiles = rc.state.projectiles;
    if (projectiles.length === 0) return;

    const { ctx, origin, flatTop } = rc;
    const { hexSize } = rc.state.config;
    const peak = hexSize * 0.35;
    const arrowSprite = rc.sprites.shields.get('arrow') ?? null;

    for (const p of projectiles) {
      const t = p.duration > 0 ? Math.min(1, p.elapsed / p.duration) : 1;

      const from = hexToPixel(p.fromHex, hexSize, origin, flatTop);
      const to   = hexToPixel(p.toHex,   hexSize, origin, flatTop);

      const x = from.x + (to.x - from.x) * t;
      // Parabolic arc: subtract a sine bump that peaks at t=0.5.
      const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * peak;

      // Velocity direction — use the derivative of the interpolation.
      const dt2 = 0.01;
      const t2  = Math.min(1, t + dt2);
      const x2  = from.x + (to.x - from.x) * t2;
      const y2  = from.y + (to.y - from.y) * t2 - Math.sin(t2 * Math.PI) * peak;
      const angle = Math.atan2(y2 - y, x2 - x);

      if (arrowSprite) {
        const size = hexSize * 0.6;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.drawImage(arrowSprite, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        this.drawArrow(ctx, x, y, angle, hexSize);
      }
    }
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    hexSize: number,
  ): void {
    const shaftLen  = hexSize * 0.5;
    const headLen   = hexSize * 0.18;
    const headW     = hexSize * 0.10;
    const shaftW    = Math.max(1, hexSize * 0.04);
    const fletchLen = hexSize * 0.10;
    const fletchW   = hexSize * 0.07;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Shaft
    ctx.beginPath();
    ctx.moveTo(-shaftLen / 2, 0);
    ctx.lineTo(shaftLen / 2 - headLen, 0);
    ctx.strokeStyle = '#3a2416';
    ctx.lineWidth   = shaftW;
    ctx.stroke();

    // Arrowhead — filled triangle at tip
    ctx.beginPath();
    ctx.moveTo(shaftLen / 2, 0);
    ctx.lineTo(shaftLen / 2 - headLen,  headW / 2);
    ctx.lineTo(shaftLen / 2 - headLen, -headW / 2);
    ctx.closePath();
    ctx.fillStyle = '#d9c68a';
    ctx.fill();

    // Fletching — two short strokes at the tail
    const tailX = -shaftLen / 2;
    ctx.strokeStyle = '#c94b3b';
    ctx.lineWidth   = shaftW;
    ctx.beginPath();
    ctx.moveTo(tailX, 0);
    ctx.lineTo(tailX + fletchLen,  fletchW);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tailX, 0);
    ctx.lineTo(tailX + fletchLen, -fletchW);
    ctx.stroke();

    ctx.restore();
  }
}
