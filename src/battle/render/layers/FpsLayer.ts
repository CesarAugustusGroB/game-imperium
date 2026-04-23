import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import { gfxPerfHud } from '../../battle-settings';

/**
 * Bottom-right FPS counter + optional profiling HUD.
 *
 * Default: compact `NN FPS | NN units` label, colour-coded by frame rate.
 * When `gfxPerfHud` is on: expanded HUD with frame ms, entity counts, and
 * per-layer render cost (EMA, populated by BattleRenderer).
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
    if (elapsed >= 500) {
      this.displayFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime   = now;
    }

    const { ctx, w, h } = rc;
    const fpsColor = this.displayFps >= 50
      ? '#44ff66'
      : this.displayFps >= 30 ? '#ffdd44' : '#ff4444';

    if (gfxPerfHud.value) {
      this.renderFullHud(rc, fpsColor);
    } else {
      this.renderCompact(ctx, w, h, rc.state.units.size, fpsColor);
    }
  }

  private renderCompact(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    unitCount: number,
    fpsColor: string,
  ): void {
    const label = `${this.displayFps} FPS | ${unitCount} units`;
    ctx.save();
    ctx.font          = "bold 13px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign     = 'right';
    ctx.textBaseline  = 'bottom';
    ctx.fillStyle     = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(w - 160, h - 32, 152, 24);
    ctx.fillStyle     = fpsColor;
    ctx.fillText(label, w - 16, h - 10);
    ctx.restore();
  }

  private renderFullHud(rc: RenderContext, fpsColor: string): void {
    const { ctx, w, state } = rc;
    const stats = rc.perfStats;
    const frameMs = rc.frameMs ?? 0;

    // Top layers by cost, descending. Hide layers under 0.05ms to reduce noise.
    const rows: Array<{ name: string; ms: number }> = [];
    if (stats) {
      for (const [name, ms] of stats) {
        if (ms >= 0.05) rows.push({ name, ms });
      }
      rows.sort((a, b) => b.ms - a.ms);
    }
    const maxRows = Math.min(rows.length, 8);

    const lineH   = 14;
    const padX    = 10;
    const padY    = 8;
    const width   = 210;
    const headerH = 3 * lineH + 6; // fps + frame ms + counts
    const height  = headerH + maxRows * lineH + padY * 2;
    const x       = w - width - 8;
    const y       = 8;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    ctx.font         = "bold 12px 'Segoe UI', system-ui, sans-serif";
    ctx.textBaseline = 'top';

    // Header: FPS + frame ms
    ctx.textAlign = 'left';
    ctx.fillStyle = fpsColor;
    ctx.fillText(`${this.displayFps} FPS`, x + padX, y + padY);
    ctx.textAlign = 'right';
    ctx.fillStyle = this.msColor(frameMs, 16.7);
    ctx.fillText(`${frameMs.toFixed(2)} ms`, x + width - padX, y + padY);

    // Entity counts
    ctx.font      = "11px 'Segoe UI', system-ui, sans-serif";
    ctx.textAlign = 'left';
    ctx.fillStyle = '#bcd6ff';
    ctx.fillText(
      `U:${state.units.size}  P:${state.particles.length}  `
        + `Pr:${state.projectiles.length}  Ft:${state.floatingTexts.length}`,
      x + padX,
      y + padY + lineH,
    );

    // Separator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(x + padX, y + padY + lineH * 2 + 3);
    ctx.lineTo(x + width - padX, y + padY + lineH * 2 + 3);
    ctx.stroke();

    // Per-layer rows
    ctx.font = "11px 'Segoe UI', system-ui, sans-serif";
    for (let i = 0; i < maxRows; i++) {
      const row = rows[i];
      const rowY = y + padY + headerH + i * lineH;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#dddddd';
      ctx.fillText(row.name, x + padX, rowY);
      ctx.textAlign = 'right';
      ctx.fillStyle = this.msColor(row.ms, 2);
      ctx.fillText(`${row.ms.toFixed(2)}`, x + width - padX, rowY);
    }

    ctx.restore();
  }

  /** Budget-relative colour: green under half, yellow up to budget, red over. */
  private msColor(ms: number, budget: number): string {
    if (ms < budget * 0.5) return '#9be39b';
    if (ms < budget)       return '#ffdd44';
    return '#ff6666';
  }
}
