import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import { isInDeploymentZone } from '../../battle-zones';

/**
 * Highlights valid target hexes when an ability is in targeting mode.
 *
 * Skipped entirely when `state.targetingAbility` is null.
 */
export class TargetingLayer implements Layer {
  name = 'targeting';

  enabled(rc: RenderContext): boolean {
    return rc.state.targetingAbility !== null;
  }

  render(rc: RenderContext): void {
    const { state, origin } = rc;
    const abilityId = state.targetingAbility!;
    const size = state.config.hexSize;
    const { cols, rows } = state.config;

    for (const hex of state.gridHexes) {
      const center = rc.hp(hex, size, origin);
      const unitAtHex = state.getUnitAt(hex);

      if (abilityId === 'Buy Reinforcements') {
        // Valid: empty hexes in blue's deployment zone (works for both grid orientations)
        if (!unitAtHex && isInDeploymentZone(hex, cols, rows, 'blue', rc.flatTop)) {
          rc.fillHex(center, size, 'rgba(240, 208, 128, 0.15)');
          rc.strokeHexStyled(center, size, 'rgba(240, 208, 128, 0.35)', 1.5);
        }
      } else if (abilityId === 'Miracle') {
        // Valid: any living unit.
        if (unitAtHex && !unitAtHex.isDying) {
          rc.fillHex(center, size, 'rgba(240, 208, 128, 0.15)');
          rc.strokeHexStyled(center, size, 'rgba(240, 208, 128, 0.35)', 1.5);
        }
      } else if (abilityId === 'Turncoat') {
        // Valid: living enemy (red) units.
        if (unitAtHex && !unitAtHex.isDying && unitAtHex.faction === 'red') {
          rc.fillHex(center, size, 'rgba(240, 208, 128, 0.15)');
          rc.strokeHexStyled(center, size, 'rgba(240, 208, 128, 0.35)', 1.5);
        }
      }
    }
  }
}
