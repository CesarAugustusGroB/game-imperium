import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import type { Point } from '../../hex';
import { classifyZone, getAxisBands } from '../../battle-zones';

/**
 * Capture-mode zone overlay for the horizontal grid: tints each faction's
 * back band (own deployment zone), and draws dashed boundary lines at the
 * two camp edges.
 *
 * Disabled on vertical (V2) battlefields — V2 bakes zone tinting directly
 * into the cached grid image via GridLayer.
 */
export class ZoneLayer implements Layer {
  name = 'zones';

  enabled(rc: RenderContext): boolean {
    return rc.state.config.victoryMode === 'capture' && !rc.flatTop;
  }

  render(rc: RenderContext): void {
    const { state, origin } = rc;
    const size = state.config.hexSize;
    const { cols, rows } = state.config;

    for (const hex of state.gridHexes) {
      const center = rc.hp(hex, size, origin);
      const { depth } = classifyZone(hex, cols, rows, 'blue', false);
      if (depth === 'back') {
        rc.fillHex(center, size, 'rgba(80, 140, 255, 0.25)'); // blue deployment
      } else if (depth === 'front') {
        rc.fillHex(center, size, 'rgba(255, 80, 80, 0.25)');  // red deployment
      }
    }

    const bands = getAxisBands(cols);
    this.drawZoneLine(rc, origin, size, bands.low.end, 'rgba(80, 140, 255, 0.50)');
    this.drawZoneLine(rc, origin, size, bands.high.start, 'rgba(255, 80, 80, 0.50)');
  }

  /** Draw a dashed vertical line at the left edge of `col` (horizontal grid only). */
  private drawZoneLine(rc: RenderContext, origin: Point, hexSize: number, col: number, color: string): void {
    const { ctx, state } = rc;
    const rows = state.config.rows;
    const sqrt3 = Math.sqrt(3);

    // Row 0 top hex center, offset column == axial q
    const topHex = { q: col, r: 0 };
    const topPt = rc.hp(topHex, hexSize, origin);
    const x = topPt.x - hexSize * sqrt3 / 2;

    const botHex = { q: col - Math.floor((rows - 1) / 2), r: rows - 1 };
    const botPt = rc.hp(botHex, hexSize, origin);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, topPt.y - hexSize);
    ctx.lineTo(x, botPt.y + hexSize);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
