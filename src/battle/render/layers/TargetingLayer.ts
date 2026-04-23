import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import type { Hex } from '../../hex';
import { isInDeploymentZone } from '../../battle-zones';

/**
 * Highlights valid target hexes when an ability is in targeting mode.
 *
 * The per-ability valid-target set is cached and only rebuilt when the
 * targeting ability or unit-count changes — avoids scanning all ~1500
 * grid hexes every frame.
 */
export class TargetingLayer implements Layer {
  name = 'targeting';

  private cacheKey = '';
  private cacheTargets: Hex[] = [];
  private cachePath: Path2D | null = null;

  enabled(rc: RenderContext): boolean {
    return rc.state.targetingAbility !== null;
  }

  render(rc: RenderContext): void {
    const { state, origin } = rc;
    const abilityId = state.targetingAbility!;
    const size = state.config.hexSize;

    const key = `${abilityId}:${state.units.size}:${size}:${rc.flatTop ? 1 : 0}`;
    if (key !== this.cacheKey || !this.cachePath) {
      this.cacheTargets = this.computeTargets(rc, abilityId);
      this.cachePath    = this.buildTargetPath(rc, this.cacheTargets, size);
      this.cacheKey     = key;
    }

    if (this.cacheTargets.length === 0) return;

    const ctx = rc.ctx;
    ctx.save();
    ctx.translate(origin.x, origin.y);
    ctx.fillStyle = 'rgba(240, 208, 128, 0.15)';
    ctx.fill(this.cachePath);
    ctx.strokeStyle = 'rgba(240, 208, 128, 0.35)';
    ctx.lineWidth   = 1.5;
    ctx.stroke(this.cachePath);
    ctx.restore();
  }

  private computeTargets(rc: RenderContext, abilityId: string): Hex[] {
    const { state } = rc;
    const { cols, rows } = state.config;
    const targets: Hex[] = [];

    for (const hex of state.gridHexes) {
      const unitAtHex = state.getUnitAt(hex);
      if (abilityId === 'Buy Reinforcements') {
        if (!unitAtHex && isInDeploymentZone(hex, cols, rows, 'blue', rc.flatTop)) {
          targets.push(hex);
        }
      } else if (abilityId === 'Miracle') {
        if (unitAtHex && !unitAtHex.isDying) targets.push(hex);
      } else if (abilityId === 'Turncoat') {
        if (unitAtHex && !unitAtHex.isDying && unitAtHex.faction === 'red') {
          targets.push(hex);
        }
      }
    }
    return targets;
  }

  private buildTargetPath(rc: RenderContext, targets: Hex[], size: number): Path2D {
    const path = new Path2D();
    for (const hex of targets) {
      const center  = rc.hp(hex, size, { x: 0, y: 0 });
      const corners = rc.hc(center, size);
      path.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) path.lineTo(corners[i].x, corners[i].y);
      path.closePath();
    }
    return path;
  }
}
