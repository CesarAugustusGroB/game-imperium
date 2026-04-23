import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import { hexToPixel, hexCorners } from '../../hex';

/**
 * Grid layer — draws the hex grid, zone tinting (vertical mode only), flank
 * divider lines, and cartesian axis labels. The whole thing is pre-rendered
 * to an offscreen cache canvas on the first frame (and on resize), then
 * blitted each frame to avoid re-stroking hundreds of hexes.
 *
 * `markDirty()` forces a cache rebuild on the next render. The orchestrator
 * calls it via the `resize` hook.
 */
export class GridLayer implements Layer {
  name = 'grid';

  private gridCache: HTMLCanvasElement | null = null;
  private gridCacheDirty = true;
  private gridBlitX = 0;
  private gridBlitY = 0;

  private coordCache: HTMLCanvasElement | null = null;
  private coordCacheDirty = true;

  markDirty(): void {
    this.gridCacheDirty = true;
    this.coordCacheDirty = true;
  }

  resize(_w: number, _h: number): void {
    this.gridCacheDirty = true;
    this.coordCacheDirty = true;
  }

  render(rc: RenderContext): void {
    if (this.gridCacheDirty || !this.gridCache) {
      this.buildCache(rc);
    }

    const dpr = window.devicePixelRatio || 1;
    const cw = this.gridCache!.width / dpr;
    const ch = this.gridCache!.height / dpr;
    rc.ctx.drawImage(this.gridCache!, this.gridBlitX, this.gridBlitY, cw, ch);

    // Debug coord labels — baked into a separate cache the first time they're
    // requested, then blitted in a single drawImage per frame.
    if (rc.showCoords) {
      if (this.coordCacheDirty || !this.coordCache) this.buildCoordCache(rc);
      const ccw = this.coordCache!.width / dpr;
      const cch = this.coordCache!.height / dpr;
      rc.ctx.drawImage(this.coordCache!, this.gridBlitX, this.gridBlitY, ccw, cch);
    }
  }

