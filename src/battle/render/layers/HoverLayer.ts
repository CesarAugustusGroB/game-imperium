import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import { hexToPixel } from '../../hex';

/**
 * Draws:
 *  1. The movement-range tint for the selected unit.
 *  2. The selected-unit hex highlight.
 *  3. The hovered-hex highlight (skipped when it is the selected hex).
 */
export class HoverLayer implements Layer {
  name = 'hover';

  render(rc: RenderContext): void {
    const { state, origin } = rc;
    const size = state.config.hexSize;

    // ── Movement range ──
    const selected = state.getSelectedUnit();
    if (selected) {
      const range = state.getMovementRange(selected.hex);
      for (const hex of range) {
        const center = hexToPixel(hex, size, origin);
        rc.fillHex(center, size, 'rgba(100, 200, 255, 0.18)');
        rc.strokeHexStyled(center, size, 'rgba(100, 200, 255, 0.5)', 1.5);
      }

      // ── Selected hex ──
      const selCenter = hexToPixel(selected.hex, size, origin);
      rc.fillHex(selCenter, size, 'rgba(255, 215, 0, 0.2)');
      rc.strokeHexStyled(selCenter, size, 'rgba(255, 215, 0, 0.7)', 2);
    }

    // ── Hovered hex ──
    const hov = rc.hoveredHex;
    if (!hov) return;
    if (!state.isValidHex(hov)) return;
    if (selected && selected.hex.q === hov.q && selected.hex.r === hov.r) return;

    const hovCenter = hexToPixel(hov, size, origin);
    rc.fillHex(hovCenter, size, 'rgba(255, 255, 255, 0.08)');
  }
}
