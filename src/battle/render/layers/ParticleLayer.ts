import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import { gfxParticles } from '../../battle-settings';

/**
 * Particle effects layer.
 *
 * Draws every particle in `state.particles` as a faded, gravity-affected
 * circle. The tick itself happens in `animation-system.ts`; this layer is
 * pure rendering.
 *
 * Gated by the `gfxParticles` graphics-setting signal — the whole layer
 * can be switched off from the settings panel.
 */
export class ParticleLayer implements Layer {
  name = 'particles';

  enabled(_rc: RenderContext): boolean {
    return gfxParticles.value;
  }

  render(rc: RenderContext): void {
    const particles = rc.state.particles;
    if (particles.length === 0) return;

    const { ctx, origin } = rc;
    const { hexSize } = rc.state.config;
    for (const p of particles) {
      const center = rc.hp(p.hex, hexSize, origin);
      const x = center.x + p.offsetX;
      const y = center.y + p.offsetY;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(x, y, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