  private buildCache(rc: RenderContext): void {
    const dpr = window.devicePixelRatio || 1;
    const size = rc.state.config.hexSize;
    const { cols, rows } = rc.state.config;
    const isVertical = rc.flatTop;

    // Cache covers the full grid + a 3-hex padding so axis labels have room
    const cacheW = (cols + 3) * size * 2;
    const cacheH = (rows + 3) * size * 2;

    // Cache-local origin keeps every hex inside the cache canvas
    const cacheOrigin = { x: size * 2, y: size * 2 };
    this.gridBlitX = rc.origin.x - cacheOrigin.x;
    this.gridBlitY = rc.origin.y - cacheOrigin.y;

    const cache = document.createElement('canvas');
    cache.width = Math.round(cacheW * dpr);
    cache.height = Math.round(cacheH * dpr);
    const cctx = cache.getContext('2d')!;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cctx.strokeStyle = 'rgba(200, 180, 120, 0.3)';
    cctx.lineWidth = 1;

    for (const hex of rc.state.gridHexes) {
      const center = hexToPixel(hex, size, cacheOrigin, isVertical);
      const corners = hexCorners(center, size, isVertical);

      if (isVertical) {
        const col = hex.q;
        const offsetRow = hex.r + Math.floor(hex.q / 2);
        const noise = ((hex.q * 7 + hex.r * 13) & 0xFF) / 255;
        const zoneRows = Math.floor(rows / 3); // 10 rows per zone

        // Row zones: red (top 0-9), center (10-19), blue (bottom 20-29)
        let zr: number, zg: number, zb: number;
        if (offsetRow < zoneRows) {
          zr = Math.floor(70 + noise * 20);
          zg = Math.floor(85 + noise * 20);
          zb = 40;
        } else if (offsetRow < zoneRows * 2) {
          zr = Math.floor(40 + noise * 15);
          zg = Math.floor(100 + noise * 30);
          zb = 45;
        } else {
          zr = Math.floor(35 + noise * 15);
          zg = Math.floor(90 + noise * 25);
          zb = Math.floor(55 + noise * 15);
        }

        // Column flanks: left (0-11), center (12-37), right (38-49) — flanks darkened
        if (col < 12 || col >= 38) {
          zr = Math.floor(zr * 0.85);
          zg = Math.floor(zg * 0.85);
          zb = Math.floor(zb * 0.85);
        }

        cctx.beginPath();
        cctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) cctx.lineTo(corners[i].x, corners[i].y);
        cctx.closePath();
        cctx.fillStyle = `rgb(${zr}, ${zg}, ${zb})`;
        cctx.fill();

        // Flank divider lines at col 12 and col 38 boundaries
        if (col === 12 || col === 38) {
          cctx.strokeStyle = 'rgba(200, 180, 120, 0.25)';
          cctx.lineWidth = 2;
          const x = center.x - size;
          cctx.beginPath();
          cctx.moveTo(x, center.y - size);
          cctx.lineTo(x, center.y + size);
          cctx.stroke();
        }

        cctx.strokeStyle = 'rgba(30, 60, 20, 0.4)';
        cctx.lineWidth = 1;
        cctx.beginPath();
        cctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) cctx.lineTo(corners[i].x, corners[i].y);
        cctx.closePath();
        cctx.stroke();
      } else {
        // Horizontal mode — outline only, no tint
        cctx.beginPath();
        cctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) cctx.lineTo(corners[i].x, corners[i].y);
        cctx.closePath();
        cctx.stroke();
      }
    }

    // Cartesian axis labels — vertical mode only
    if (isVertical) {
      cctx.font = "bold 10px 'Segoe UI', system-ui, sans-serif";
      cctx.textAlign = 'center';
      cctx.textBaseline = 'middle';
      cctx.fillStyle = 'rgba(200, 190, 160, 0.4)';

      // X axis — column numbers along the top
      for (let col = 0; col < cols; col++) {
        const x = col * size * 2 + cacheOrigin.x;
        const y = -1 * size * 2 + cacheOrigin.y;
        cctx.fillText(`${col}`, x, y);
      }
      // Y axis — row numbers along the left
      cctx.textAlign = 'right';
      for (let row = 0; row < rows; row++) {
        const x = -1 * size * 2 + cacheOrigin.x;
        const y = row * size * 2 + cacheOrigin.y;
        cctx.fillText(`${row}`, x, y);
      }
    }

    this.gridCache = cache;
    this.gridCacheDirty = false;
  }

  /**
   * Pre-render every hex's offset-coord label into an offscreen canvas that
   * shares origin math with the main `gridCache`.  Lets the live render path
   * replace thousands of `fillText` calls per frame with one `drawImage`.
   */
  private buildCoordCache(rc: RenderContext): void {
    const dpr = window.devicePixelRatio || 1;
    const size = rc.state.config.hexSize;
    const { cols, rows } = rc.state.config;
    const isVertical = rc.flatTop;

    const cacheW = (cols + 3) * size * 2;
    const cacheH = (rows + 3) * size * 2;
    const cacheOrigin = { x: size * 2, y: size * 2 };

    const cache = document.createElement('canvas');
    cache.width = Math.round(cacheW * dpr);
    cache.height = Math.round(cacheH * dpr);
    const cctx = cache.getContext('2d')!;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cctx.font         = '8px monospace';
    cctx.textAlign    = 'center';
    cctx.textBaseline = 'middle';
    cctx.fillStyle    = 'rgba(0, 0, 0, 0.75)';

    for (const hex of rc.state.gridHexes) {
      const center = hexToPixel(hex, size, cacheOrigin, isVertical);
      const col    = hex.q + Math.floor(hex.r / 2);
      cctx.fillText(`${col},${hex.r}`, center.x, center.y);
    }

    this.coordCache = cache;
    this.coordCacheDirty = false;
  }
}
