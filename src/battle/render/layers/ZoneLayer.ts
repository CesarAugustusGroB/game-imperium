import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import { hexToPixel } from '../../hex';
import { hexToCol } from '../../battle-zones';

/**
 * Draws the capture-mode zone tints and vertical boundary lines.
 *
 * Only rendered when `victoryMode === 'capture'`.
 */
export class ZoneLayer implements Layer {
  name = 'zones';

  enabled(rc: RenderContext): boolean {
    return rc.state.config.victoryMode === 'capture';
  }

  render(rc: RenderContext): void {
    const { state, origin } = rc;
    const size  = state.config.hexSize;
    const cols  = state.config.cols;

    const campCols    = Math.round(cols * 0.2);   // ~4
    const reserveCols = Math.round(cols * 0.15);  // ~3

    for (const hex of state.gridHexes) {
      const col    = hexToCol(hex);
      const center = hexToPixel(hex, size, origin);

      // Blue side
      if (col < campCols) {
        rc.fillHex(center, size, 'rgba(80, 140, 255, 0.25)');
      } else if (col < campCols + reserveCols) {
        rc.fillHex(center, size, 'rgba(200, 180, 80, 0.18)');
      }

      // Red side
      if (col >= cols - campCols) {
        rc.fillHex(center, size, 'rgba(255, 80, 80, 0.25)');
      } else if (col >= cols - campCols - reserveCols) {
        rc.fillHex(center, size, 'rgba(200, 180, 80, 0.18)');
      }
    }

    this.drawZoneLine(rc, origin, size, campCols,                     'rgba(80, 140, 255, 0.50)');
    this.drawZoneLine(rc, origin, size, campCols + reserveCols,       'rgba(200, 180, 80, 0.40)');
    this.drawZoneLine(rc, origin, size, cols - campCols,              'rgba(255, 80, 80, 0.50)');
    this.drawZoneLine(rc, origin, size, cols - campCols - reserveCols,'rgba(200, 180, 80, 0.40)');
  }

  private drawZoneLine(
    rc: RenderContext,
    origin: { x: number; y: number },
    hexSize: number,
    col: number,
    color: string,
  ): void {
    const { ctx, state } = rc;
    const rows   = state.config.rows;
    const sqrt3  = Math.sqrt(3);

    const topHex = { q: col, r: 0 };
    const topPt  = hexToPixel(topHex, hexSize, origin);
    const x      = topPt.x - hexSize * sqrt3 / 2;

    const botHex = { q: col - Math.floor((rows - 1) / 2), r: rows - 1 };
    const botPt  = hexToPixel(botHex, hexSize, origin);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(x, topPt.y - hexSize);
    ctx.lineTo(x, botPt.y + hexSize);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
