import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';

/**
 * Bottom-right FPS counter with unit count.
 *
 * Fixed layer (drawn outside the camera transform) with colour-coded
 * FPS threshold: green ≥ 50, yellow ≥ 30, red < 30.
 */
export class FpsLayer implements Layer {
  name  = 'fps';
  fixed = true;

  private frameCount  = 0;
  private lastTime    = performance.now();
  private displayFps  = 0;

  render(rc: RenderContext): void {
    this.frameCount++;
    const now     = performance.now();
    const elapsed = now - this.lastTime;
    if (elapsed >= 1000) {
      this.displayFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime   = now;
    }

    const { ctx, w, h, state } = rc;
    const unitCount = state.units.size;
    const label     = `${this.displayFps} FPS | ${unitCount} units`;

    ctx.save();
    ctx.font          = "bold 13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign     = 'right';
    ctx.textBaseline  = 'bottom';

    // Dark backing rect for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(w - 160, h - 32, 152, 24);

    // Colour-coded by frame rate
    ctx.fillStyle = this.displayFps >= 50
      ? '#44ff66'
      : this.displayFps >= 30 ? '#ffdd44' : '#ff4444';
    ctx.fillText(label, w - 16, h - 10);
    ctx.restore();
  }
}
