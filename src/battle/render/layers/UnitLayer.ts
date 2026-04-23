import type { Layer } from '../Layer';
import type { RenderContext } from '../RenderContext';
import type { BattleUnit } from '../../battle-types';
import type { Point } from '../../hex';
import { gfxShadows, gfxCracks } from '../../battle-settings';

/**
 * Draws all living and dying units:
 *  - Interpolated movement between hexes
 *  - Lunge animation toward attack target
 *  - Shake jitter on hit
 *  - Shield sprite (or fallback circle)
 *  - Impact flash (red/white burst)
 *  - Damage cracks (seeded fractal paths — batched into 2 Path2D strokes)
 *  - Selection ring
 *  - Role indicator dot (blue units only)
 *  - Veteran flames (Boudicca bonus)
 */
export class UnitLayer implements Layer {
  name = 'units';

  render(rc: RenderContext): void {
    const { state, origin } = rc;
    const size = state.config.hexSize;

    for (const unit of state.units.values()) {
      const dest = rc.hp(unit.hex, size, origin);

      // Interpolated position during movement animation.
      let center: Point;
      if (unit.prevHex && unit.moveProgress < 1) {
        const src = rc.hp(unit.prevHex, size, origin);
        const t   = unit.path.length > 0
          ? this.easeInOutCubic(unit.moveProgress)
          : this.easeOutCubic(unit.moveProgress);
        center = {
          x: src.x + (dest.x - src.x) * t,
          y: src.y + (dest.y - src.y) * t,
        };
      } else {
        center = dest;
      }

      this.drawUnit(rc, unit, center);

      // Veteran flames (Boudicca bonus — blue units only).
      if (unit.faction === 'blue' && state.veteranBonus > 0) {
        const flames = Math.min(5, Math.floor(state.veteranBonus / 0.10));
        if (flames > 0) this.drawVeteranFlames(rc.ctx, center.x, center.y - size * 0.6, flames);
      }
    }
  }

  // ── Private helpers ──

  /** Cached flame emoji offscreen canvas — built lazily on first use. */
  private flameSprite: HTMLCanvasElement | null = null;
  private static readonly FLAME_SIZE = 14;

  private drawVeteranFlames(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    flames: number,
  ): void {
    const sprite = this.flameSprite ?? this.buildFlameSprite();
    const s = UnitLayer.FLAME_SIZE;
    const startX = cx - 8 - s / 2;
    for (let f = 0; f < flames; f++) {
      ctx.drawImage(sprite, startX + f * 8, cy - s / 2, s, s);
    }
  }

  private buildFlameSprite(): HTMLCanvasElement {
    const s = UnitLayer.FLAME_SIZE;
    const dpr = window.devicePixelRatio || 1;
    const cv = document.createElement('canvas');
    cv.width  = Math.round(s * dpr);
    cv.height = Math.round(s * dpr);
    const cctx = cv.getContext('2d')!;
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.font         = '10px sans-serif';
    cctx.textAlign    = 'center';
    cctx.textBaseline = 'middle';
    cctx.fillText('🔥', s / 2, s / 2);
    this.flameSprite = cv;
    return cv;
  }

