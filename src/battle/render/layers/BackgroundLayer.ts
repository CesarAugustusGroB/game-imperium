import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';

/** Fills the canvas with the random battlefield image (or a solid colour fallback). */
export class BackgroundLayer implements Layer {
  name = 'background';

  render(rc: RenderContext): void {
    const { ctx, w, h, sprites } = rc;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Vertical mode paints its own green hexes in GridLayer — skip background image.
    if (rc.flatTop) return;

    const bgImage = sprites.getBgImage();
    if (!bgImage) return;

    // Cover-fit: scale so the image fills the canvas, cropping as needed.
    const imgAspect = bgImage.width / bgImage.height;
    const canAspect = w / h;
    let dw: number, dh: number, dx: number, dy: number;
    if (canAspect > imgAspect) {
      dw = w;
      dh = w / imgAspect;
      dx = 0;
      dy = (h - dh) / 2;
    } else {
      dh = h;
      dw = h * imgAspect;
      dx = (w - dw) / 2;
      dy = 0;
    }
    ctx.drawImage(bgImage, dx, dy, dw, dh);

    // Slight darkening overlay to improve grid readability.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, w, h);
  }
}