  private drawUnit(rc: RenderContext, unit: BattleUnit, center: Point): void {
    const { ctx, state, sprites } = rc;
    const isSelected  = unit.id === state.selectedUnitId;
    const spriteKey   = unit.spriteId ?? `${unit.faction}:${unit.role}`;
    const shieldImg   = sprites.shields.get(spriteKey)
                     ?? sprites.shields.get(`${unit.faction}:${unit.role}`)
                     ?? null;
    const iconSize    = 60;
    const damageRatio = 1 - Math.max(0, unit.currentHp) / unit.stats.hp;

    ctx.save();

    // Death fade: reduce alpha during the fade phase (deathProgress 0.33 → 1.0).
    if (unit.isDying && unit.deathProgress > 0.33) {
      const fadeT     = (unit.deathProgress - 0.33) / 0.67;
      ctx.globalAlpha = 1 - fadeT;
    }

    let sx = center.x;
    let sy = center.y;

    // Lunge: rush toward target hex then snap back.
    if (unit.lungeTarget && unit.lungeTimer > 0) {
      const targetPt = rc.hp(unit.lungeTarget, state.config.hexSize, rc.origin);
      const t          = 1 - unit.lungeTimer / 0.4;
      const lungeFrac  = t < 0.5
        ? t * 2
        : 1 - (t - 0.5) * 2;
      const lungeAmount = lungeFrac * 0.45;
      sx += (targetPt.x - center.x) * lungeAmount;
      sy += (targetPt.y - center.y) * lungeAmount;
    }

    // Shake: random jitter decaying over time.
    if (unit.shakeTimer > 0) {
      const intensity = unit.shakeTimer * 8;
      sx += (Math.random() - 0.5) * intensity;
      sy += (Math.random() - 0.5) * intensity;
    }

    ctx.translate(sx, sy);

    // Selection glow — always on for the selected unit. Default drop-shadow
    // is gated by the gfxShadows graphics-setting toggle.
    if (isSelected) {
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur  = 12;
    } else if (gfxShadows.value) {
      ctx.shadowColor   = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur    = 4;
      ctx.shadowOffsetY = 2;
    }

    // Shield image or fallback circle.
    if (shieldImg) {
      ctx.drawImage(shieldImg, -iconSize / 2, -iconSize / 2 - 4, iconSize, iconSize);
    } else {
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = unit.faction === 'blue' ? '#3366aa' : '#aa3333';
      ctx.fill();
    }

    ctx.shadowColor   = 'transparent';
    ctx.shadowOffsetY = 0;

    // Impact flash — red outer burst + white core.
    if (unit.flashTimer > 0) {
      const t      = unit.flashTimer / 0.35;
      const outerR = iconSize / 2 + (1 - t) * 6;
      ctx.fillStyle = `rgba(255, 60, 30, ${t * 0.35})`;
      ctx.beginPath();
      ctx.arc(0, -4, outerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 240, ${Math.pow(t, 2) * 0.7})`;
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 3 * t, 0, Math.PI * 2);
      ctx.fill();
    }

    // Damage cracks — accumulate with damage. Gated by gfxCracks setting.
    if (gfxCracks.value) {
      const crackRatio = unit.isDying
        ? Math.min(1, unit.deathProgress / 0.33)
        : damageRatio;
      if (crackRatio > 0.05) {
        this.drawCracks(ctx, unit.crackSeed, iconSize, crackRatio);
      }
    }

    // Selection ring.
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(0, -4, iconSize / 2 + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth   = 2;
      ctx.stroke();
    }

    // Role indicator dot (blue units only).
    if (unit.faction === 'blue') {
      const roleColors: Record<string, string> = {
        vanguard: '#c24a3a',
        reserve:  '#4a7cc2',
        guard:    '#d4a843',
      };
      const dotColor = roleColors[unit.role] ?? '#888888';
      const dotY     = iconSize / 2 - 4;
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      ctx.arc(0, dotY, 4, 0, Math.PI * 2);
      ctx.fillStyle   = dotColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Seeded PRNG — deterministic float in [0,1). */
  private seededRandom(seed: number): number {
    const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Draws refined cracks over the unit sprite.
   * Uses a seeded PRNG so crack patterns are deterministic per unit.
   * All crack geometry is batched into two Path2D objects for performance:
   * one dark outer stroke and one bright inner stroke.
   */
  private drawCracks(
    ctx: CanvasRenderingContext2D,
    seed: number,
    iconSize: number,
    intensity: number,
  ): void {
    const MAX_MAIN_CRACKS = 4;
    const crackCount      = Math.ceil(intensity * MAX_MAIN_CRACKS);
    const radius          = iconSize / 2;

    ctx.save();
    ctx.translate(0, -4);
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    const outerPath = new Path2D();
    const innerPath = new Path2D();

    for (let i = 0; i < crackCount; i++) {
      const rng        = (offset: number) => this.seededRandom(seed + i * 3571 + offset);
      const baseAngle  = (i / MAX_MAIN_CRACKS) * Math.PI * 2;
      const angle      = baseAngle + (rng(0) - 0.5) * 0.8;
      const len        = radius * (0.6 + rng(1) * 0.4) * Math.min(1, intensity * 1.4);
      const segments   = 3 + Math.floor(rng(2) * 2);

      outerPath.moveTo(0, 0);
      innerPath.moveTo(0, 0);

      let px = 0, py = 0;
      for (let s = 1; s <= segments; s++) {
        const t     = s / segments;
        const drift = (rng(s * 17) - 0.5) * len * 0.18;
        px = Math.cos(angle) * len * t + Math.sin(angle) * drift;
        py = Math.sin(angle) * len * t - Math.cos(angle) * drift;
        outerPath.lineTo(px, py);
        innerPath.lineTo(px, py);
      }

      // Single branch crack at the mid-point
      const bt         = 0.5;
      const bx         = Math.cos(angle) * len * bt;
      const by         = Math.sin(angle) * len * bt;
      const branchAngle = angle + (rng(50) - 0.5) * 1.8;
      const branchLen  = len * 0.25;
      outerPath.moveTo(bx, by);
      innerPath.moveTo(bx, by);
      outerPath.lineTo(bx + Math.cos(branchAngle) * branchLen, by + Math.sin(branchAngle) * branchLen);
      innerPath.lineTo(bx + Math.cos(branchAngle) * branchLen, by + Math.sin(branchAngle) * branchLen);
    }

    // Two batched strokes: dark outer + bright inner
    ctx.strokeStyle = 'rgba(10, 5, 2, 0.7)';
    ctx.lineWidth   = 2.5;
    ctx.stroke(outerPath);

    ctx.strokeStyle = `rgba(160, 80, 30, ${0.3 + intensity * 0.4})`;
    ctx.lineWidth   = 1;
    ctx.stroke(innerPath);

    ctx.restore();
  }
}
